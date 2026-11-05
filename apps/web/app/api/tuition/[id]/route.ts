import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db';
import { TuitionLedger } from '@/lib/services/tuition';

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

    const history = await TuitionLedger.getStudentPaymentHistory(id);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching student tuition history:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to retrieve tuition history',
      },
      { status: 500 }
    );
  }
}
