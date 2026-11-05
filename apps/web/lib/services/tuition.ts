import { Types } from 'mongoose';
import { Student } from '@/lib/models/student';
import {
  Tuition,
  type TuitionDocument,
  type TuitionStatus,
  type PaymentMethod,
} from '@/lib/models/tuition';

export interface StudentTuitionSummary {
  studentId: string;
  name: string;
  beltRank: string;
  phone?: string;
  billingMonth: string;
  status: TuitionStatus;
  amount?: number;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  recordId?: string;
  notes?: string;
}

export class TuitionLedger {
  /**
   * Validates billing month string format (YYYY-MM).
   */
  static validateBillingMonth(billingMonth: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
      throw new Error(
        `Invalid billing month format: "${billingMonth}". Expected YYYY-MM (e.g., 2026-11).`
      );
    }
  }

  /**
   * Returns roster fee status for all eligible active students in a given month.
   * Synthesizes unpaid status for students enrolled on or before the month who lack an explicit record.
   */
  static async getMonthRoster(
    billingMonth: string
  ): Promise<StudentTuitionSummary[]> {
    this.validateBillingMonth(billingMonth);

    // Calculate the end of the billing month
    const [yearStr, monthStr] = billingMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    // Date month is 0-indexed; month parameter gives the 1st of next month, day 0 gives last day of target month
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // SWARM-LOGIC-005: Query existing tuition records first so historical paid records for deactivated students are retained
    const monthRecords = await Tuition.find({ billingMonth }).lean();
    const recordedStudentIds = monthRecords.map((r) => r.studentId);

    // Find students who are either active (and enrolled on or before month end) OR have an existing tuition record for this month
    const students = await Student.find({
      $or: [
        {
          active: true,
          $or: [
            { createdAt: { $lte: endOfMonth } },
            { createdAt: { $exists: false } },
          ],
        },
        { _id: { $in: recordedStudentIds } },
      ],
    })
      .sort({ name: 1 })
      .lean();

    const recordMap = new Map<string, (typeof monthRecords)[number]>();
    for (const r of monthRecords) {
      recordMap.set(r.studentId.toString(), r);
    }

    const summaries: StudentTuitionSummary[] = students.map((s) => {
      const studentId = s._id.toString();
      const existing = recordMap.get(studentId);

      if (existing) {
        return {
          studentId,
          name: s.name,
          beltRank: s.beltRank,
          phone: s.phone,
          billingMonth,
          status: existing.status,
          amount: existing.amount,
          paymentMethod: existing.paymentMethod,
          paidAt: existing.paidAt,
          recordId: existing._id.toString(),
          notes: existing.notes,
        };
      }

      return {
        studentId,
        name: s.name,
        beltRank: s.beltRank,
        phone: s.phone,
        billingMonth,
        status: 'unpaid',
      };
    });

    return summaries;
  }

  /**
   * Toggles or updates tuition status for a student and billing month.
   */
  static async toggleStatus(
    studentId: string,
    billingMonth: string,
    status: TuitionStatus,
    options?: {
      amount?: number;
      paymentMethod?: PaymentMethod;
      notes?: string;
    }
  ): Promise<TuitionDocument> {
    this.validateBillingMonth(billingMonth);

    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error(`Invalid studentId: "${studentId}"`);
    }

    const objectId = new Types.ObjectId(studentId);

    const updateFields: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'paid') {
      updateFields.paidAt = new Date();
      if (options?.paymentMethod) {
        updateFields.paymentMethod = options.paymentMethod;
      }
      if (options?.amount !== undefined) {
        updateFields.amount = options.amount;
      }
    } else {
      updateFields.paidAt = null;
      updateFields.paymentMethod = null;
    }

    if (options?.notes !== undefined) {
      updateFields.notes = options.notes;
    }

    try {
      // SWARM-LOGIC-003: Pass runValidators: true to enforce schema constraints on update
      const record = await Tuition.findOneAndUpdate(
        { studentId: objectId, billingMonth },
        { $set: updateFields },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      return record;
    } catch (err: any) {
      // SWARM-CONC-005: Handle E11000 duplicate key race condition on concurrent upserts
      if (err.code === 11000) {
        const record = await Tuition.findOneAndUpdate(
          { studentId: objectId, billingMonth },
          { $set: updateFields },
          {
            new: true,
            runValidators: true,
          }
        );
        if (record) return record;
      }
      throw err;
    }
  }

  /**
   * Retrieves full historical payment ledger for a specific student.
   */
  static async getStudentPaymentHistory(
    studentId: string
  ): Promise<TuitionDocument[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error(`Invalid studentId: "${studentId}"`);
    }

    const records = await Tuition.find({
      studentId: new Types.ObjectId(studentId),
    })
      .sort({ billingMonth: -1 })
      .lean();

    return records as unknown as TuitionDocument[];
  }
}

export default TuitionLedger;
