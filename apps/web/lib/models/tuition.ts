import mongoose, { Schema, type Document, type Model, Types } from 'mongoose';
import type { TuitionStatus, PaymentMethod } from '@/lib/types';

export type { TuitionStatus, PaymentMethod };

export interface ITuition {
  studentId: Types.ObjectId;
  billingMonth: string; // 'YYYY-MM'
  status: TuitionStatus;
  amount?: number;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TuitionDocument extends ITuition, Document {}

const TuitionSchema = new Schema<TuitionDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'studentId is required'],
      index: true,
    },
    billingMonth: {
      type: String,
      required: [true, 'billingMonth in YYYY-MM is required'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'billingMonth must follow YYYY-MM format'],
      index: true,
    },
    status: {
      type: String,
      enum: ['paid', 'unpaid', 'waived'],
      default: 'unpaid',
      required: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi'],
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    collection: 'tuition_records',
    timestamps: true,
  }
);

TuitionSchema.index({ studentId: 1, billingMonth: 1 }, { unique: true });

export const Tuition: Model<TuitionDocument> =
  mongoose.models.Tuition ||
  mongoose.model<TuitionDocument>('Tuition', TuitionSchema, 'tuition_records');

export default Tuition;
