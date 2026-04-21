import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getTransactions, findTransactionByLocalId, createTransaction } from '@/lib/firestore';
import type { Transaction } from '@/lib/types';

// GET /api/transactions
// Query: eventId?, staffEmail?, teamNumber?, from?, to?, loaner?, limit?, offset?
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const eventId = searchParams.get('eventId') ?? undefined;
    const staffEmail = searchParams.get('staffEmail') ?? undefined;
    const teamNumber = searchParams.get('teamNumber') ?? undefined;
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const loanerParam = searchParams.get('loaner');
    const loaner =
      loanerParam === 'true' ? true : loanerParam === 'false' ? false : undefined;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const { transactions, total } = await getTransactions({
      eventId,
      staffEmail,
      teamNumber,
      from,
      to,
      loaner,
      limit,
      offset,
    });

    return NextResponse.json({ transactions, total });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/transactions
// Idempotent: if body.localId exists and transaction already synced, return existing
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const body = (await request.json()) as Transaction;

    // Idempotency check via localId
    if (body.localId) {
      const existing = await findTransactionByLocalId(body.localId);
      if (existing) {
        return NextResponse.json({ transaction: existing });
      }
    }

    const transaction = await createTransaction(body);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
