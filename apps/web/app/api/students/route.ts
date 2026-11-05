import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { Student } from '@/lib/models/student';
import { Attendance } from '@/lib/models/attendance';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('all') === 'true';

    const filter = includeInactive ? {} : { active: true };
    const students = await Student.find(filter).sort({ name: 1 }).lean();

    // Aggregate dynamic attendance counts for all students in one query
    const studentIds = students.map((s) => s._id);
    const attendanceAgg = await Attendance.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          status: 'present',
        },
      },
      {
        $group: {
          _id: '$studentId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    for (const item of attendanceAgg) {
      countMap.set(item._id.toString(), item.count);
    }

    const studentsWithAttendance = students.map((student) => {
      const id = student._id.toString();
      const attended = countMap.get(id) || 0;
      const required = student.classesRequired ?? 10;
      return {
        ...student,
        id,
        classesAttended: attended,
        classesRemaining: Math.max(0, required - attended),
      };
    });

    return NextResponse.json(studentsWithAttendance);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve students' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json().catch(() => null);
    if (!body || !body.name || !String(body.name).trim()) {
      return NextResponse.json(
        { error: 'Student name is required' },
        { status: 400 }
      );
    }

    const newStudent = await Student.create({
      name: String(body.name).trim(),
      phone: body.phone ? String(body.phone).trim() : '',
      guardianName: body.guardianName ? String(body.guardianName).trim() : '',
      beltRank: body.beltRank || 'White',
      classesRequired: body.classesRequired !== undefined ? Number(body.classesRequired) : 10,
      nextExamDate: body.nextExamDate ? String(body.nextExamDate).trim() : '',
      examStatus: body.examStatus || 'pending',
      active: body.active !== undefined ? Boolean(body.active) : true,
    });

    return NextResponse.json(newStudent, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    );
  }
}
