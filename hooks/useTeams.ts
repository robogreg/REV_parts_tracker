import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Team } from '@/lib/types';

async function fetchTeams(eventId: string): Promise<Team[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/events/${eventId}/teams`, { headers });
  if (!res.ok) throw new Error('Failed to fetch teams');
  const data = await res.json();
  return data.teams;
}

export function useTeams(eventId: string | undefined) {
  return useQuery({
    queryKey: ['teams', eventId],
    queryFn: () => fetchTeams(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
}
