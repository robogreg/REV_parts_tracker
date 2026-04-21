'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
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
  onBulkDelete?: (ids: string[]) => void;
}

export function InventoryTable({
  items,
  onUpdateAvailable,
  onToggleLoaner,
  onUpdateThreshold,
  onDelete,
  onBulkDelete,
}: InventoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [editingAvail, setEditingAvail] = useState<string | null>(null);
  const [editingThresh, setEditingThresh] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const allVisibleIds = sorted.map((i) => i.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleIds));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    if (!onBulkDelete || selected.size === 0) return;
    onBulkDelete([...selected]);
    setSelected(new Set());
  }

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
      {/* Search + bulk action bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tx-muted)] pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, SKU, category…"
            className="w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors"
          />
        </div>
        {someSelected && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl text-sm">
            <span className="text-[var(--tx-muted)]">{selected.size} selected</span>
            {onBulkDelete && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-400 text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete selected
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bg-hover)] text-xs text-[var(--tx-muted)]">
              {/* Checkbox column */}
              <th className="w-8 px-2 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-[var(--bg-hover2)] accent-[#FF6B00]"
                  title="Select all"
                />
              </th>
              <th className="text-left px-3 py-3">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-medium"
                >
                  Name / SKU <SortIcon field="name" />
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
                  Avail <SortIcon field="quantityAvailable" />
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
                  Left <SortIcon field="remaining" />
                </button>
              </th>
              <th className="text-center px-3 py-3 font-medium">Threshold</th>
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
              const isSelected = selected.has(item.id);
              const packSize = item.part.packSize ?? 1;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-[var(--bg-hover)] transition-colors',
                    isSelected
                      ? 'bg-[#FF6B00]/10'
                      : isOut
                      ? 'bg-red-950/20 hover:bg-red-950/30'
                      : isLow
                      ? 'bg-amber-950/20 hover:bg-amber-950/30'
                      : 'hover:bg-[var(--bg-input)]'
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-[var(--bg-hover2)] accent-[#FF6B00]"
                    />
                  </td>

                  {/* Name + SKU + pack size */}
                  <td className="px-3 py-2">
                    <p className="text-[var(--tx-primary)] font-medium text-sm leading-tight">{item.part.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[var(--tx-muted)] text-[11px] font-mono">{item.part.sku}</p>
                      {packSize > 1 && (
                        <span className="text-[9px] font-medium bg-[var(--bg-hover)] text-[var(--tx-muted)] px-1.5 py-0.5 rounded">
                          pk{packSize}
                        </span>
                      )}
                    </div>
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
                        className="w-16 bg-[var(--bg-input)] border border-[#FF6B00] rounded-lg px-2 py-1 text-center text-[var(--tx-primary)] text-sm outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingAvail(item.id);
                          setLocalValues((v) => ({ ...v, [item.id]: item.quantityAvailable }));
                        }}
                        className="text-[var(--tx-primary)] hover:text-[#FF6B00] transition-colors min-w-[2rem] text-center"
                        title="Click to edit"
                      >
                        {item.quantityAvailable}
                      </button>
                    )}
                  </td>

                  {/* Given */}
                  <td className="px-3 py-2 text-center text-[var(--tx-primary)]">{item.quantityGiven}</td>

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
                        className="w-14 bg-[var(--bg-input)] border border-[#FF6B00] rounded-lg px-2 py-1 text-center text-[var(--tx-primary)] text-sm outline-none"
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
                        className="text-[var(--tx-muted)] hover:text-[#FF6B00] transition-colors min-w-[2rem]"
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
                        item.isLoaner ? 'text-[#FF6B00]' : 'text-[var(--tx-muted)] hover:text-white'
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

                  {/* Per-row delete */}
                  {onDelete && (
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-[var(--tx-muted)] hover:text-red-400 text-xs transition-colors"
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
          <div className="py-12 text-center text-[var(--tx-muted)] text-sm">No inventory items found.</div>
        )}
      </div>
    </div>
  );
}
