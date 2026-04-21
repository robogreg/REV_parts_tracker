import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import {
  getEvent,
  updateEvent,
  deleteEvent,
  saveInventorySnapshot,
  createAdminLog,
  getTransactions,
} from '@/lib/firestore';
import type { RevEvent } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

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

// PATCH /api/events/:id (admin only)
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
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

// DELETE /api/events/:id (admin only)
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id } = await context.params;

    // Refuse if any transactions reference this event
    const { transactions } = await getTransactions({ eventId: id, limit: 1 });
    if (transactions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete event: transactions exist for this event' },
        { status: 409 }
      );
    }

    await deleteEvent(id);

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
