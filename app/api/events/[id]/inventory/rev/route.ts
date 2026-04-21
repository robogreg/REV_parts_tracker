import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getPartBySku, upsertPart, upsertInventoryItem } from '@/lib/firestore';
import { getRevProducts, getRevCategories } from '@/lib/rev-api';
import type { InventoryItem } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

interface RevImportBody {
  mode: 'all' | 'categories';
  categories?: string[]; // category names or stringified IDs
}

// POST /api/events/:id/inventory/rev (admin only)
// Imports parts from the REV BigCommerce catalog into the event inventory
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { id: eventId } = await context.params;
    const body = (await request.json()) as RevImportBody;

    let categoryIds: number[] | undefined;

    if (body.mode === 'categories' && body.categories && body.categories.length > 0) {
      // Resolve category names to IDs if needed
      const allCategories = await getRevCategories();
      categoryIds = body.categories
        .map((c) => {
          const asNum = parseInt(c, 10);
          if (!isNaN(asNum)) return asNum;
          const match = allCategories.find(
            (cat) => cat.name.toLowerCase() === c.toLowerCase()
          );
          return match?.id ?? null;
        })
        .filter((id): id is number => id !== null);
    }

    const parts = await getRevProducts(categoryIds);
    let added = 0;

    for (const part of parts) {
      // Check if part already exists in the global catalog
      const existing = await getPartBySku(part.sku);
      const catalogPart = existing ?? part;

      if (!existing) {
        await upsertPart(part);
      }

      // Create inventory item with quantityAvailable = 0
      const inventoryItem: InventoryItem = {
        id: catalogPart.id,
        eventId,
        part: catalogPart,
        quantityAvailable: 0,
        quantityGiven: 0,
        isLoaner: catalogPart.defaultLoaner,
      };
      await upsertInventoryItem(eventId, inventoryItem);
      added++;
    }

    return NextResponse.json({ added });
  } catch (err) {
    return handleApiError(err);
  }
}
