'use client';

import { Lock, Unlock, X } from 'lucide-react';
import { CartItem as CartItemType } from '@/lib/types';
import { useCartStore } from '@/lib/store';
import { QuantityControl } from '@/components/ui/QuantityControl';
import { cn } from '@/lib/utils';

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const toggleLoaner = useCartStore((s) => s.toggleLoaner);

  const packCount = item.part.packSize > 1 ? Math.floor(item.quantity / item.part.packSize) : null;
  const unitTotal = item.quantity;

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--bg-hover)] last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--tx-primary)] truncate">{item.part.name}</p>
          <p className="text-xs font-mono text-[var(--tx-muted)]">{item.part.sku}</p>
          {packCount !== null && (
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">
              {packCount} pack{packCount !== 1 ? 's' : ''} ({unitTotal} units)
            </p>
          )}
        </div>
        <button
          onClick={() => removeItem(item.part.id)}
          className="p-1 text-[var(--tx-muted)] hover:text-red-400 transition-colors min-h-0 min-w-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <QuantityControl
          value={item.quantity}
          onChange={(qty) => updateQuantity(item.part.id, qty)}
          min={1}
        />

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full border',
              item.unitType === 'pack'
                ? 'bg-blue-900/30 text-blue-400 border-blue-800/50'
                : 'bg-[var(--bg-hover)] text-[var(--tx-muted)] border-[var(--bg-hover)]'
            )}
          >
            {item.unitType}
          </span>

          <button
            onClick={() => toggleLoaner(item.part.id)}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors min-h-0 min-w-0',
              item.isLoaner
                ? 'bg-[#FF6B00]/20 text-[#FF6B00] border-[#FF6B00]/40'
                : 'bg-[var(--bg-hover)] text-[var(--tx-muted)] border-[var(--bg-hover)] hover:text-white'
            )}
          >
            {item.isLoaner ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {item.isLoaner ? 'Loaner' : 'Keep'}
          </button>
        </div>
      </div>
    </div>
  );
}
