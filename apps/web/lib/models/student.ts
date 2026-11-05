import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { BELT_RANKS, type BeltRank, type ExamStatus } from '@/lib/types';

export { BELT_RANKS, type BeltRank, type ExamStatus };

export interface IStudent {
  name: string;
  phone?: string;
  guardianName?: string;
  beltRank: BeltRank;
  classesRequired: number;
  nextExamDate?: string;
  examStatus: ExamStatus;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StudentDocument extends IStudent, Document {}

export function normalizeBeltRank(val: unknown): BeltRank {
  if (typeof val !== 'string') return 'White';
  const clean = val.replace(/\s*belt\s*$/i, '').trim();
  const matched = BELT_RANKS.find(
    (b) => b.toLowerCase() === clean.toLowerCase()
  );
  return matched || 'White';
}

const StudentSchema = new Schema<StudentDocument>(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    guardianName: {
      type: String,
      trim: true,
      default: '',
    },
    beltRank: {
      type: String,
      enum: BELT_RANKS,
      default: 'White',
      set: normalizeBeltRank,
    },
    classesRequired: {
      type: Number,
      default: 10,
      min: [0, 'Required classes cannot be negative'],
    },
    nextExamDate: {
      type: String,
      trim: true,
      default: '',
    },
    examStatus: {
      type: String,
      enum: ['passed', 'failed', 'pending'],
      default: 'pending',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    collection: 'stsk',
    timestamps: true,
  }
);

StudentSchema.index({ active: 1, name: 1 });
StudentSchema.index({ name: 1, phone: 1 }, { unique: true });

export const Student: Model<StudentDocument> =
  mongoose.models.Student ||
  mongoose.model<StudentDocument>('Student', StudentSchema, 'stsk');

export default Student;
