'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import Image from 'next/image';
import { InventoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

type SortField = 'name' | 'category' | 'quantityAvailable' | 'quantityGiven' | 'remaining';
type SortDir = 'asc' | 'desc';

interface InventoryTableProps {
  items: InventoryItem[];
  onUpdateAvailable?: (itemId: string, value: number) => void;
  onToggleLoaner?: (itemId: string, value: boolean) => void;
  onUpdateThreshold?: (itemId: string, value: number) => void;
  onDelete?: (itemId: string) => void;
}

export function InventoryTable({
  items,
  onUpdateAvailable,
  onToggleLoaner,
  onUpdateThreshold,
  onDelete,
}: InventoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [editingAvail, setEditingAvail] = useState<string | null>(null);
  const [editingThresh, setEditingThresh] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, number>>({});

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        !q ||
        item.part.name.toLowerCase().includes(q) ||
        item.part.sku.toLowerCase().includes(q) ||
        item.part.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'name') { av = a.part.name; bv = b.part.name; }
      else if (sortField === 'category') { av = a.part.category; bv = b.part.category; }
      else if (sortField === 'quantityAvailable') { av = a.quantityAvailable; bv = b.quantityAvailable; }
      else if (sortField === 'quantityGiven') { av = a.quantityGiven; bv = b.quantityGiven; }
      else if (sortField === 'remaining') {
        av = a.quantityAvailable - a.quantityGiven;
        bv = b.quantityAvailable - b.quantityGiven;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  }

  function commitAvail(item: InventoryItem) {
    const val = localValues[item.id];
    if (val !== undefined && onUpdateAvailable) onUpdateAvailable(item.id, val);
    setEditingAvail(null);
  }

  function commitThresh(item: InventoryItem) {
    const val = localValues[item.id + '_thresh'];
    if (val !== undefined && onUpdateThreshold) onUpdateThreshold(item.id, val);
    setEditingThresh(null);
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, SKU, category…"
          className="w-full bg-[#242424] border border-[#2E2E2E] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2E2E2E] text-xs text-[#9CA3AF]">
              <th className="w-10 px-2 py-3" />
              <th className="text-left px-3 py-3">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-medium"
                >
                  Name <SortIcon field="name" />
                </button>
              </th>
              <th className="text-left px-3 py-3">
                <button
                  onClick={() => handleSort('category')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-medium"
                >
                  Category <SortIcon field="category" />
                </button>
              </th>
              <th className="text-center px-3 py-3">
                <button
                  onClick={() => handleSort('quantityAvailable')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-medium mx-auto"
                >
                  Available <SortIcon field="quantityAvailable" />
                </button>
              </th>
              <th className="text-center px-3 py-3">
                <button
                  onClick={() => handleSort('quantityGiven')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-medium mx-auto"
                >
                  Given <SortIcon field="quantityGiven" />
                </button>
              </th>
              <th className="text-center px-3 py-3">
                <button
                  onClick={() => handleSort('remaining')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-medium mx-auto"
                >
                  Remaining <SortIcon field="remaining" />
                </button>
              </th>
              <th className="text-center px-3 py-3 font-medium">Low Stock</th>
              <th className="text-center px-3 py-3 font-medium">Loaner</th>
              {onDelete && <th className="px-3 py-3" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const remaining = item.quantityAvailable - item.quantityGiven;
              const threshold = item.lowStockThreshold ?? 2;
              const isOut = remaining <= 0;
              const isLow = !isOut && remaining <= threshold;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-[#2E2E2E] transition-colors',
                    isOut
                      ? 'bg-red-950/20 hover:bg-red-950/30'
                      : isLow
                      ? 'bg-amber-950/20 hover:bg-amber-950/30'
                      : 'hover:bg-[#242424]'
                  )}
                >
                  {/* Image */}
                  <td className="px-2 py-2">
                    {item.part.imageUrl ? (
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#2E2E2E] flex-shrink-0">
                        <Image
                          src={item.part.imageUrl}
                          alt={item.part.name}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#2E2E2E] flex items-center justify-center">
                        <span className="text-[#9CA3AF] text-[8px]">IMG</span>
                      </div>
                    )}
                  </td>

                  {/* Name + SKU */}
                  <td className="px-3 py-2">
                    <p className="text-white font-medium text-sm leading-tight">{item.part.name}</p>
                    <p className="text-[#9CA3AF] text-[11px] font-mono">{item.part.sku}</p>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2">
                    <Badge variant="gray">{item.part.category}</Badge>
                  </td>

                  {/* Available (inline editable) */}
                  <td className="px-3 py-2 text-center">
                    {editingAvail === item.id ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={localValues[item.id] ?? item.quantityAvailable}
                        onChange={(e) =>
                          setLocalValues((v) => ({ ...v, [item.id]: parseInt(e.target.value) || 0 }))
                        }
                        onBlur={() => commitAvail(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitAvail(item);
                          if (e.key === 'Escape') setEditingAvail(null);
                        }}
                        className="w-16 bg-[#242424] border border-[#FF6B00] rounded-lg px-2 py-1 text-center text-white text-sm outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingAvail(item.id);
                          setLocalValues((v) => ({ ...v, [item.id]: item.quantityAvailable }));
                        }}
                        className="text-white hover:text-[#FF6B00] transition-colors min-w-[2rem] text-center"
                        title="Click to edit"
                      >
                        {item.quantityAvailable}
                      </button>
                    )}
                  </td>

                  {/* Given */}
                  <td className="px-3 py-2 text-center text-white">{item.quantityGiven}</td>

                  {/* Remaining */}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        'font-semibold',
                        isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-green-400'
                      )}
                    >
                      {remaining}
                    </span>
                  </td>

                  {/* Low stock threshold (inline editable) */}
                  <td className="px-3 py-2 text-center">
                    {editingThresh === item.id ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={localValues[item.id + '_thresh'] ?? (item.lowStockThreshold ?? 2)}
                        onChange={(e) =>
                          setLocalValues((v) => ({
                            ...v,
                            [item.id + '_thresh']: parseInt(e.target.value) || 0,
                          }))
                        }
                        onBlur={() => commitThresh(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitThresh(item);
                          if (e.key === 'Escape') setEditingThresh(null);
                        }}
                        className="w-14 bg-[#242424] border border-[#FF6B00] rounded-lg px-2 py-1 text-center text-white text-sm outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingThresh(item.id);
                          setLocalValues((v) => ({
                            ...v,
                            [item.id + '_thresh']: item.lowStockThreshold ?? 2,
                          }));
                        }}
                        className="text-[#9CA3AF] hover:text-[#FF6B00] transition-colors min-w-[2rem]"
                        title="Click to edit threshold"
                      >
                        ≤{item.lowStockThreshold ?? 2}
                      </button>
                    )}
                  </td>

                  {/* Loaner toggle */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onToggleLoaner?.(item.id, !item.isLoaner)}
                      className={cn(
                        'transition-colors',
                        item.isLoaner ? 'text-[#FF6B00]' : 'text-[#9CA3AF] hover:text-white'
                      )}
                      title={item.isLoaner ? 'Loaner (click to disable)' : 'Not loaner (click to enable)'}
                    >
                      {item.isLoaner ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </td>

                  {/* Delete */}
                  {onDelete && (
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-[#9CA3AF] hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-12 text-center text-[#9CA3AF] text-sm">No inventory items found.</div>
        )}
      </div>
    </div>
  );
}
