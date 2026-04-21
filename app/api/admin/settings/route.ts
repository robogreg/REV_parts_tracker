import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getSettings, updateSettings, AppSettings } from '@/lib/firestore';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'greg@revrobotics.com';

function isSuperAdmin(email: string): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

// GET /api/admin/settings — returns current settings (API keys masked)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isSuperAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getSettings();

    // Mask the actual key values — only expose whether they are set
    return NextResponse.json({
      firstApiKeySet: !!settings.firstApiKey,
      firstFtcApiKeySet: !!settings.firstFtcApiKey,
      bigcommerceStoreHash: settings.bigcommerceStoreHash ?? '',
      bigcommerceApiTokenSet: !!settings.bigcommerceApiToken,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// PUT /api/admin/settings — save/update API credentials
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isSuperAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as Partial<AppSettings>;

    // Only allow known keys; strip empties so they don't overwrite existing values
    const patch: Partial<AppSettings> = {};
    if (body.firstApiKey !== undefined && body.firstApiKey !== '') {
      patch.firstApiKey = body.firstApiKey;
    }
    if (body.firstFtcApiKey !== undefined && body.firstFtcApiKey !== '') {
      patch.firstFtcApiKey = body.firstFtcApiKey;
    }
    if (body.bigcommerceStoreHash !== undefined && body.bigcommerceStoreHash !== '') {
      patch.bigcommerceStoreHash = body.bigcommerceStoreHash;
    }
    if (body.bigcommerceApiToken !== undefined && body.bigcommerceApiToken !== '') {
      patch.bigcommerceApiToken = body.bigcommerceApiToken;
    }

    await updateSettings(patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/settings — clear a specific key
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isSuperAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { key } = await request.json() as { key: keyof AppSettings };
    const allowed: (keyof AppSettings)[] = ['firstApiKey', 'firstFtcApiKey', 'bigcommerceStoreHash', 'bigcommerceApiToken'];
    if (!allowed.includes(key)) {
      return NextResponse.json({ error: 'Unknown key' }, { status: 400 });
    }

    await updateSettings({ [key]: '' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
