export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, handleApiError } from '@/lib/api-helpers';
import { getUsers } from '@/lib/firestore';

/**
 * GET /api/users
 * Returns all users who have ever logged in. Superadmin only.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}
