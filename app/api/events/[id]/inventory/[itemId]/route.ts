import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { updateInventoryItem, deleteInventoryItem } from '@/lib/firestore';
import type { InventoryItem } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

// PATCH /api/events/:id/inventory/:itemId
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id: eventId, itemId } = await context.params;
    const body = (await request.json()) as Partial<InventoryItem>;
    await updateInventoryItem(eventId, itemId, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/events/:id/inventory/:itemId
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id: eventId, itemId } = await context.params;
    await deleteInventoryItem(eventId, itemId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
