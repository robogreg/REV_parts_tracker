'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantityControlProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityControl({ value, onChange, min = 1, max, className }: QuantityControlProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-0 min-w-0"
        aria-label="Decrease"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-0 min-w-0"
        aria-label="Increase"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
