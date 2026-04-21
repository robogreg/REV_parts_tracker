'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ChevronDown, ChevronRight, RotateCcw, Filter } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Transaction, TransactionItem } from '@/lib/types';
import { formatDateTime, bytesToUtf8WithBom } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { TransactionTable } from '@/components/admin/TransactionTable';
import { LoanerReturnModal } from '@/components/admin/LoanerReturnModal';

const PAGE_SIZE = 50;

interface Filters {
  eventId: string;
  from: string;
  to: string;
  staffEmail: string;
  teamSearch: string;
  loaner: '' | 'true' | 'false';
}

interface TxResult {
  transactions: Transaction[];
  total: number;
}

async function fetchFilteredTransactions(filters: Filters, page: number): Promise<TxResult> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters.eventId) params.set('eventId', filters.eventId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.staffEmail) params.set('staffEmail', filters.staffEmail);
  if (filters.teamSearch) params.set('teamNumber', filters.teamSearch);
  if (filters.loaner) params.set('loaner', filters.loaner);
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(page * PAGE_SIZE));
  const res = await fetch(`/api/transactions?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function fetchAllForExport(filters: Filters): Promise<Transaction[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters.eventId) params.set('eventId', filters.eventId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.staffEmail) params.set('staffEmail', filters.staffEmail);
  if (filters.teamSearch) params.set('teamNumber', filters.teamSearch);
  if (filters.loaner) params.set('loaner', filters.loaner);
  params.set('limit', '10000');
  const res = await fetch(`/api/transactions?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.transactions;
}

function buildTransactionCsv(txns: Transaction[]): string {
  const header =
    'Timestamp,Staff,StaffEmail,TeamNumber,TeamName,Contact,ContactEmail,PartName,SKU,Qty,Loaner,Returned,Reason';
  const rows: string[] = [];
  for (const tx of txns) {
    for (const item of tx.items) {
      rows.push(
        [
          tx.timestamp,
          `"${tx.staffName}"`,
          tx.staffEmail,
          tx.teamNumber,
          `"${tx.teamName}"`,
          `"${tx.contactName}"`,
          tx.contactEmail,
          `"${item.partName}"`,
          item.sku,
          item.quantity,
          item.isLoaner ? 'yes' : 'no',
          item.loanerReturned ? 'yes' : 'no',
          `"${tx.reason ?? ''}"`,
        ].join(',')
      );
    }
  }
  return [header, ...rows].join('\n');
}

function buildLoanerCsv(txns: Transaction[]): string {
  const header = 'Timestamp,Staff,TeamNumber,TeamName,Contact,PartName,SKU,Qty,Returned';
  const rows: string[] = [];
  for (const tx of txns) {
    for (const item of tx.items) {
      if (!item.isLoaner) continue;
      rows.push(
        [
          tx.timestamp,
          `"${tx.staffName}"`,
          tx.teamNumber,
          `"${tx.teamName}"`,
          `"${tx.contactName}"`,
          `"${item.partName}"`,
          item.sku,
          item.quantity,
          item.loanerReturned ? 'yes' : 'no',
        ].join(',')
      );
    }
  }
  return [header, ...rows].join('\n');
}

function downloadCsv(content: string, filename: string) {
  const bytes = bytesToUtf8WithBom(content);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { data: events = [], isLoading: eventsLoading } = useEvents();

  const [filters, setFilters] = useState<Filters>({
    eventId: '',
    from: '',
    to: '',
    staffEmail: '',
    teamSearch: '',
    loaner: '',
  });
  const [page, setPage] = useState(0);
  const [loanersOpen, setLoanersOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<{ tx: Transaction; itemIndex?: number } | null>(
    null
  );
  const [exporting, setExporting] = useState(false);

  const queryClient = useQueryClient();

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['reports-transactions', filters, page],
    queryFn: () => fetchFilteredTransactions(filters, page),
  });

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;

  // Collect unique staff emails from visible transactions for the dropdown
  const staffOptions = useMemo(() => {
    return [...new Set(transactions.map((tx) => tx.staffEmail))].sort();
  }, [transactions]);

  // Unreturned loaners
  const unreturned = useMemo(() => {
    const result: { tx: Transaction; item: TransactionItem; itemIndex: number }[] = [];
    for (const tx of transactions) {
      tx.items.forEach((item, idx) => {
        if (item.isLoaner && !item.loanerReturned) {
          result.push({ tx, item, itemIndex: idx });
        }
      });
    }
    return result;
  }, [transactions]);

  async function handleExportAll() {
    setExporting(true);
    try {
      const all = await fetchAllForExport(filters);
      const csv = buildTransactionCsv(all);
      const event = events.find((e) => e.id === filters.eventId);
      downloadCsv(csv, `${event?.name ?? 'transactions'}-report.csv`);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportLoaners() {
    setExporting(true);
    try {
      const loanerFilters = { ...filters, loaner: 'true' as const };
      const all = await fetchAllForExport(loanerFilters);
      const csv = buildLoanerCsv(all);
      const event = events.find((e) => e.id === filters.eventId);
      downloadCsv(csv, `${event?.name ?? 'loaners'}-loaners.csv`);
    } finally {
      setExporting(false);
    }
  }

  const inputClass =
    'bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl px-3 py-2 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--tx-primary)]">Reports & Audit</h1>
          <p className="text-sm text-[var(--tx-muted)] mt-0.5">Transaction history and loaner tracking</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportAll}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors disabled:opacity-40"
          >
            {exporting ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            Export All CSV
          </button>
          <button
            onClick={handleExportLoaners}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export Loaners
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-[var(--tx-muted)]" />
          <span className="text-sm font-medium text-[var(--tx-primary)]">Filters</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Event */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">Event</label>
            {eventsLoading ? (
              <Spinner size="sm" />
            ) : (
              <select
                value={filters.eventId}
                onChange={(e) => setFilter('eventId', e.target.value)}
                className={inputClass + ' w-full'}
              >
                <option value="">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* From date */}
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter('from', e.target.value)}
              className={inputClass + ' w-full [color-scheme:dark]'}
            />
          </div>

          {/* To date */}
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter('to', e.target.value)}
              className={inputClass + ' w-full [color-scheme:dark]'}
            />
          </div>

          {/* Staff */}
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">Staff</label>
            <select
              value={filters.staffEmail}
              onChange={(e) => setFilter('staffEmail', e.target.value)}
              className={inputClass + ' w-full'}
            >
              <option value="">All staff</option>
              {staffOptions.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {/* Team search */}
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">Team #</label>
            <input
              type="text"
              value={filters.teamSearch}
              onChange={(e) => setFilter('teamSearch', e.target.value)}
              placeholder="e.g. 254"
              className={inputClass + ' w-full'}
            />
          </div>

          {/* Loaner filter */}
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">Loaner</label>
            <select
              value={filters.loaner}
              onChange={(e) => setFilter('loaner', e.target.value as Filters['loaner'])}
              className={inputClass + ' w-full'}
            >
              <option value="">All</option>
              <option value="true">Has loaners</option>
              <option value="false">No loaners</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {transactions.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl text-sm">
          <span className="text-[var(--tx-primary)] font-medium">
            Showing {transactions.length} of {total} transactions
          </span>
          <span className="text-[var(--tx-muted)]">·</span>
          <span className="text-[var(--tx-muted)]">
            {transactions.reduce((s, tx) => s + tx.totalItems, 0)} units
          </span>
          {unreturned.length > 0 && (
            <>
              <span className="text-[var(--tx-muted)]">·</span>
              <span className="text-amber-400 font-medium">
                {unreturned.length} unreturned loaner{unreturned.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      )}

      {/* Results table */}
      <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl overflow-hidden">
        <TransactionTable
          transactions={transactions}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={isLoading}
        />
      </div>

      {/* ── Unreturned loaners section ──────────────────────────────────── */}
      {filters.eventId && unreturned.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl overflow-hidden">
          <button
            onClick={() => setLoanersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-input)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-[var(--tx-primary)]">
                Unreturned Loaners ({unreturned.length})
              </span>
            </div>
            {loanersOpen ? (
              <ChevronDown className="w-5 h-5 text-[var(--tx-muted)]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[var(--tx-muted)]" />
            )}
          </button>

          {loanersOpen && (
            <div className="border-t border-[var(--bg-hover)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--bg-hover)] text-xs text-[var(--tx-muted)]">
                    <th className="text-left px-4 py-3 font-medium">Time</th>
                    <th className="text-left px-4 py-3 font-medium">Staff</th>
                    <th className="text-left px-4 py-3 font-medium">Team</th>
                    <th className="text-left px-4 py-3 font-medium">Part</th>
                    <th className="text-left px-4 py-3 font-medium">SKU</th>
                    <th className="text-center px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {unreturned.map(({ tx, item, itemIndex }, i) => (
                    <tr
                      key={`${tx.id}-${itemIndex}`}
                      className="border-b border-[var(--bg-hover)] last:border-0 hover:bg-[var(--bg-input)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[10px] text-[var(--tx-muted)] whitespace-nowrap">
                        {formatDateTime(tx.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-[var(--tx-primary)] text-xs">{tx.staffName}</td>
                      <td className="px-4 py-3">
                        <p className="text-[var(--tx-primary)] text-xs font-medium">Team {tx.teamNumber}</p>
                        <p className="text-[10px] text-[var(--tx-muted)]">{tx.contactName}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--tx-primary)] text-xs">{item.partName}</td>
                      <td className="px-4 py-3 text-[var(--tx-muted)] text-xs font-mono">{item.sku}</td>
                      <td className="px-4 py-3 text-center text-[var(--tx-primary)] text-xs">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setReturnTarget({ tx, itemIndex })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/50 border border-green-800/50 text-green-400 text-xs font-medium transition-colors ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Mark Returned
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Loaner Return Modal */}
      <LoanerReturnModal
        open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        transaction={returnTarget?.tx ?? null}
        itemIndex={returnTarget?.itemIndex}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['reports-transactions'] });
          setReturnTarget(null);
        }}
      />
    </div>
  );
}
