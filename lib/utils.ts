import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy h:mm a');
}

export function generateId(): string {
  return crypto.randomUUID();
}

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};

export function parseBoolean(value: string | undefined | null): boolean {
  if (!value) return false;
  return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function parseFirstUrl(url: string): { program: 'FRC' | 'FTC'; season: number; eventCode: string } | null {
  const frcMatch = url.match(/frc-events\.firstinspires\.org\/(\d{4})\/([A-Z0-9]+)/i);
  if (frcMatch) {
    return { program: 'FRC', season: parseInt(frcMatch[1]), eventCode: frcMatch[2].toUpperCase() };
  }
  const ftcMatch = url.match(/ftc-events\.firstinspires\.org\/(\d{4})\/([A-Z0-9]+)/i);
  if (ftcMatch) {
    return { program: 'FTC', season: parseInt(ftcMatch[1]), eventCode: ftcMatch[2].toUpperCase() };
  }
  return null;
}

export function bytesToUtf8WithBom(data: string): Uint8Array {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  const result = new Uint8Array(bom.length + encoded.length);
  result.set(bom);
  result.set(encoded, bom.length);
  return result;
}
