import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './student.schema.js';

@Injectable()
export class StudentsService {
  private readonly fallbackStudents = [
    {
      id: '1',
      name: 'Aarav Singh',
      beltRank: 'Yellow Belt',
      nextExamDate: '2026-10-20',
      classesRequired: 10,
      classesAttended: 8,
      status: 'passed',
    },
    {
      id: '2',
      name: 'Maya Patel',
      beltRank: 'Orange Belt',
      nextExamDate: '2026-10-27',
      classesRequired: 12,
      classesAttended: 4,
      status: 'failed',
    },
    {
      id: '3',
      name: 'Daniel Kim',
      beltRank: 'Green Belt',
      nextExamDate: '2026-11-03',
      classesRequired: 8,
      classesAttended: 6,
      status: 'passed',
    },
  ];

  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  calculateRemainingClasses(required: number, attended: number): number {
    return Math.max(0, required - attended);
  }

  async findAll() {
    const students = await this.studentModel.find().lean().exec();
    const source = students.length > 0 ? students : this.fallbackStudents;

    return source.map((student: any) => ({
      ...student,
      classesRemaining: this.calculateRemainingClasses(
        student.classesRequired,
        student.classesAttended,
      ),
    }));
  }

  async findOne(id: string) {
    const student = await this.studentModel.findById(id).lean().exec();
    const source =
      student ?? this.fallbackStudents.find((item) => item.id === id);

    if (!source) {
      return null;
    }

    return {
      ...source,
      classesRemaining: this.calculateRemainingClasses(
        source.classesRequired,
        source.classesAttended,
      ),
    };
  }

  async create(dto: any) {
    const newStudent = new this.studentModel({
      ...dto,
      classesRequired: dto.classesRequired ?? 0,
      classesAttended: dto.classesAttended ?? 0,
      status: dto.status ?? 'pending',
    });

    return newStudent.save();
  }

  async update(id: string, dto: any) {
    const updated = await this.studentModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    return updated ?? null;
  }
}
