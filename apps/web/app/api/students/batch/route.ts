import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { StudentImporter, type RawStudentInput } from '@/lib/services/importer';

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Batch payload is required' },
        { status: 400 }
      );
    }

    const records: RawStudentInput[] = Array.isArray(body)
      ? body
      : body.records;
    const allowSiblings = body.allowSiblings !== undefined ? Boolean(body.allowSiblings) : true;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Expected an array of student records' },
        { status: 400 }
      );
    }

    // SWARM-SEC-005: Limit maximum batch ingestion payload size to 500 rows
    if (records.length > 500) {
      return NextResponse.json(
        { error: 'Batch size exceeds maximum limit of 500 records' },
        { status: 400 }
      );
    }

    const validation = StudentImporter.validateBatch(records);
    if (validation.validRecords.length === 0) {
      return NextResponse.json(
        {
          error: 'Validation failed for all records in batch',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const summary = await StudentImporter.commitBatch(validation.validRecords, {
      allowSiblings,
    });

    return NextResponse.json({
      success: true,
      summary,
      validationErrors: validation.errors,
    });
  } catch (error) {
    console.error('Error during batch student ingestion:', error);
    return NextResponse.json(
      { error: 'Failed to process batch student import' },
      { status: 500 }
    );
  }
}
