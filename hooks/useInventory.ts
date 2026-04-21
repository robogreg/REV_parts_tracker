import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/firebase-client';
import { InventoryItem } from '@/lib/types';

async function fetchInventory(eventId: string): Promise<InventoryItem[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/events/${eventId}/inventory`, { headers });
  if (!res.ok) throw new Error('Failed to fetch inventory');
  const data = await res.json();
  return data.inventory;
}

export function useInventory(eventId: string | undefined) {
  return useQuery({
    queryKey: ['inventory', eventId],
    queryFn: () => fetchInventory(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });
}
