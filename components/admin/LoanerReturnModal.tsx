'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Transaction } from '@/lib/types';

interface LoanerReturnModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  itemIndex?: number; // if undefined, marks all loaners returned
  onSuccess?: () => void;
}

export function LoanerReturnModal({
  open,
  onClose,
  transaction,
  itemIndex,
  onSuccess,
}: LoanerReturnModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transaction) return null;

  const targetItems =
    itemIndex !== undefined
      ? [transaction.items[itemIndex]]
      : transaction.items.filter((i) => i.isLoaner && !i.loanerReturned);

  async function handleConfirm() {
    if (!transaction) return;
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const body =
        itemIndex !== undefined
          ? { itemIndex }
          : { allReturned: true };

      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to mark returned');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark Loaner Returned" size="sm">
      <div className="px-6 py-4 space-y-4">
        {/* Transaction context */}
        <div className="bg-[var(--bg-input)] rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs text-[var(--tx-muted)]">Team</p>
          <p className="text-[var(--tx-primary)] font-semibold">
            Team {transaction.teamNumber} — {transaction.teamName}
          </p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">
            Contact: {transaction.contactName}
          </p>
        </div>

        {/* Items being marked returned */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--tx-muted)] uppercase tracking-wide">
            {targetItems.length === 1 ? 'Item to mark returned' : `${targetItems.length} items to mark returned`}
          </p>
          {targetItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--tx-primary)]">{item.partName}</p>
                <p className="text-xs text-[var(--tx-muted)] font-mono">{item.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--tx-primary)] font-semibold">×{item.quantity}</p>
                <p className="text-[10px] text-amber-400">Loaner</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[var(--bg-hover)] flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-[var(--tx-primary)] text-sm font-medium transition-colors disabled:opacity-60"
        >
          {loading ? (
            <Spinner size="sm" className="text-[var(--tx-primary)]" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          Confirm Return
        </button>
      </div>
    </Modal>
  );
}
