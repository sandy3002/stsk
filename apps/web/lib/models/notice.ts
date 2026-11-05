import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { NoticeCategory } from '@/lib/types';

export type { NoticeCategory };

export interface INotice {
  title: string;
  content: string;
  category: NoticeCategory;
  pinned: boolean;
  publishedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NoticeDocument extends INotice, Document {}

const NoticeSchema = new Schema<NoticeDocument>(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Notice content is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['announcement', 'exam_schedule', 'holiday'],
      default: 'announcement',
      required: true,
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'notices',
    timestamps: true,
  }
);

NoticeSchema.index({ pinned: -1, publishedAt: -1 });

export const Notice: Model<NoticeDocument> =
  mongoose.models.Notice ||
  mongoose.model<NoticeDocument>('Notice', NoticeSchema, 'notices');

export default Notice;
