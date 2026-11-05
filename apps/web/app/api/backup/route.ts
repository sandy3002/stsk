import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Student } from '@/lib/models/student';
import { Attendance } from '@/lib/models/attendance';
import { Tuition } from '@/lib/models/tuition';
import { Notice } from '@/lib/models/notice';

export async function GET() {
  try {
    await connectDB();

    const [students, attendance, tuition, notices] = await Promise.all([
      Student.find().lean(),
      Attendance.find().lean(),
      Tuition.find().lean(),
      Notice.find().lean(),
    ]);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `stsk-backup-${timestamp}.json`;

    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      counts: {
        students: students.length,
        attendance_records: attendance.length,
        tuition_records: tuition.length,
        notices: notices.length,
      },
      collections: {
        students,
        attendance_records: attendance,
        tuition_records: tuition,
        notices,
      },
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error creating database backup:', error);
    return NextResponse.json(
      { error: 'Failed to generate database backup' },
      { status: 500 }
    );
  }
}
