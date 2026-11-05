import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db';
import { Notice } from '@/lib/models/notice';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid notice ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body required' }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};
    if (body.title !== undefined) updateFields.title = String(body.title).trim();
    if (body.content !== undefined) updateFields.content = String(body.content).trim();
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.pinned !== undefined) updateFields.pinned = Boolean(body.pinned);
    if (body.publishedAt !== undefined)
      updateFields.publishedAt = new Date(body.publishedAt);

    const updated = await Notice.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    // Invalidate edge ISR cache
    revalidatePath('/');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating notice:', error);
    return NextResponse.json(
      { error: 'Failed to update notice' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid notice ID' }, { status: 400 });
    }

    const deleted = await Notice.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    // Invalidate edge ISR cache
    revalidatePath('/');

    return NextResponse.json({
      success: true,
      message: 'Notice deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notice:', error);
    return NextResponse.json(
      { error: 'Failed to delete notice' },
      { status: 500 }
    );
  }
}
