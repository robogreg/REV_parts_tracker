// FIRST Inspires API client
// Supports FRC (frc-events.firstinspires.org/v2.0) and FTC (ftc-events.firstinspires.org/v2.0)

import type { FirstEvent, FirstTeam } from './types';

const BASE_URLS = {
  FRC: 'https://frc-api.firstinspires.org/v2.0',
  FTC: 'https://ftc-api.firstinspires.org/v2.0',
} as const;

// Use Buffer (Node.js) rather than btoa (browser) for reliable server-side encoding.
function b64(s: string): string {
  return Buffer.from(s).toString('base64');
}

// Built-in credentials. Override by setting FIRST_API_KEY / FIRST_FTC_API_KEY env vars.
// Firestore settings are intentionally NOT checked — bad stored values previously caused 401s.
const BUILTIN_KEYS = {
  FRC: b64('revrobotics:8991c9cf-74bd-4be6-a055-888ddab9b8f8'),
  FTC: b64('revrobotics:F1BF26C0-AC76-4864-85EE-200FDC0F2F5C'),
};

function getAuthHeader(program: 'FRC' | 'FTC'): string {
  if (program === 'FTC') {
    const envKey = process.env.FIRST_FTC_API_KEY;
    return `Basic ${envKey ?? BUILTIN_KEYS.FTC}`;
  }
  const envKey = process.env.FIRST_API_KEY;
  return `Basic ${envKey ?? BUILTIN_KEYS.FRC}`;
}

// ─── Server-side event cache (Firestore, 24 h TTL) ───────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getCachedEvents(program: 'FRC' | 'FTC', season: number): Promise<FirstEvent[] | null> {
  try {
    const { adminDb } = await import('./firebase-admin');
    const key = `${program}_${season}`;
    const snap = await adminDb().collection('firstEventsCache').doc(key).get();
    if (!snap.exists) return null;
    const { events, cachedAt } = snap.data() as { events: FirstEvent[]; cachedAt: string };
    if (Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS) return null;
    return events;
  } catch {
    return null; // cache miss is non-fatal
  }
}

async function setCachedEvents(program: 'FRC' | 'FTC', season: number, events: FirstEvent[]): Promise<void> {
  try {
    const { adminDb } = await import('./firebase-admin');
    const key = `${program}_${season}`;
    await adminDb().collection('firstEventsCache').doc(key).set({
      events,
      cachedAt: new Date().toISOString(),
    });
  } catch {
    // non-fatal — live data already returned
  }
}

async function firstFetch<T>(program: 'FRC' | 'FTC', path: string): Promise<T> {
  const url = `${BASE_URLS[program]}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(program),
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Strip HTML tags to surface a clean message
    const clean = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    throw new Error(`FIRST ${program} API error ${res.status}: ${clean || '(no body)'}`);
  }
  return res.json() as Promise<T>;
}

// ─── FRC response shapes ──────────────────────────────────────────────────────

interface FrcEventsResponse {
  Events: FrcEventRaw[];
  eventCount: number;
  pageCurrent?: number;
  pageTotal?: number;
}

interface FrcEventRaw {
  code: string;
  name: string;
  type: string;
  dateStart: string;
  dateEnd: string;
  stateprov?: string;
  country?: string;
  city?: string;
  venue?: string;
}

interface FrcTeamsResponse {
  teams: FrcTeamRaw[];
  teamCountTotal: number;
  pageCurrent?: number;
  pageTotal?: number;
}

interface FrcTeamRaw {
  teamNumber: number;
  nameShort: string;
  nameFull?: string;
  city?: string;
  stateProv?: string;
  country?: string;
  schoolName?: string;
}

// ─── FTC response shapes ──────────────────────────────────────────────────────

interface FtcEventsResponse {
  events?: FtcEventRaw[];   // lowercase (v2 spec)
  Events?: FtcEventRaw[];   // uppercase fallback
  eventCount: number;
  pageCurrent?: number;
  pageTotal?: number;
}

interface FtcEventRaw {
  code: string;
  name: string;
  type: string;
  dateStart: string;
  dateEnd: string;
  stateprov?: string;
  country?: string;
  city?: string;
  venue?: string;
}

interface FtcTeamsResponse {
  teams?: FtcTeamRaw[];   // lowercase (v2 spec)
  Teams?: FtcTeamRaw[];   // uppercase fallback
  teamCountTotal?: number;
  teamCount?: number;
  pageCurrent?: number;
  pageTotal?: number;
}

interface FtcTeamRaw {
  teamNumber: number | string;
  nameShort: string;
  nameFull?: string;
  city?: string;
  stateProv?: string;
  country?: string;
  schoolName?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getFirstEvents(
  program: 'FRC' | 'FTC',
  season: number
): Promise<FirstEvent[]> {
  // Check Firestore cache first (24 h TTL — events don't change intra-day)
  const cached = await getCachedEvents(program, season);
  if (cached) return cached;

  const allEvents: FirstEvent[] = [];

  if (program === 'FRC') {
    let page = 1;
    let pageTotal = 1;
    do {
      const data = await firstFetch<FrcEventsResponse>(
        'FRC',
        `/${season}/events?page=${page}`
      );
      pageTotal = data.pageTotal ?? 1;
      for (const e of data.Events ?? []) {
        allEvents.push({
          code: e.code,
          name: e.name,
          type: e.type,
          startDate: e.dateStart,
          endDate: e.dateEnd,
          stateprov: e.stateprov,
          country: e.country,
          city: e.city,
          venue: e.venue,
          season,
          program: 'FRC',
        });
      }
      page++;
    } while (page <= pageTotal);
  } else {
    let page = 1;
    let pageTotal = 1;
    do {
      const data = await firstFetch<FtcEventsResponse>(
        'FTC',
        `/${season}/events?page=${page}`
      );
      pageTotal = data.pageTotal ?? 1;
      for (const e of data.events ?? data.Events ?? []) {
        allEvents.push({
          code: e.code,
          name: e.name,
          type: e.type,
          startDate: e.dateStart,
          endDate: e.dateEnd,
          stateprov: e.stateprov,
          country: e.country,
          city: e.city,
          venue: e.venue,
          season,
          program: 'FTC',
        });
      }
      page++;
    } while (page <= pageTotal);
  }

  // Store in cache for next request
  void setCachedEvents(program, season, allEvents);

  return allEvents;
}

export async function getFirstTeams(
  program: 'FRC' | 'FTC',
  season: number,
  eventCode: string
): Promise<FirstTeam[]> {
  const allTeams: FirstTeam[] = [];

  if (program === 'FRC') {
    let page = 1;
    let pageTotal = 1;
    do {
      const data = await firstFetch<FrcTeamsResponse>(
        'FRC',
        `/${season}/teams?eventCode=${eventCode}&page=${page}`
      );
      pageTotal = data.pageTotal ?? 1;
      for (const t of data.teams ?? []) {
        allTeams.push({
          teamNumber: t.teamNumber,
          nameShort: t.nameShort,
          nameFull: t.nameFull,
          city: t.city,
          stateProv: t.stateProv,
          country: t.country,
          schoolName: t.schoolName,
        });
      }
      page++;
    } while (page <= pageTotal);
  } else {
    let page = 1;
    let pageTotal = 1;
    do {
      const data = await firstFetch<FtcTeamsResponse>(
        'FTC',
        `/${season}/teams?eventCode=${eventCode}&page=${page}`
      );
      pageTotal = data.pageTotal ?? 1;
      for (const t of data.teams ?? data.Teams ?? []) {
        allTeams.push({
          teamNumber: t.teamNumber,
          nameShort: t.nameShort,
          nameFull: t.nameFull,
          city: t.city,
          stateProv: t.stateProv,
          country: t.country,
          schoolName: t.schoolName,
        });
      }
      page++;
    } while (page <= pageTotal);
  }

  return allTeams;
}

export const firstApiClient = { getFirstEvents, getFirstTeams };
