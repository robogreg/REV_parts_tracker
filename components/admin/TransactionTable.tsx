'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, RotateCcw } from 'lucide-react';
import { Transaction } from '@/lib/types';
import { formatDateTime, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

const PAGE_SIZE = 50;

interface TransactionTableProps {
  transactions: Transaction[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function TransactionTable({
  transactions,
  total,
  page,
  onPageChange,
  loading,
}: TransactionTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <EmptyState
        icon={Package}
        title="No transactions"
        description="No transactions match the current filters."
      />
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bg-hover)] text-[var(--tx-muted)] text-xs">
              <th className="w-8 px-2 py-3" />
              <th className="text-left px-3 py-3 font-medium">Timestamp</th>
              <th className="text-left px-3 py-3 font-medium">Staff</th>
              <th className="text-left px-3 py-3 font-medium">Team</th>
              <th className="text-center px-3 py-3 font-medium">Items</th>
              <th className="text-center px-3 py-3 font-medium">Units</th>
              <th className="text-center px-3 py-3 font-medium">Loaners</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isOpen = expanded.has(tx.id);
              const hasLoaners = tx.items.some((i) => i.isLoaner);
              const loanerCount = tx.items.filter((i) => i.isLoaner).length;

              return (
                <>
                  <tr
                    key={tx.id}
                    onClick={() => toggle(tx.id)}
                    className="border-b border-[var(--bg-hover)] hover:bg-[var(--bg-input)] cursor-pointer transition-colors"
                  >
                    <td className="px-2 py-3 text-[var(--tx-muted)]">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--tx-muted)] whitespace-nowrap text-xs">
                      {formatDateTime(tx.timestamp)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[var(--tx-primary)] font-medium">{tx.staffName}</p>
                      <p className="text-[10px] text-[var(--tx-muted)]">{tx.staffEmail}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[var(--tx-primary)] font-medium">Team {tx.teamNumber}</p>
                      <p className="text-[10px] text-[var(--tx-muted)] truncate max-w-[140px]">{tx.teamName}</p>
                    </td>
                    <td className="px-3 py-3 text-center text-[var(--tx-primary)]">{tx.items.length}</td>
                    <td className="px-3 py-3 text-center text-[var(--tx-primary)]">{tx.totalItems}</td>
                    <td className="px-3 py-3 text-center">
                      {hasLoaners ? (
                        <Badge variant="warning">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          {loanerCount}
                        </Badge>
                      ) : (
                        <span className="text-[var(--tx-muted)] text-xs">—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isOpen && (
                    <tr key={`${tx.id}-expanded`} className="bg-[var(--bg-deep)]">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="mb-2">
                          <p className="text-xs text-[var(--tx-muted)]">
                            Contact: <span className="text-[var(--tx-primary)]">{tx.contactName}</span>{' '}
                            {tx.contactEmail && (
                              <span className="text-[var(--tx-muted)]">({tx.contactEmail})</span>
                            )}
                          </p>
                          {tx.reason && (
                            <p className="text-xs text-[var(--tx-muted)] mt-0.5">
                              Reason: <span className="text-[var(--tx-primary)]">{tx.reason}</span>
                            </p>
                          )}
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[var(--tx-muted)] border-b border-[var(--bg-hover)]">
                              <th className="text-left py-1.5 font-medium">Part</th>
                              <th className="text-left py-1.5 font-medium">SKU</th>
                              <th className="text-center py-1.5 font-medium">Qty</th>
                              <th className="text-center py-1.5 font-medium">Loaner</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tx.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-[var(--bg-hover)]/50">
                                <td className="py-1.5 text-[var(--tx-primary)]">{item.partName}</td>
                                <td className="py-1.5 text-[var(--tx-muted)] font-mono">{item.sku}</td>
                                <td className="py-1.5 text-center text-[var(--tx-primary)]">{item.quantity}</td>
                                <td className="py-1.5 text-center">
                                  {item.isLoaner ? (
                                    <Badge variant={item.loanerReturned ? 'success' : 'warning'}>
                                      {item.loanerReturned ? 'Returned' : 'Out'}
                                    </Badge>
                                  ) : (
                                    <span className="text-[var(--tx-muted)]">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-hover)]">
          <p className="text-xs text-[var(--tx-muted)]">
            Page {page + 1} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-hover)] text-[var(--tx-primary)] disabled:opacity-40 hover:bg-[var(--bg-hover2)] transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-hover)] text-[var(--tx-primary)] disabled:opacity-40 hover:bg-[var(--bg-hover2)] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
