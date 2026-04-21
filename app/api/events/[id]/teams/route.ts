import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getTeams, upsertTeam, deleteTeam } from '@/lib/firestore';
import type { Team } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/events/:id/teams
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { id: eventId } = await context.params;
    const teams = await getTeams(eventId);
    return NextResponse.json({ teams });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/events/:id/teams (admin only) — upsert a single team
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id: eventId } = await context.params;
    const body = (await request.json()) as Partial<Team>;

    if (!body.teamNumber) {
      return NextResponse.json({ error: 'teamNumber is required' }, { status: 400 });
    }

    const team: Team = {
      teamNumber: body.teamNumber,
      teamName: body.teamName ?? String(body.teamNumber),
      program: body.program ?? 'FRC',
      city: body.city,
      state: body.state,
      country: body.country,
      school: body.school,
      ...body,
      id: `${eventId}_${body.teamNumber}`,
      eventId,
    };

    await upsertTeam(eventId, team);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/events/:id/teams?teamId=... (admin only)
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id: eventId } = await context.params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    if (!teamId) {
      return NextResponse.json({ error: 'teamId query param is required' }, { status: 400 });
    }
    await deleteTeam(eventId, teamId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
