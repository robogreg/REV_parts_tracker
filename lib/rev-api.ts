// REV Robotics BigCommerce API client
// Base: https://api.bigcommerce.com/stores/${BIGCOMMERCE_STORE_HASH}/v3

import type { Part, BigCommerceProduct, BigCommerceCategory } from './types';
import { generateId } from './utils';

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
  const base = getBaseUrl();
  const headers = getAuthHeaders();
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

  return {
    id: generateId(),
    name: product.name,
    sku: product.sku,
    category: categoryName,
    description: cleanDescription,
    imageUrl: product.primary_image?.url_thumbnail,
    packSize: 1,
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
  const base = getBaseUrl();
  const headers = getAuthHeaders();
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

  return allProducts.map((p) => mapProductToPart(p, categoryMap));
}

export const revApiClient = { getRevProducts, getRevCategories };
