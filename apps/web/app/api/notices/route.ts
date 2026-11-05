import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { connectDB } from '@/lib/db';
import { Notice } from '@/lib/models/notice';

export async function GET() {
  try {
    await connectDB();

    const notices = await Notice.find()
      .sort({ pinned: -1, publishedAt: -1 })
      .lean();

    return NextResponse.json(notices);
  } catch (error) {
    console.error('Error fetching notices:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve notices' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json().catch(() => null);
    if (!body || !body.title || !body.content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const notice = await Notice.create({
      title: String(body.title).trim(),
      content: String(body.content).trim(),
      category: body.category || 'announcement',
      pinned: Boolean(body.pinned),
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
    });

    // Invalidate public edge ISR cache on the homepage
    revalidatePath('/');

    return NextResponse.json(notice, { status: 201 });
  } catch (error) {
    console.error('Error creating notice:', error);
    return NextResponse.json(
      { error: 'Failed to create notice' },
      { status: 500 }
    );
  }
}
