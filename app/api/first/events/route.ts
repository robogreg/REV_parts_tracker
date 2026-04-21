import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getFirstEvents } from '@/lib/first-api';

// GET /api/first/events?program=FRC&season=2025
// Proxies FIRST API events. Response cached for 1 hour via Next.js revalidation.
export const revalidate = 3600;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const program = searchParams.get('program');
    const seasonParam = searchParams.get('season');

    if (!program || (program !== 'FRC' && program !== 'FTC')) {
      return NextResponse.json(
        { error: 'program query param is required and must be FRC or FTC' },
        { status: 400 }
      );
    }
    if (!seasonParam) {
      return NextResponse.json({ error: 'season query param is required' }, { status: 400 });
    }

    const season = parseInt(seasonParam, 10);
    if (isNaN(season)) {
      return NextResponse.json({ error: 'season must be a valid number' }, { status: 400 });
    }

    const events = await getFirstEvents(program, season);
    return NextResponse.json({ events });
  } catch (err) {
    return handleApiError(err);
  }
}
