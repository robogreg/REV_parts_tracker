import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getEvent, upsertTeam } from '@/lib/firestore';
import { parseTeamsCsv } from '@/lib/csv-parser';
import type { Team, Program } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/events/:id/teams/csv (admin only)
// Accepts multipart/form-data with field "file" containing a CSV
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { id: eventId } = await context.params;

    // Get event to determine default program
    const event = await getEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const defaultProgram: Program = event.program;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file field in form data' }, { status: 400 });
    }

    const text = await (file as File).text();
    const { teams: parsedTeams, errors } = parseTeamsCsv(text, defaultProgram);

    let created = 0;
    let updated = 0;

    for (const partial of parsedTeams) {
      if (!partial.teamNumber) continue;
      const teamId = `${eventId}_${partial.teamNumber}`;
      const team: Team = {
        teamNumber: partial.teamNumber,
        teamName: partial.teamName ?? String(partial.teamNumber),
        program: partial.program ?? defaultProgram,
        city: partial.city,
        state: partial.state,
        country: partial.country,
        school: partial.school,
        id: teamId,
        eventId,
      };

      // Treat all CSV upserts as potentially new (firestore setDoc is always upsert)
      // We track created vs updated by checking prior existence would need extra reads;
      // keeping it simple: count each as created since it's an import flow.
      try {
        await upsertTeam(eventId, team);
        created++;
      } catch (itemErr) {
        errors.push({
          row: -1,
          message: `Failed to upsert team ${partial.teamNumber}: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`,
        });
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch (err) {
    return handleApiError(err);
  }
}
