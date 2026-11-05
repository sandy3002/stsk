import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { AttendanceEngine } from '@/lib/services/attendance';
import type { AttendanceStatus, SessionType } from '@/lib/models/attendance';

const VALID_SESSION_TYPES = new Set<string>(['regular', 'sparring', 'grading']);

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().split('T')[0];
    const date = searchParams.get('date') || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date parameter. Format: YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // SWARM-LOGIC-008: Validate sessionType enum parameter
    const sessionTypeParam = searchParams.get('sessionType');
    if (sessionTypeParam && !VALID_SESSION_TYPES.has(sessionTypeParam)) {
      return NextResponse.json(
        { error: 'sessionType must be "regular", "sparring", or "grading"' },
        { status: 400 }
      );
    }

    const sessionType = (sessionTypeParam as SessionType) || undefined;
    const roster = await AttendanceEngine.getDailyRoster(date, sessionType);

    return NextResponse.json({
      date,
      sessionType: sessionType || 'all',
      roster,
    });
  } catch (error) {
    console.error('Error fetching attendance roster:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve attendance roster' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json().catch(() => null);
    if (!body || !body.studentId || !body.status) {
      return NextResponse.json(
        { error: 'studentId and status ("present" | "absent") are required' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const date = body.date || today;
    const status = body.status as AttendanceStatus;
    const sessionType = (body.sessionType || 'regular') as SessionType;

    // SWARM-LOGIC-008: Validate status and sessionType enums
    if (status !== 'present' && status !== 'absent') {
      return NextResponse.json(
        { error: 'status must be either "present" or "absent"' },
        { status: 400 }
      );
    }

    if (!VALID_SESSION_TYPES.has(sessionType)) {
      return NextResponse.json(
        { error: 'sessionType must be "regular", "sparring", or "grading"' },
        { status: 400 }
      );
    }

    const record = await AttendanceEngine.markAttendance(
      body.studentId,
      date,
      status,
      sessionType
    );

    const attendedCount = await AttendanceEngine.getAttendedCount(body.studentId);

    return NextResponse.json({
      success: true,
      record,
      classesAttended: attendedCount,
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to record attendance',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB();

    let studentId: string | null = null;
    let date: string | null = null;
    let sessionType: SessionType = 'regular';

    // Parse body if present, or search params
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (body) {
        studentId = body.studentId;
        date = body.date;
        if (body.sessionType) sessionType = body.sessionType;
      }
    }

    if (!studentId || !date) {
      const url = new URL(request.url);
      studentId = studentId || url.searchParams.get('studentId');
      date = date || url.searchParams.get('date');
      const st = url.searchParams.get('sessionType');
      if (st) sessionType = st as SessionType;
    }

    if (!studentId || !date) {
      return NextResponse.json(
        { error: 'studentId and date are required to revoke attendance' },
        { status: 400 }
      );
    }

    if (!VALID_SESSION_TYPES.has(sessionType)) {
      return NextResponse.json(
        { error: 'sessionType must be "regular", "sparring", or "grading"' },
        { status: 400 }
      );
    }

    const revoked = await AttendanceEngine.revokeAttendance(
      studentId,
      date,
      sessionType
    );

    const attendedCount = await AttendanceEngine.getAttendedCount(studentId);

    return NextResponse.json({
      success: true,
      revoked,
      classesAttended: attendedCount,
    });
  } catch (error) {
    console.error('Error revoking attendance:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to revoke attendance',
      },
      { status: 500 }
    );
  }
}
