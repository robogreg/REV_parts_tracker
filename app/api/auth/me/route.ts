export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { upsertUserLogin } from '@/lib/firestore';

/**
 * GET /api/auth/me
 * Called by AuthProvider on every login. Upserts the user's Firestore record
 * and returns their current role.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    // Extract photo URL from the token (it's in the "picture" claim)
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.slice(7);

    // Parse photo from token payload (middle base64 segment)
    let photoUrl: string | undefined;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      photoUrl = payload.picture ?? undefined;
    } catch {
      // ignore — photo is optional
    }

    const stored = await upsertUserLogin({
      uid: authUser.uid,
      email: authUser.email,
      name: authUser.name,
      photoUrl,
    });

    return NextResponse.json({ role: stored.role });
  } catch (err) {
    return handleApiError(err);
  }
}
