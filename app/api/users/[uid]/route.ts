export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, handleApiError } from '@/lib/api-helpers';
import { updateUserRole } from '@/lib/firestore';
import type { UserRole } from '@/lib/types';

const VALID_ROLES: UserRole[] = ['user', 'manager', 'superadmin'];
const SUPER_ADMIN_EMAIL = 'greg@revrobotics.com';

/**
 * PATCH /api/users/[uid]
 * Updates a user's role. Superadmin only.
 * Cannot change the superadmin's own role.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await requireSuperAdmin(req);
    const { uid } = await params;
    const body = await req.json();
    const { role, email } = body as { role: UserRole; email?: string };

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Protect the superadmin account
    if (email === SUPER_ADMIN_EMAIL && role !== 'superadmin') {
      return NextResponse.json({ error: 'Cannot change superadmin role' }, { status: 403 });
    }

    await updateUserRole(uid, role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
