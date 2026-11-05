import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db';
import { Student, normalizeBeltRank } from '@/lib/models/student';
import { AttendanceEngine } from '@/lib/services/attendance';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }

    const student = await Student.findById(id).lean();
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const attended = await AttendanceEngine.getAttendedCount(id);
    const required = student.classesRequired ?? 10;

    return NextResponse.json({
      ...student,
      id: student._id.toString(),
      classesAttended: attended,
      classesRemaining: Math.max(0, required - attended),
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve student' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body required' }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};
    if (body.name !== undefined) updateFields.name = String(body.name).trim();
    if (body.phone !== undefined) updateFields.phone = String(body.phone).trim();
    if (body.guardianName !== undefined)
      updateFields.guardianName = String(body.guardianName).trim();
    // SWARM-LOGIC-004: Explicitly normalize beltRank on update
    if (body.beltRank !== undefined) updateFields.beltRank = normalizeBeltRank(body.beltRank);
    if (body.classesRequired !== undefined)
      updateFields.classesRequired = Number(body.classesRequired);
    if (body.nextExamDate !== undefined)
      updateFields.nextExamDate = String(body.nextExamDate).trim();
    if (body.examStatus !== undefined) updateFields.examStatus = body.examStatus;
    if (body.active !== undefined) updateFields.active = Boolean(body.active);

    const updated = await Student.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true, runSettersOnQuery: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating student:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'A student with this name and phone already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update student' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }

    // Soft-delete by setting active: false
    const deactivated = await Student.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true }
    );

    if (!deactivated) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Student successfully deactivated',
      student: deactivated,
    });
  } catch (error) {
    console.error('Error deactivating student:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate student' },
      { status: 500 }
    );
  }
}
