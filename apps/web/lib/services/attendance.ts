import { Types } from 'mongoose';
import {
  Attendance,
  type AttendanceDocument,
  type AttendanceStatus,
  type SessionType,
} from '@/lib/models/attendance';

export interface DailyAttendanceMap {
  [studentId: string]: {
    status: AttendanceStatus;
    sessionType: SessionType;
  };
}

export class AttendanceEngine {
  /**
   * Idempotently marks or updates attendance for a student on a specific date.
   */
  static async markAttendance(
    studentId: string,
    date: string,
    status: AttendanceStatus,
    sessionType: SessionType = 'regular'
  ): Promise<AttendanceDocument> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error(`Invalid studentId: "${studentId}"`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
    }

    const objectId = new Types.ObjectId(studentId);

    try {
      const record = await Attendance.findOneAndUpdate(
        { studentId: objectId, date, sessionType },
        { $set: { status, updatedAt: new Date() } },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      return record;
    } catch (err: any) {
      // SWARM-CONC-005: Handle E11000 race conditions on concurrent upserts
      if (err.code === 11000) {
        const record = await Attendance.findOneAndUpdate(
          { studentId: objectId, date, sessionType },
          { $set: { status, updatedAt: new Date() } },
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
   * Revokes an existing attendance record (used for 5-second Undo).
   */
  static async revokeAttendance(
    studentId: string,
    date: string,
    sessionType: SessionType = 'regular'
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error(`Invalid studentId: "${studentId}"`);
    }

    const objectId = new Types.ObjectId(studentId);
    const result = await Attendance.deleteOne({
      studentId: objectId,
      date,
      sessionType,
    });

    return (result.deletedCount ?? 0) > 0;
  }

  /**
   * Returns a map of studentId -> attendance status for a given date, optionally scoped to a sessionType.
   */
  static async getDailyRoster(
    date: string,
    sessionType?: SessionType
  ): Promise<DailyAttendanceMap> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
    }

    // SWARM-LOGIC-006: Scope query by sessionType if provided to prevent multi-session clobbering
    const query: { date: string; sessionType?: SessionType } = { date };
    if (sessionType) {
      query.sessionType = sessionType;
    }

    const records = await Attendance.find(query).lean();
    const map: DailyAttendanceMap = {};

    for (const rec of records) {
      map[rec.studentId.toString()] = {
        status: rec.status,
        sessionType: rec.sessionType,
      };
    }

    return map;
  }

  /**
   * Derives aggregate student attendance counts dynamically via indexed query.
   */
  static async getAttendedCount(studentId: string): Promise<number> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error(`Invalid studentId: "${studentId}"`);
    }

    const count = await Attendance.countDocuments({
      studentId: new Types.ObjectId(studentId),
      status: 'present',
    });

    return count;
  }
}

export default AttendanceEngine;
