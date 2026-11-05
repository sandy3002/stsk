import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { TuitionLedger } from '@/lib/services/tuition';
import type { TuitionStatus, PaymentMethod } from '@/lib/models/tuition';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const currentMonth = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
    const month = searchParams.get('month') || currentMonth;

    const roster = await TuitionLedger.getMonthRoster(month);

    return NextResponse.json({
      billingMonth: month,
      roster,
    });
  } catch (error) {
    console.error('Error fetching tuition roster:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to retrieve tuition roster',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json().catch(() => null);
    if (!body || !body.studentId || !body.billingMonth || !body.status) {
      return NextResponse.json(
        { error: 'studentId, billingMonth (YYYY-MM), and status are required' },
        { status: 400 }
      );
    }

    const status = body.status as TuitionStatus;
    if (status !== 'paid' && status !== 'unpaid' && status !== 'waived') {
      return NextResponse.json(
        { error: 'status must be "paid", "unpaid", or "waived"' },
        { status: 400 }
      );
    }

    // SWARM-LOGIC-003: Validate non-negative amount and paymentMethod enum
    let amountNumber: number | undefined = undefined;
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
      amountNumber = Number(body.amount);
      if (isNaN(amountNumber) || amountNumber < 0) {
        return NextResponse.json(
          { error: 'amount must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    if (body.paymentMethod !== undefined && body.paymentMethod !== null && body.paymentMethod !== '') {
      if (body.paymentMethod !== 'cash' && body.paymentMethod !== 'upi') {
        return NextResponse.json(
          { error: 'paymentMethod must be "cash" or "upi"' },
          { status: 400 }
        );
      }
    }

    const record = await TuitionLedger.toggleStatus(
      body.studentId,
      body.billingMonth,
      status,
      {
        paymentMethod: (body.paymentMethod || undefined) as PaymentMethod | undefined,
        amount: amountNumber,
        notes: body.notes ? String(body.notes).trim() : undefined,
      }
    );

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error('Error toggling tuition status:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update tuition status',
      },
      { status: 500 }
    );
  }
}
