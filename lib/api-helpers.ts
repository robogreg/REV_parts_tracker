import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
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

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof NextResponse) return err;
  console.error('[API Error]', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}
