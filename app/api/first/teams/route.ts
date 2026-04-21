import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getFirstTeams } from '@/lib/first-api';

// GET /api/first/teams?program=FRC&season=2025&eventCode=TXHOU
// Proxies FIRST API teams for a given event (all pages fetched server-side)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const program = searchParams.get('program');
    const seasonParam = searchParams.get('season');
    const eventCode = searchParams.get('eventCode');

    if (!program || (program !== 'FRC' && program !== 'FTC')) {
      return NextResponse.json(
        { error: 'program query param is required and must be FRC or FTC' },
        { status: 400 }
      );
    }
    if (!seasonParam) {
      return NextResponse.json({ error: 'season query param is required' }, { status: 400 });
    }
    if (!eventCode) {
      return NextResponse.json({ error: 'eventCode query param is required' }, { status: 400 });
    }

    const season = parseInt(seasonParam, 10);
    if (isNaN(season)) {
      return NextResponse.json({ error: 'season must be a valid number' }, { status: 400 });
    }

    const teams = await getFirstTeams(program, season, eventCode);
    return NextResponse.json({ teams });
  } catch (err) {
    return handleApiError(err);
  }
}
