'use client';

import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-4">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors min-h-0 min-w-0',
          selected === null
            ? 'bg-[#FF6B00] text-[var(--tx-primary)]'
            : 'bg-[var(--bg-input)] text-[var(--tx-muted)] hover:bg-[var(--bg-hover)] hover:text-white'
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(selected === cat ? null : cat)}
          className={cn(
            'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors min-h-0 min-w-0',
            selected === cat
              ? 'bg-[#FF6B00] text-[var(--tx-primary)]'
              : 'bg-[var(--bg-input)] text-[var(--tx-muted)] hover:bg-[var(--bg-hover)] hover:text-white'
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
