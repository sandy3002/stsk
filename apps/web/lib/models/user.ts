import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IUser {
  username: string;
  passwordHash: string;
  role: 'admin';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserDocument extends IUser, Document {}

const UserSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      required: [true, 'username is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
  },
  {
    collection: 'users',
    timestamps: true,
  }
);

export const User: Model<UserDocument> =
  mongoose.models.User ||
  mongoose.model<UserDocument>('User', UserSchema, 'users');

export default User;
