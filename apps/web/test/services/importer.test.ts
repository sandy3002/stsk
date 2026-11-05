import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentImporter } from '@/lib/services/importer';
import { Student } from '@/lib/models/student';

vi.mock('@/lib/models/student', async () => {
  const actual = await vi.importActual<any>('@/lib/models/student');
  return {
    ...actual,
    Student: {
      find: vi.fn(),
      bulkWrite: vi.fn(),
    },
  };
});

describe('StudentImporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBatch', () => {
    it('rejects empty input', () => {
      const result = StudentImporter.validateBatch([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('rejects records without a name', () => {
      const result = StudentImporter.validateBatch([
        { phone: '1234567890' },
        { name: 'John Doe', phone: '9876543210' },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(1);
      expect(result.validRecords).toHaveLength(1);
      expect(result.validRecords[0].name).toBe('John Doe');
    });

    it('applies defaults and normalizes belt ranks by stripping "Belt"', () => {
      const result = StudentImporter.validateBatch([
        {
          name: 'Jane Smith',
          beltRank: 'Yellow Belt',
        },
      ]);

      expect(result.valid).toBe(true);
      expect(result.validRecords[0].beltRank).toBe('Yellow');
      expect(result.validRecords[0].classesRequired).toBe(10);
      expect(result.validRecords[0].examStatus).toBe('pending');
      expect(result.validRecords[0].active).toBe(true);
    });
  });

  describe('commitBatch', () => {
    it('deduplicates duplicate records within the batch', async () => {
      (Student.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      (Student.bulkWrite as any).mockResolvedValue({ insertedCount: 1 });

      const records = [
        {
          name: 'Alex Tan',
          phone: '5551234',
          guardianName: '',
          beltRank: 'White' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 1,
        },
        {
          name: 'Alex Tan',
          phone: '5551234',
          guardianName: '',
          beltRank: 'White' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 2,
        },
      ];

      const summary = await StudentImporter.commitBatch(records);

      expect(summary.totalProcessed).toBe(2);
      expect(summary.insertedCount).toBe(1);
      expect(summary.skippedDuplicates).toBe(1);
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0].row).toBe(2);
    });

    it('detects existing students in the database and skips duplicates', async () => {
      (Student.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { name: 'Alex Tan', phone: '5551234' },
        ]),
      });

      const records = [
        {
          name: 'Alex Tan',
          phone: '5551234',
          guardianName: '',
          beltRank: 'White' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 1,
        },
      ];

      const summary = await StudentImporter.commitBatch(records);

      expect(summary.insertedCount).toBe(0);
      expect(summary.skippedDuplicates).toBe(1);
      expect(Student.bulkWrite).not.toHaveBeenCalled();
    });

    it('allows siblings with identical phone but different names', async () => {
      (Student.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      (Student.bulkWrite as any).mockResolvedValue({ insertedCount: 2 });

      const records = [
        {
          name: 'Brother Tan',
          phone: '5551234',
          guardianName: 'Parent Tan',
          beltRank: 'White' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 1,
        },
        {
          name: 'Sister Tan',
          phone: '5551234',
          guardianName: 'Parent Tan',
          beltRank: 'Yellow' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 2,
        },
      ];

      const summary = await StudentImporter.commitBatch(records, {
        allowSiblings: true,
      });

      expect(summary.insertedCount).toBe(2);
      expect(summary.skippedDuplicates).toBe(0);
      expect(Student.bulkWrite).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate phone numbers when allowSiblings is false', async () => {
      (Student.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      (Student.bulkWrite as any).mockResolvedValue({ upsertedCount: 1 });

      const records = [
        {
          name: 'Brother Tan',
          phone: '5551234',
          guardianName: 'Parent Tan',
          beltRank: 'White' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 1,
        },
        {
          name: 'Sister Tan',
          phone: '5551234',
          guardianName: 'Parent Tan',
          beltRank: 'Yellow' as const,
          classesRequired: 10,
          nextExamDate: '',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 2,
        },
      ];

      const summary = await StudentImporter.commitBatch(records, {
        allowSiblings: false,
      });

      expect(summary.insertedCount).toBe(1);
      expect(summary.skippedDuplicates).toBe(1);
      expect(summary.errors[0].message).toContain('sibling registration disabled');
    });

    it('uses atomic updateOne with $setOnInsert, createdAt, and updatedAt', async () => {
      (Student.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      let passedOps: any[] = [];
      (Student.bulkWrite as any).mockImplementation((ops: any[]) => {
        passedOps = ops;
        return Promise.resolve({ upsertedCount: 1 });
      });

      const records = [
        {
          name: 'Ken Masters',
          phone: '9998887',
          guardianName: '',
          beltRank: 'Red' as const,
          classesRequired: 15,
          nextExamDate: '2026-12-01',
          examStatus: 'pending' as const,
          active: true,
          rowNumber: 1,
        },
      ];

      await StudentImporter.commitBatch(records);

      expect(passedOps).toHaveLength(1);
      expect(passedOps[0].updateOne).toBeDefined();
      expect(passedOps[0].updateOne.upsert).toBe(true);
      expect(passedOps[0].updateOne.filter).toEqual({ name: 'Ken Masters', phone: '9998887' });
      expect(passedOps[0].updateOne.update.$setOnInsert.createdAt).toBeInstanceOf(Date);
      expect(passedOps[0].updateOne.update.$set.updatedAt).toBeInstanceOf(Date);
    });
  });
});
