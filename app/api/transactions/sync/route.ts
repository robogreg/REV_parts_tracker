import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { findTransactionByLocalId, createTransaction } from '@/lib/firestore';
import type { Transaction } from '@/lib/types';

interface SyncResult {
  localId: string | undefined;
  transactionId: string;
  success: boolean;
  error?: string;
}

interface SyncBody {
  transactions: Transaction[];
}

// POST /api/transactions/sync
// Bulk sync of offline-queued transactions with per-item idempotency
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const body = (await request.json()) as SyncBody;
    const { transactions } = body;

    if (!Array.isArray(transactions)) {
      return NextResponse.json({ error: 'transactions must be an array' }, { status: 400 });
    }

    const results: SyncResult[] = [];

    for (const tx of transactions) {
      try {
        // Idempotency check via localId
        if (tx.localId) {
          const existing = await findTransactionByLocalId(tx.localId);
          if (existing) {
            results.push({ localId: tx.localId, transactionId: existing.id, success: true });
            continue;
          }
        }

        const saved = await createTransaction(tx);
        results.push({ localId: tx.localId, transactionId: saved.id, success: true });
      } catch (itemErr) {
        results.push({
          localId: tx.localId,
          transactionId: tx.id,
          success: false,
          error: itemErr instanceof Error ? itemErr.message : String(itemErr),
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
