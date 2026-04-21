// FIRST Inspires API client
// Supports FRC (frc-events.firstinspires.org/v2.0) and FTC (ftc-events.firstinspires.org/v2.0)

import type { FirstEvent, FirstTeam } from './types';

const BASE_URLS = {
  FRC: 'https://frc-events.firstinspires.org/v2.0',
  FTC: 'https://ftc-events.firstinspires.org/v2.0',
} as const;

// FIRST_API_KEY should be the already-base64-encoded "username:authToken" string
function getAuthHeader(): string {
  const key = process.env.FIRST_API_KEY;
  if (!key) throw new Error('FIRST_API_KEY environment variable is not set');
  return `Basic ${key}`;
}

async function firstFetch<T>(program: 'FRC' | 'FTC', path: string): Promise<T> {
  const url = `${BASE_URLS[program]}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`FIRST API error ${res.status} for ${url}: ${body}`);
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
  events: FtcEventRaw[];
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
  teams: FtcTeamRaw[];
  teamCountTotal: number;
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
      for (const e of data.events ?? []) {
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
  }

  return allTeams;
}

export const firstApiClient = { getFirstEvents, getFirstTeams };
