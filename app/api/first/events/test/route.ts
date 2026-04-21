import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const BASE_URLS = {
  FRC: 'https://frc-api.firstinspires.org/v2.0',
  FTC: 'https://ftc-events.firstinspires.org/v2.0',
} as const;

// GET /api/first/events/test?program=FRC&season=2026&key=<base64>
// Tests a FIRST API key without saving it. Returns { ok, message }.
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const program = searchParams.get('program');
    const seasonParam = searchParams.get('season');
    const key = searchParams.get('key');

    if (!program || (program !== 'FRC' && program !== 'FTC')) {
      return NextResponse.json({ ok: false, message: 'Invalid program' }, { status: 400 });
    }
    if (!key) {
      return NextResponse.json({ ok: false, message: 'No key provided' }, { status: 400 });
    }

    const season = parseInt(seasonParam ?? String(new Date().getFullYear()), 10);
    const url = `${BASE_URLS[program]}/${season}/events?page=1`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${key}`,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json() as { eventCount?: number; Events?: unknown[]; events?: unknown[] };
      const count = data.eventCount ?? (data.Events ?? data.events ?? []).length;
      return NextResponse.json({
        ok: true,
        message: `Connected successfully — ${count} ${program} ${season} events found`,
      });
    }

    const body = await res.text().catch(() => '');
    // Truncate long HTML error bodies
    const snippet = body.slice(0, 200).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return NextResponse.json({
      ok: false,
      message: `${program} API returned ${res.status}${snippet ? ': ' + snippet : ''}`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
