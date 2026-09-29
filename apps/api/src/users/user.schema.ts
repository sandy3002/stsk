import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type UserRole = 'admin' | 'viewer';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    type: String,
    required: true,
    enum: ['admin', 'viewer'],
    default: 'viewer',
  })
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
