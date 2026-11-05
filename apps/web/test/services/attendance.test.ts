import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { AttendanceEngine } from '@/lib/services/attendance';
import { Attendance } from '@/lib/models/attendance';

vi.mock('@/lib/models/attendance', () => {
  return {
    Attendance: {
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
      find: vi.fn(),
      countDocuments: vi.fn(),
    },
  };
});

describe('AttendanceEngine', () => {
  const validStudentId = new Types.ObjectId().toString();
  const validDate = '2026-11-04';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('markAttendance', () => {
    it('rejects invalid studentId', async () => {
      await expect(
        AttendanceEngine.markAttendance('invalid-id', validDate, 'present')
      ).rejects.toThrow('Invalid studentId');
    });

    it('rejects invalid date format', async () => {
      await expect(
        AttendanceEngine.markAttendance(validStudentId, '04-11-2026', 'present')
      ).rejects.toThrow('Invalid date format');
    });

    it('idempotently upserts attendance record with status present', async () => {
      const mockDoc = {
        _id: new Types.ObjectId(),
        studentId: new Types.ObjectId(validStudentId),
        date: validDate,
        status: 'present',
        sessionType: 'regular',
      };
      (Attendance.findOneAndUpdate as any).mockResolvedValue(mockDoc);

      const result = await AttendanceEngine.markAttendance(
        validStudentId,
        validDate,
        'present'
      );

      expect(Attendance.findOneAndUpdate).toHaveBeenCalledWith(
        {
          studentId: expect.any(Types.ObjectId),
          date: validDate,
          sessionType: 'regular',
        },
        {
          $set: {
            status: 'present',
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
        date: validDate,
        status: 'present',
        sessionType: 'regular',
      };
      const duplicateError: any = new Error('E11000 duplicate key');
      duplicateError.code = 11000;

      (Attendance.findOneAndUpdate as any)
        .mockRejectedValueOnce(duplicateError)
        .mockResolvedValueOnce(mockDoc);

      const result = await AttendanceEngine.markAttendance(
        validStudentId,
        validDate,
        'present'
      );

      expect(Attendance.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockDoc);
    });
  });

  describe('revokeAttendance', () => {
    it('deletes attendance record and returns true if found', async () => {
      (Attendance.deleteOne as any).mockResolvedValue({ deletedCount: 1 });

      const deleted = await AttendanceEngine.revokeAttendance(
        validStudentId,
        validDate
      );

      expect(Attendance.deleteOne).toHaveBeenCalledWith({
        studentId: expect.any(Types.ObjectId),
        date: validDate,
        sessionType: 'regular',
      });
      expect(deleted).toBe(true);
    });

    it('returns false if no record existed to revoke', async () => {
      (Attendance.deleteOne as any).mockResolvedValue({ deletedCount: 0 });

      const deleted = await AttendanceEngine.revokeAttendance(
        validStudentId,
        validDate
      );

      expect(deleted).toBe(false);
    });
  });

  describe('getDailyRoster', () => {
    it('returns a status map keyed by studentId', async () => {
      const student1 = new Types.ObjectId();
      const student2 = new Types.ObjectId();

      (Attendance.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { studentId: student1, status: 'present', sessionType: 'regular' },
          { studentId: student2, status: 'absent', sessionType: 'regular' },
        ]),
      });

      const roster = await AttendanceEngine.getDailyRoster(validDate);

      expect(roster[student1.toString()]).toEqual({
        status: 'present',
        sessionType: 'regular',
      });
      expect(roster[student2.toString()]).toEqual({
        status: 'absent',
        sessionType: 'regular',
      });
    });

    it('scopes query to specific sessionType when provided', async () => {
      (Attendance.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      await AttendanceEngine.getDailyRoster(validDate, 'sparring');

      expect(Attendance.find).toHaveBeenCalledWith({
        date: validDate,
        sessionType: 'sparring',
      });
    });
  });

  describe('getAttendedCount', () => {
    it('counts documents with status present for given student', async () => {
      (Attendance.countDocuments as any).mockResolvedValue(14);

      const count = await AttendanceEngine.getAttendedCount(validStudentId);

      expect(Attendance.countDocuments).toHaveBeenCalledWith({
        studentId: expect.any(Types.ObjectId),
        status: 'present',
      });
      expect(count).toBe(14);
    });
  });
});
