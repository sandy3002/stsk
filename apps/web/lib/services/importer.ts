import { Student, normalizeBeltRank, type BeltRank, type ExamStatus } from '@/lib/models/student';

export interface RawStudentInput {
  name?: unknown;
  phone?: unknown;
  guardianName?: unknown;
  beltRank?: unknown;
  classesRequired?: unknown;
  nextExamDate?: unknown;
  examStatus?: unknown;
  active?: unknown;
}

export interface ValidatedStudentInput {
  name: string;
  phone: string;
  guardianName: string;
  beltRank: BeltRank;
  classesRequired: number;
  nextExamDate: string;
  examStatus: ExamStatus;
  active: boolean;
  rowNumber: number;
}

export interface ValidationError {
  row: number;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  validRecords: ValidatedStudentInput[];
  errors: ValidationError[];
}

export interface BatchSummary {
  totalProcessed: number;
  insertedCount: number;
  skippedDuplicates: number;
  errors: ValidationError[];
}

export class StudentImporter {
  /**
   * Validates and sanitizes an array of raw student records (e.g., from CSV).
   */
  static validateBatch(records: RawStudentInput[]): ValidationResult {
    const validRecords: ValidatedStudentInput[] = [];
    const errors: ValidationError[] = [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        valid: false,
        validRecords: [],
        errors: [{ row: 0, message: 'Batch contains no records to import' }],
      };
    }

    records.forEach((raw, index) => {
      const rowNumber = index + 1;

      // Validate required name
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!name) {
        errors.push({
          row: rowNumber,
          field: 'name',
          message: 'Student name is required',
        });
        return;
      }

      // Sanitize phone
      const phone = typeof raw.phone === 'string' || typeof raw.phone === 'number'
        ? String(raw.phone).trim()
        : '';

      // Sanitize guardianName
      const guardianName = typeof raw.guardianName === 'string'
        ? raw.guardianName.trim()
        : '';

      // Normalize belt rank
      const beltRank = normalizeBeltRank(raw.beltRank);

      // Classes required default to 10
      let classesRequired = 10;
      if (raw.classesRequired !== undefined && raw.classesRequired !== null && raw.classesRequired !== '') {
        const parsed = Number(raw.classesRequired);
        if (!isNaN(parsed) && parsed >= 0) {
          classesRequired = Math.floor(parsed);
        }
      }

      // Next exam date
      const nextExamDate = typeof raw.nextExamDate === 'string'
        ? raw.nextExamDate.trim()
        : '';

      // Exam status
      let examStatus: ExamStatus = 'pending';
      if (typeof raw.examStatus === 'string') {
        const s = raw.examStatus.trim().toLowerCase();
        if (s === 'passed' || s === 'failed' || s === 'pending') {
          examStatus = s;
        }
      }

      // Active status defaults to true
      let active = true;
      if (typeof raw.active === 'boolean') {
        active = raw.active;
      } else if (typeof raw.active === 'string') {
        active = raw.active.toLowerCase() !== 'false' && raw.active.toLowerCase() !== '0';
      }

      validRecords.push({
        name,
        phone,
        guardianName,
        beltRank,
        classesRequired,
        nextExamDate,
        examStatus,
        active,
        rowNumber,
      });
    });

    return {
      valid: errors.length === 0,
      validRecords,
      errors,
    };
  }

  /**
   * Commits validated students to MongoDB using bulkWrite(ordered: false).
   * Deduplicates by composite (name + phone) unless allowSiblings is enabled.
   */
  static async commitBatch(
    records: ValidatedStudentInput[],
    options: { allowSiblings?: boolean } = {}
  ): Promise<BatchSummary> {
    if (records.length === 0) {
      return {
        totalProcessed: 0,
        insertedCount: 0,
        skippedDuplicates: 0,
        errors: [],
      };
    }

    const { allowSiblings = true } = options;
    const errors: ValidationError[] = [];
    const seenInBatch = new Set<string>();
    const seenPhonesInBatch = new Set<string>();
    const candidatesToInsert: ValidatedStudentInput[] = [];
    let inBatchDuplicates = 0;

    // In-batch deduplication
    for (const record of records) {
      // Key is name + phone. Siblings have different names with the same phone.
      const compositeKey = `${record.name.toLowerCase()}::${record.phone}`;
      if (seenInBatch.has(compositeKey)) {
        inBatchDuplicates++;
        errors.push({
          row: record.rowNumber,
          message: `Duplicate student in batch: "${record.name}" with phone "${record.phone || 'none'}"`,
        });
        continue;
      }

      // SWARM-LOGIC-001: Enforce uniqueness of phone number when allowSiblings is false
      if (!allowSiblings && record.phone && seenPhonesInBatch.has(record.phone)) {
        inBatchDuplicates++;
        errors.push({
          row: record.rowNumber,
          message: `Duplicate phone number in batch: "${record.phone}" (sibling registration disabled)`,
        });
        continue;
      }

      seenInBatch.add(compositeKey);
      if (record.phone) {
        seenPhonesInBatch.add(record.phone);
      }
      candidatesToInsert.push(record);
    }

    if (candidatesToInsert.length === 0) {
      return {
        totalProcessed: records.length,
        insertedCount: 0,
        skippedDuplicates: inBatchDuplicates,
        errors,
      };
    }

    // SWARM-SEC-005: Chunk existing record queries in batches of 100 to avoid query planner DOS
    const CHUNK_SIZE = 100;
    const existingDbSet = new Set<string>();
    const existingDbPhoneSet = new Set<string>();

    for (let i = 0; i < candidatesToInsert.length; i += CHUNK_SIZE) {
      const chunk = candidatesToInsert.slice(i, i + CHUNK_SIZE);
      const namePhoneQueries = chunk.map((c) => ({
        name: new RegExp(`^${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        phone: c.phone || '',
      }));

      const chunkStudents = await Student.find({
        $or: namePhoneQueries,
      }).lean();

      for (const s of chunkStudents) {
        existingDbSet.add(`${s.name.toLowerCase()}::${s.phone || ''}`);
      }

      if (!allowSiblings) {
        const nonNullPhones = chunk.map((c) => c.phone).filter(Boolean);
        if (nonNullPhones.length > 0) {
          const phoneMatches = await Student.find({
            phone: { $in: nonNullPhones },
          }).lean();
          for (const s of phoneMatches) {
            if (s.phone) {
              existingDbPhoneSet.add(s.phone);
            }
          }
        }
      }
    }

    const finalInserts: ValidatedStudentInput[] = [];
    let dbDuplicates = 0;

    for (const item of candidatesToInsert) {
      const key = `${item.name.toLowerCase()}::${item.phone}`;
      if (existingDbSet.has(key)) {
        dbDuplicates++;
        errors.push({
          row: item.rowNumber,
          message: `Student already exists in database: "${item.name}" with phone "${item.phone || 'none'}"`,
        });
      } else if (!allowSiblings && item.phone && existingDbPhoneSet.has(item.phone)) {
        dbDuplicates++;
        errors.push({
          row: item.rowNumber,
          message: `Student with phone "${item.phone}" already exists in database (sibling registration disabled)`,
        });
      } else {
        finalInserts.push(item);
      }
    }

    if (finalInserts.length === 0) {
      return {
        totalProcessed: records.length,
        insertedCount: 0,
        skippedDuplicates: inBatchDuplicates + dbDuplicates,
        errors,
      };
    }

    // SWARM-CONC-001 & SWARM-LOGIC-002: Atomic upsert via updateOne + $setOnInsert with explicit timestamps
    const now = new Date();
    const bulkOps = finalInserts.map((item) => ({
      updateOne: {
        filter: { name: item.name, phone: item.phone },
        update: {
          $setOnInsert: {
            name: item.name,
            phone: item.phone,
            guardianName: item.guardianName,
            beltRank: item.beltRank,
            classesRequired: item.classesRequired,
            nextExamDate: item.nextExamDate,
            examStatus: item.examStatus,
            active: item.active,
            createdAt: now,
          },
          $set: { updatedAt: now },
        },
        upsert: true,
      },
    }));

    let insertedCount = 0;
    try {
      const result: any = await Student.bulkWrite(bulkOps as any, { ordered: false });
      insertedCount =
        result?.upsertedCount !== undefined
          ? result.upsertedCount
          : result?.insertedCount ?? finalInserts.length;
    } catch (err: any) {
      if (err?.result) {
        insertedCount =
          err.result.upsertedCount !== undefined
            ? err.result.upsertedCount
            : err.result.insertedCount ?? 0;
      } else {
        throw err;
      }
    }

    const concurrentSkipped = Math.max(0, finalInserts.length - insertedCount);

    return {
      totalProcessed: records.length,
      insertedCount,
      skippedDuplicates: inBatchDuplicates + dbDuplicates + concurrentSkipped,
      errors,
    };
  }
}

export default StudentImporter;
