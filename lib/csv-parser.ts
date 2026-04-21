import Papa from 'papaparse';
import { Part, Team, Program } from './types';
import { generateId, parseBoolean } from './utils';

export interface CsvInventoryRow {
  sku: string;
  name: string;
  category?: string;
  quantity_available: string;
  pack_size?: string;
  pack_unit?: string;
  is_loaner?: string;
  low_stock_threshold?: string;
  image_url?: string;
  description?: string;
  msrp?: string;
}

export interface CsvTeamRow {
  team_number: string;
  team_name: string;
  program?: string;
  city?: string;
  state?: string;
  country?: string;
  school?: string;
}

export interface ParseError {
  row: number;
  message: string;
}

export interface InventoryParseResult {
  items: Array<{ part: Partial<Part>; quantityAvailable: number; isLoaner: boolean; lowStockThreshold?: number }>;
  errors: ParseError[];
}

export interface TeamParseResult {
  teams: Partial<Team>[];
  errors: ParseError[];
}

export function parseInventoryCsv(csvText: string): InventoryParseResult {
  const result = Papa.parse<CsvInventoryRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const items: InventoryParseResult['items'] = [];
  const errors: ParseError[] = [];

  result.data.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row

    if (!row.sku?.trim()) {
      errors.push({ row: rowNum, message: 'Missing required field: sku' });
      return;
    }
    if (!row.name?.trim()) {
      errors.push({ row: rowNum, message: 'Missing required field: name' });
      return;
    }
    const qtyRaw = parseInt(row.quantity_available ?? '0', 10);
    if (isNaN(qtyRaw)) {
      errors.push({ row: rowNum, message: `Invalid quantity_available: "${row.quantity_available}"` });
      return;
    }

    const packSize = parseInt(row.pack_size ?? '1', 10) || 1;
    const msrp = row.msrp ? parseFloat(row.msrp) : undefined;

    items.push({
      part: {
        id: generateId(),
        sku: row.sku.trim(),
        name: row.name.trim(),
        category: row.category?.trim() || 'General',
        packSize,
        packUnit: row.pack_unit?.trim(),
        imageUrl: row.image_url?.trim(),
        description: row.description?.trim(),
        msrp: msrp && !isNaN(msrp) ? msrp : undefined,
        defaultLoaner: parseBoolean(row.is_loaner),
        tags: [],
      },
      quantityAvailable: qtyRaw,
      isLoaner: parseBoolean(row.is_loaner),
      lowStockThreshold: row.low_stock_threshold ? parseInt(row.low_stock_threshold, 10) : undefined,
    });
  });

  return { items, errors };
}

export function parseTeamsCsv(csvText: string, defaultProgram: Program): TeamParseResult {
  const result = Papa.parse<CsvTeamRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const teams: Partial<Team>[] = [];
  const errors: ParseError[] = [];

  result.data.forEach((row, idx) => {
    const rowNum = idx + 2;

    if (!row.team_number?.trim()) {
      errors.push({ row: rowNum, message: 'Missing required field: team_number' });
      return;
    }
    if (!row.team_name?.trim()) {
      errors.push({ row: rowNum, message: 'Missing required field: team_name' });
      return;
    }

    teams.push({
      teamNumber: row.team_number.trim(),
      teamName: row.team_name.trim(),
      program: (row.program?.toUpperCase() as Program) || defaultProgram,
      city: row.city?.trim(),
      state: row.state?.trim(),
      country: row.country?.trim(),
      school: row.school?.trim(),
    });
  });

  return { teams, errors };
}

export function generateInventoryCsvText(headers: string[], rows: string[][]): string {
  const BOM = '\uFEFF';
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
    `,,,,, Total rows: ${rows.length}`,
  ];
  return BOM + lines.join('\r\n');
}
