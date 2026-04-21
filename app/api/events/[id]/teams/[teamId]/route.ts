import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { deleteTeam } from '@/lib/firestore';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string; teamId: string }> };

// DELETE /api/events/:id/teams/:teamId
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }
    const { id: eventId, teamId } = await context.params;
    await deleteTeam(eventId, teamId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
