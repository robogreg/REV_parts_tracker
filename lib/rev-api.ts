// REV Robotics BigCommerce API client
// Base: https://api.bigcommerce.com/stores/${BIGCOMMERCE_STORE_HASH}/v3

import type { Part, BigCommerceProduct, BigCommerceCategory } from './types';
import { generateId } from './utils';

// Falls back to Firestore config/settings when env vars are absent.
async function getBigCommerceConfig(): Promise<{ baseUrl: string; headers: HeadersInit }> {
  let storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  let token = process.env.BIGCOMMERCE_API_TOKEN;

  if (!storeHash || !token) {
    const { getSettings } = await import('./firestore');
    const settings = await getSettings();
    storeHash = storeHash || settings.bigcommerceStoreHash;
    token = token || settings.bigcommerceApiToken;
  }

  if (!storeHash) throw new Error('BigCommerce store hash is not configured. Visit Admin → Settings to add it.');
  if (!token) throw new Error('BigCommerce API token is not configured. Visit Admin → Settings to add it.');

  return {
    baseUrl: `https://api.bigcommerce.com/stores/${storeHash}/v3`,
    headers: {
      'X-Auth-Token': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };
}

// Keep sync wrappers for backward compatibility — callers must await getBigCommerceConfig() instead.
function getBaseUrl(): string {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  if (!storeHash) throw new Error('BIGCOMMERCE_STORE_HASH environment variable is not set');
  return `https://api.bigcommerce.com/stores/${storeHash}/v3`;
}

function getAuthHeaders(): HeadersInit {
  const token = process.env.BIGCOMMERCE_API_TOKEN;
  if (!token) throw new Error('BIGCOMMERCE_API_TOKEN environment variable is not set');
  return {
    'X-Auth-Token': token,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// ─── BigCommerce response shapes ──────────────────────────────────────────────

interface BcProductsResponse {
  data: BigCommerceProduct[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}

interface BcCategoriesResponse {
  data: BigCommerceCategory[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}

// ─── Category name cache ──────────────────────────────────────────────────────

async function fetchCategoryMap(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const { baseUrl: base, headers } = await getBigCommerceConfig();
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${base}/catalog/categories?page=${page}&limit=250`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`BigCommerce categories error ${res.status}: ${body}`);
    }
    const data: BcCategoriesResponse = await res.json();
    totalPages = data.meta.pagination.total_pages;
    for (const cat of data.data) {
      map.set(cat.id, cat.name);
    }
    page++;
  } while (page <= totalPages);

  return map;
}

// ─── Categories to exclude from import ───────────────────────────────────────

const EXCLUDED_CATEGORY_NAMES = new Set([
  'hidden products',
  'disc products',
  'discontinued products',
  'customer support products',
  'marketing products',
  'internal products',
]);

function isExcludedCategory(categoryIds: number[], categoryMap: Map<number, string>): boolean {
  return categoryIds.some((id) => {
    const name = (categoryMap.get(id) ?? '').toLowerCase();
    return EXCLUDED_CATEGORY_NAMES.has(name);
  });
}

// Parse pack size from SKU suffix: "REV-39-1681-pk25" → 25
function parsePackSize(sku: string): number {
  const match = sku.match(/-pk(\d+)$/i);
  return match ? parseInt(match[1], 10) : 1;
}

// ─── Map BigCommerce product → Part ──────────────────────────────────────────

function mapProductToPart(
  product: BigCommerceProduct,
  categoryMap: Map<number, string>
): Part {
  // Use first mapped category name, or fallback to 'General'
  const categoryName =
    (product.categories ?? [])
      .map((id) => categoryMap.get(id))
      .find((name): name is string => Boolean(name)) ?? 'General';

  // Strip HTML tags from description
  const rawDescription = product.description ?? '';
  const cleanDescription = rawDescription.replace(/<[^>]*>/g, '').trim() || undefined;

  const packSize = parsePackSize(product.sku);

  return {
    id: generateId(),
    name: product.name,
    sku: product.sku,
    category: categoryName,
    description: cleanDescription,
    imageUrl: undefined, // images are not reliably available; omit to keep display compact
    packSize,
    packUnit: packSize > 1 ? `Pack of ${packSize}` : undefined,
    defaultLoaner: false,
    msrp: product.price,
    tags: (product.categories ?? []).map((id) => categoryMap.get(id) ?? String(id)),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getRevCategories(): Promise<Array<{ id: number; name: string }>> {
  const map = await fetchCategoryMap();
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

export async function getRevProducts(categoryIds?: number[]): Promise<Part[]> {
  const { baseUrl: base, headers } = await getBigCommerceConfig();
  const categoryMap = await fetchCategoryMap();

  const allProducts: BigCommerceProduct[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: '250',
      include: 'images',
    });
    if (categoryIds && categoryIds.length > 0) {
      params.set('categories:in', categoryIds.join(','));
    }

    const url = `${base}/catalog/products?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`BigCommerce products error ${res.status}: ${body}`);
    }
    const data: BcProductsResponse = await res.json();
    totalPages = data.meta.pagination.total_pages;
    allProducts.push(...data.data);
    page++;
  } while (page <= totalPages);

  return allProducts
    .filter((p) => !p.sku.toUpperCase().startsWith('OLD-'))
    .filter((p) => !isExcludedCategory(p.categories ?? [], categoryMap))
    .map((p) => mapProductToPart(p, categoryMap));
}

export const revApiClient = { getRevProducts, getRevCategories };
