import mongoose, { Schema, type Document, type Model, Types } from 'mongoose';
import type { AttendanceStatus, SessionType } from '@/lib/types';

export type { AttendanceStatus, SessionType };

export interface IAttendance {
  studentId: Types.ObjectId;
  date: string; // 'YYYY-MM-DD'
  status: AttendanceStatus;
  sessionType: SessionType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttendanceDocument extends IAttendance, Document {}

const AttendanceSchema = new Schema<AttendanceDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'studentId is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'date in YYYY-MM-DD is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date must follow YYYY-MM-DD format'],
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      required: [true, 'status must be present or absent'],
    },
    sessionType: {
      type: String,
      enum: ['regular', 'sparring', 'grading'],
      default: 'regular',
    },
  },
  {
    collection: 'attendance_records',
    timestamps: true,
  }
);

AttendanceSchema.index(
  { studentId: 1, date: 1, sessionType: 1 },
  { unique: true }
);
AttendanceSchema.index({ studentId: 1, status: 1 });

export const Attendance: Model<AttendanceDocument> =
  mongoose.models.Attendance ||
  mongoose.model<AttendanceDocument>(
    'Attendance',
    AttendanceSchema,
    'attendance_records'
  );

export default Attendance;
