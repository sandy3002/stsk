import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true, collection: 'stsk' })
export class Student {
  @Prop({ required: true })
  name: string;

  @Prop()
  beltRank?: string;

  @Prop()
  nextExamDate?: string;

  @Prop({ default: 0 })
  classesRequired: number;

  @Prop({ default: 0 })
  classesAttended: number;

  @Prop({ default: 'pending' })
  status: 'passed' | 'failed' | 'pending';
}

export const StudentSchema = SchemaFactory.createForClass(Student);
