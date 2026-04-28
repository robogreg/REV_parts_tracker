'use client';

import { InventoryItem } from '@/lib/types';
import { PartCard } from './PartCard';
import { CustomPartCard } from './CustomPartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface PartsGridProps {
  items: InventoryItem[];
  loading?: boolean;
  searchQuery: string;
  selectedCategory: string | null;
}

export function PartsGrid({ items, loading, searchQuery, selectedCategory }: PartsGridProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const filtered = items.filter((item) => {
    const matchesCat = !selectedCategory || item.part.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      item.part.name.toLowerCase().includes(q) ||
      item.part.sku.toLowerCase().includes(q) ||
      item.part.tags?.some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          <CustomPartCard />
        </div>
        <EmptyState
          icon={Package}
          title={searchQuery || selectedCategory ? 'No parts found' : 'No inventory loaded'}
          description={
            searchQuery || selectedCategory
              ? 'Try a different search or category'
              : 'Ask an admin to upload inventory for this event'
          }
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {/* Custom/unlisted part card — always pinned at top */}
      <CustomPartCard />
      {filtered.map((item) => (
        <PartCard key={item.id} item={item} />
      ))}
    </div>
  );
}
