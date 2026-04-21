import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Transaction } from '@/lib/types';

interface TransactionFilters {
  eventId?: string;
  staffEmail?: string;
  teamNumber?: string;
  from?: string;
  to?: string;
  loaner?: boolean;
  limit?: number;
  offset?: number;
}

async function fetchTransactions(
  filters: TransactionFilters
): Promise<{ transactions: Transaction[]; total: number }> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters.eventId) params.set('eventId', filters.eventId);
  if (filters.staffEmail) params.set('staffEmail', filters.staffEmail);
  if (filters.teamNumber) params.set('teamNumber', filters.teamNumber);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.loaner !== undefined) params.set('loaner', String(filters.loaner));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const res = await fetch(`/api/transactions?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    enabled: !!filters.eventId,
  });
}
