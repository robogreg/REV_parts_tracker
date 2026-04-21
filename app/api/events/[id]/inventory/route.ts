import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getInventory, upsertInventoryItem } from '@/lib/firestore';
import type { InventoryItem } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/events/:id/inventory
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { id: eventId } = await context.params;
    const inventory = await getInventory(eventId);
    return NextResponse.json({ inventory });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/events/:id/inventory (admin only)
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id: eventId } = await context.params;
    const body = (await request.json()) as Omit<InventoryItem, 'eventId'>;
    await upsertInventoryItem(eventId, { ...body, eventId });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
