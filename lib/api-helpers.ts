import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';
import { getUserByUid } from './firestore';
import type { UserRole } from './types';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
}

export interface AuthUserWithRole extends AuthUser {
  role: UserRole;
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const email = decoded.email ?? '';
    if (!email.endsWith('@revrobotics.com')) {
      throw NextResponse.json({ error: 'Forbidden: REV accounts only' }, { status: 403 });
    }
    return {
      uid: decoded.uid,
      email,
      name: decoded.name ?? email,
    };
  } catch (err) {
    if (err instanceof NextResponse) throw err;
    throw NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

/** Requires the caller to have role 'manager' or 'superadmin'. */
export async function requireManager(request: NextRequest): Promise<AuthUserWithRole> {
  const authUser = await requireAuth(request);
  const stored = await getUserByUid(authUser.uid);
  if (!stored || stored.role === 'user') {
    throw NextResponse.json({ error: 'Forbidden: manager access required' }, { status: 403 });
  }
  return { ...authUser, role: stored.role };
}

/** Requires the caller to be the superadmin (greg@revrobotics.com). */
export async function requireSuperAdmin(request: NextRequest): Promise<AuthUserWithRole> {
  const authUser = await requireAuth(request);
  if (authUser.email !== 'greg@revrobotics.com') {
    throw NextResponse.json({ error: 'Forbidden: superadmin access required' }, { status: 403 });
  }
  return { ...authUser, role: 'superadmin' as UserRole };
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof NextResponse) return err;
  console.error('[API Error]', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}
