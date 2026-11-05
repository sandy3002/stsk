import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { TuitionLedger } from '@/lib/services/tuition';
import { Student } from '@/lib/models/student';
import { Tuition } from '@/lib/models/tuition';

vi.mock('@/lib/models/student', () => {
  return {
    Student: {
      find: vi.fn(),
    },
  };
});

vi.mock('@/lib/models/tuition', () => {
  return {
    Tuition: {
      find: vi.fn(),
      findOneAndUpdate: vi.fn(),
    },
  };
});

describe('TuitionLedger', () => {
  const validStudentId = new Types.ObjectId().toString();
  const validMonth = '2026-11';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBillingMonth', () => {
    it('throws error for invalid billing month format', () => {
      expect(() => TuitionLedger.validateBillingMonth('2026-13')).toThrow();
      expect(() => TuitionLedger.validateBillingMonth('2026/11')).toThrow();
      expect(() => TuitionLedger.validateBillingMonth('Nov-2026')).toThrow();
    });

    it('passes for valid YYYY-MM', () => {
      expect(() => TuitionLedger.validateBillingMonth('2026-11')).not.toThrow();
    });
  });

  describe('getMonthRoster', () => {
    it('synthesizes unpaid status for students enrolled on or before month without explicit record', async () => {
      const student1Id = new Types.ObjectId();
      const student2Id = new Types.ObjectId();

      (Student.find as any).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { _id: student1Id, name: 'Alice', beltRank: 'White', phone: '123' },
            { _id: student2Id, name: 'Bob', beltRank: 'Yellow', phone: '456' },
          ]),
        }),
      });

      // student1 has paid record, student2 has no record
      (Tuition.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            studentId: student1Id,
            billingMonth: validMonth,
            status: 'paid',
            amount: 50,
            paymentMethod: 'cash',
            paidAt: new Date('2026-11-02'),
          },
        ]),
      });

      const roster = await TuitionLedger.getMonthRoster(validMonth);

      expect(roster).toHaveLength(2);
      expect(roster[0].name).toBe('Alice');
      expect(roster[0].status).toBe('paid');
      expect(roster[0].amount).toBe(50);

      expect(roster[1].name).toBe('Bob');
      expect(roster[1].status).toBe('unpaid');
      expect(roster[1].recordId).toBeUndefined();
    });

    it('includes inactive students who have a paid tuition record for that month', async () => {
      const activeStudentId = new Types.ObjectId();
      const inactiveStudentId = new Types.ObjectId();

      (Tuition.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            studentId: inactiveStudentId,
            billingMonth: validMonth,
            status: 'paid',
            amount: 50,
            paymentMethod: 'upi',
          },
        ]),
      });

      (Student.find as any).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { _id: activeStudentId, name: 'Active Student', beltRank: 'White' },
            { _id: inactiveStudentId, name: 'Inactive Past Student', beltRank: 'Brown', active: false },
          ]),
        }),
      });

      const roster = await TuitionLedger.getMonthRoster(validMonth);

      expect(roster).toHaveLength(2);
      expect(roster.some((s) => s.studentId === inactiveStudentId.toString() && s.status === 'paid')).toBe(true);
      expect(Student.find).toHaveBeenCalledWith({
        $or: [
          {
            active: true,
            $or: [
              { createdAt: { $lte: expect.any(Date) } },
              { createdAt: { $exists: false } },
            ],
          },
          { _id: { $in: [inactiveStudentId] } },
        ],
      });
    });
  });

  describe('toggleStatus', () => {
    it('upserts tuition record with paid status and paidAt timestamp', async () => {
      const mockDoc = {
        _id: new Types.ObjectId(),
        studentId: new Types.ObjectId(validStudentId),
        billingMonth: validMonth,
        status: 'paid',
        paymentMethod: 'upi',
      };
      (Tuition.findOneAndUpdate as any).mockResolvedValue(mockDoc);

      const result = await TuitionLedger.toggleStatus(
        validStudentId,
        validMonth,
        'paid',
        { paymentMethod: 'upi', amount: 60 }
      );

      expect(Tuition.findOneAndUpdate).toHaveBeenCalledWith(
        {
          studentId: expect.any(Types.ObjectId),
          billingMonth: validMonth,
        },
        {
          $set: {
            status: 'paid',
            paidAt: expect.any(Date),
            paymentMethod: 'upi',
            amount: 60,
            updatedAt: expect.any(Date),
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
      expect(result).toEqual(mockDoc);
    });

    it('retries update without upsert on E11000 collision', async () => {
      const mockDoc = {
        _id: new Types.ObjectId(),
        studentId: new Types.ObjectId(validStudentId),
        billingMonth: validMonth,
        status: 'paid',
      };
      const duplicateError: any = new Error('E11000 duplicate key');
      duplicateError.code = 11000;

      (Tuition.findOneAndUpdate as any)
        .mockRejectedValueOnce(duplicateError)
        .mockResolvedValueOnce(mockDoc);

      const result = await TuitionLedger.toggleStatus(
        validStudentId,
        validMonth,
        'paid',
        { amount: 50 }
      );

      expect(Tuition.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockDoc);
    });

    it('clears paidAt and paymentMethod when status is set to unpaid', async () => {
      (Tuition.findOneAndUpdate as any).mockResolvedValue({});

      await TuitionLedger.toggleStatus(validStudentId, validMonth, 'unpaid');

      expect(Tuition.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: {
            status: 'unpaid',
            paidAt: null,
            paymentMethod: null,
            updatedAt: expect.any(Date),
          },
        },
        expect.anything()
      );
    });
  });

  describe('getStudentPaymentHistory', () => {
    it('returns history sorted by billingMonth descending', async () => {
      const historyMock = [
        { billingMonth: '2026-11', status: 'paid' },
        { billingMonth: '2026-10', status: 'paid' },
      ];

      (Tuition.find as any).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(historyMock),
        }),
      });

      const history = await TuitionLedger.getStudentPaymentHistory(validStudentId);

      expect(Tuition.find).toHaveBeenCalledWith({
        studentId: expect.any(Types.ObjectId),
      });
      expect(history).toEqual(historyMock);
    });
  });
});
