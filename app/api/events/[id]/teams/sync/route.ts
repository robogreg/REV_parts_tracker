import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getEvent, upsertTeam } from '@/lib/firestore';
import { getFirstTeams } from '@/lib/first-api';
import type { Team, Program } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/events/:id/teams/sync
// Syncs teams from FIRST using the event's firstEventCode and firstSeason.
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { id: eventId } = await context.params;
    const event = await getEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (!event.firstEventCode || !event.firstSeason) {
      return NextResponse.json(
        { error: 'Event has no FIRST event code or season configured' },
        { status: 400 }
      );
    }

    const program = event.program === 'FTC' ? 'FTC' : 'FRC';
    const firstTeams = await getFirstTeams(program, event.firstSeason, event.firstEventCode);
    let synced = 0;

    for (const ft of firstTeams) {
      const team: Team = {
        id: `${eventId}_${ft.teamNumber}`,
        eventId,
        teamNumber: ft.teamNumber,
        teamName: ft.nameShort,
        program: program as Program,
        city: ft.city,
        state: ft.stateProv,
        country: ft.country,
        school: ft.schoolName,
      };
      await upsertTeam(eventId, team);
      synced++;
    }

    return NextResponse.json({ synced, total: firstTeams.length });
  } catch (err) {
    return handleApiError(err);
  }
}
