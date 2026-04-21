import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getEvents, createEvent, createAdminLog } from '@/lib/firestore';
import type { RevEvent } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

// GET /api/events?status=active&program=FRC
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const program = searchParams.get('program') ?? undefined;
    const events = await getEvents({ status, program });
    return NextResponse.json({ events });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/events (admin only)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const body = (await request.json()) as Omit<RevEvent, 'id' | 'createdAt'>;
    const event = await createEvent({ ...body, createdBy: auth.email });
    await createAdminLog({
      timestamp: new Date().toISOString(),
      action: 'CREATE_EVENT',
      performedBy: auth.email,
      eventId: event.id,
      details: { eventName: event.name },
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
