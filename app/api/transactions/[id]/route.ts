import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getTransaction, updateTransactionLoaner } from '@/lib/firestore';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/transactions/:id
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { id } = await context.params;
    const transaction = await getTransaction(id);
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    return NextResponse.json({ transaction });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/transactions/:id
// Body: { itemIndex?: number; allReturned?: boolean }
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { id } = await context.params;
    const body = (await request.json()) as { itemIndex?: number; allReturned?: boolean };
    await updateTransactionLoaner(id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
