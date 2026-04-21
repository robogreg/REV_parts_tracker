'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Receipt,
  Package,
  RotateCcw,
  Users,
  UserCheck,
} from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Transaction, RevEvent } from '@/lib/types';
import { formatDateTime, cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { StatsCards, StatCard } from '@/components/admin/StatsCards';
import { TransactionTable } from '@/components/admin/TransactionTable';

async function fetchTransactions(eventId: string, limit = 20): Promise<{ transactions: Transaction[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/transactions?eventId=${eventId}&limit=${limit}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export default function AdminDashboard() {
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Auto-select most recent active event
  const activeEvent = useMemo(() => {
    if (selectedEventId) return events.find((e) => e.id === selectedEventId) ?? null;
    const active = events.find((e) => e.status === 'active');
    return active ?? events[0] ?? null;
  }, [events, selectedEventId]);

  const effectiveEventId = selectedEventId || activeEvent?.id || '';

  const { data, isLoading: txLoading } = useQuery({
    queryKey: ['admin-dashboard-transactions', effectiveEventId],
    queryFn: () => fetchTransactions(effectiveEventId, 20),
    enabled: !!effectiveEventId,
  });

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;

  // Compute stats
  const stats = useMemo(() => {
    const totalUnits = transactions.reduce((s, tx) => s + tx.totalItems, 0);
    const totalLoaners = transactions.reduce(
      (s, tx) => s + tx.items.filter((i) => i.isLoaner).length,
      0
    );
    const uniqueTeams = new Set(transactions.map((tx) => String(tx.teamNumber))).size;
    const uniqueStaff = new Set(transactions.map((tx) => tx.staffEmail)).size;
    return { totalUnits, totalLoaners, uniqueTeams, uniqueStaff };
  }, [transactions]);

  // Top 10 parts by unit count
  const chartData = useMemo(() => {
    const partMap = new Map<string, { name: string; units: number }>();
    for (const tx of transactions) {
      for (const item of tx.items) {
        const existing = partMap.get(item.partId);
        if (existing) {
          existing.units += item.quantity;
        } else {
          partMap.set(item.partId, { name: item.partName, units: item.quantity });
        }
      }
    }
    return Array.from(partMap.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 10)
      .map((p) => ({ ...p, name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name }));
  }, [transactions]);

  const statCards: StatCard[] = [
    { icon: Receipt, label: 'Total Transactions', value: total, accent: true },
    { icon: Package, label: 'Total Units', value: stats.totalUnits },
    { icon: RotateCcw, label: 'Total Loaners', value: stats.totalLoaners },
    { icon: Users, label: 'Unique Teams', value: stats.uniqueTeams },
    { icon: UserCheck, label: 'Unique Staff', value: stats.uniqueStaff },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[#9CA3AF] mt-0.5">Event performance overview</p>
        </div>

        {/* Event selector */}
        <div className="flex items-center gap-2">
          {eventsLoading ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={effectiveEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-[#1A1A1A] border border-[#2E2E2E] text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-[#FF6B00] transition-colors"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!effectiveEventId ? (
        <div className="text-center py-20 text-[#9CA3AF]">No events found. Create one first.</div>
      ) : (
        <>
          {/* Stats */}
          <StatsCards cards={statCards} />

          {/* Chart + Table side-by-side on xl */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl p-5">
              <h2 className="text-base font-semibold text-white mb-4">
                Top 10 Parts by Units Given
              </h2>
              {txLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : chartData.length === 0 ? (
                <p className="text-[#9CA3AF] text-sm text-center py-12">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: '#9CA3AF', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1A1A1A',
                        border: '1px solid #2E2E2E',
                        borderRadius: 8,
                        color: '#F5F5F5',
                        fontSize: 12,
                      }}
                      cursor={{ fill: '#2E2E2E' }}
                    />
                    <Bar dataKey="units" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? '#FF6B00' : `rgba(255,107,0,${Math.max(0.3, 1 - i * 0.08)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Recent transactions */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2E2E2E]">
                <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Last 20 for this event</p>
              </div>
              {txLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2E2E2E] text-xs text-[#9CA3AF]">
                        <th className="text-left px-4 py-3 font-medium">Time</th>
                        <th className="text-left px-4 py-3 font-medium">Staff</th>
                        <th className="text-left px-4 py-3 font-medium">Team</th>
                        <th className="text-center px-4 py-3 font-medium">Items</th>
                        <th className="text-center px-4 py-3 font-medium">Loaner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-[#9CA3AF]">
                            No transactions yet.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => {
                          const hasLoaners = tx.items.some((i) => i.isLoaner);
                          return (
                            <tr
                              key={tx.id}
                              className="border-b border-[#2E2E2E] hover:bg-[#242424] transition-colors"
                            >
                              <td className="px-4 py-2.5 text-[10px] text-[#9CA3AF] whitespace-nowrap">
                                {formatDateTime(tx.timestamp)}
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="text-white text-xs">{tx.staffName}</p>
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="text-white text-xs font-medium">#{tx.teamNumber}</p>
                              </td>
                              <td className="px-4 py-2.5 text-center text-white text-xs">
                                {tx.items.length}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {hasLoaners ? (
                                  <Badge variant="warning">Yes</Badge>
                                ) : (
                                  <span className="text-[#9CA3AF] text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
