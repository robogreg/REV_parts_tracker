import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/firebase-client';
import { RevEvent } from '@/lib/types';

async function fetchEvents(status?: string): Promise<RevEvent[]> {
  const headers = await getAuthHeaders();
  const url = status ? `/api/events?status=${status}` : '/api/events';
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  return data.events;
}

export function useEvents(status?: string) {
  return useQuery({
    queryKey: ['events', status],
    queryFn: () => fetchEvents(status),
  });
}
