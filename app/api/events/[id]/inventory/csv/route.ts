import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-helpers';
import { getPartBySku, upsertPart, upsertInventoryItem } from '@/lib/firestore';
import { parseInventoryCsv } from '@/lib/csv-parser';
import { generateId } from '@/lib/utils';
import type { Part, InventoryItem } from '@/lib/types';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim());
  return adminEmails.includes(email);
}

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/events/:id/inventory/csv (admin only)
// Accepts multipart/form-data with field "file" containing a CSV
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { id: eventId } = await context.params;
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file field in form data' }, { status: 400 });
    }

    const text = await (file as File).text();
    const { items, errors } = parseInventoryCsv(text);

    let created = 0;
    let updated = 0;

    for (const parsed of items) {
      const partData = parsed.part;
      if (!partData.sku) continue;

      try {
        // Look up existing part by SKU
        let existingPart = await getPartBySku(partData.sku);
        let part: Part;

        if (!existingPart) {
          // Create new part
          part = {
            id: partData.id ?? generateId(),
            name: partData.name ?? '',
            sku: partData.sku,
            category: partData.category ?? 'General',
            description: partData.description,
            imageUrl: partData.imageUrl,
            packSize: partData.packSize ?? 1,
            packUnit: partData.packUnit,
            defaultLoaner: partData.defaultLoaner ?? false,
            msrp: partData.msrp,
            tags: partData.tags ?? [],
          };
          await upsertPart(part);
          created++;
        } else {
          part = existingPart;
          updated++;
        }

        const inventoryItem: InventoryItem = {
          id: part.id,
          eventId,
          part,
          quantityAvailable: parsed.quantityAvailable,
          quantityGiven: 0,
          isLoaner: parsed.isLoaner,
          lowStockThreshold: parsed.lowStockThreshold,
        };
        await upsertInventoryItem(eventId, inventoryItem);
      } catch (itemErr) {
        errors.push({
          row: -1,
          message: `Failed to process SKU "${partData.sku}": ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`,
        });
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch (err) {
    return handleApiError(err);
  }
}
