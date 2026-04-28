import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireManager, handleApiError } from '@/lib/api-helpers';
import {
  getEvent,
  updateEvent,
  deleteEventCascade,
  saveInventorySnapshot,
  createAdminLog,
} from '@/lib/firestore';
import type { RevEvent } from '@/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/events/:id
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { id } = await context.params;
    const event = await getEvent(id);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ event });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/events/:id (manager+ only)
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireManager(request);
    const { id } = await context.params;
    const body = (await request.json()) as Partial<RevEvent>;

    // Snapshot inventory when event is being closed
    if (body.status === 'closed') {
      await saveInventorySnapshot(id);
    }

    await updateEvent(id, body);

    await createAdminLog({
      timestamp: new Date().toISOString(),
      action: 'UPDATE_EVENT',
      performedBy: auth.email,
      eventId: id,
      details: { changes: body },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/events/:id (manager+ only)
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireManager(request);
    const { id } = await context.params;

    // Cascade-deletes the event doc, inventory subcollection, teams subcollection,
    // and all transactions for this event
    await deleteEventCascade(id);

    await createAdminLog({
      timestamp: new Date().toISOString(),
      action: 'DELETE_EVENT',
      performedBy: auth.email,
      eventId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
