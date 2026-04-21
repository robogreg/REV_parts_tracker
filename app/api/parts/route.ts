import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getParts } from '@/lib/firestore';

// GET /api/parts?category=Motors&search=neo
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const parts = await getParts({ category, search });
    return NextResponse.json({ parts });
  } catch (err) {
    return handleApiError(err);
  }
}
