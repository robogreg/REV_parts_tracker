import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { upsertTeam } from '@/lib/firestore';
import { getFirstTeams } from '@/lib/first-api';
import type { Team, Program } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

interface FirstTeamsBody {
  program: 'FRC' | 'FTC';
  season: number;
  eventCode: string;
}

// POST /api/events/:id/teams/first (admin only)
// Fetches teams from FIRST API and upserts them into Firestore
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { id: eventId } = await context.params;
    const body = (await request.json()) as FirstTeamsBody;
    const { program, season, eventCode } = body;

    if (!program || !season || !eventCode) {
      return NextResponse.json(
        { error: 'program, season, and eventCode are required' },
        { status: 400 }
      );
    }

    const firstTeams = await getFirstTeams(program, season, eventCode);
    let added = 0;
    let updated = 0;

    for (const ft of firstTeams) {
      const teamId = `${eventId}_${ft.teamNumber}`;
      const team: Team = {
        id: teamId,
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
      // Treat all as "added" in this pass (upsert semantics; would need a pre-check for added vs updated)
      added++;
    }

    return NextResponse.json({ added, updated, total: firstTeams.length });
  } catch (err) {
    return handleApiError(err);
  }
}
