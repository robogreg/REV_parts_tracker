'use client';

import { useState } from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { InventoryItem } from '@/lib/types';
import { useCartStore } from '@/lib/store';
import { QuantityControl } from '@/components/ui/QuantityControl';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PartCardProps {
  item: InventoryItem;
}

function StockBadge({ remaining, threshold }: { remaining: number; threshold?: number }) {
  if (remaining <= 0) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">
        OUT
      </span>
    );
  }
  if ((threshold && remaining <= threshold) || remaining <= 10) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">
        {remaining} left
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-900/50 text-green-400">
      {remaining}
    </span>
  );
}

export function PartCard({ item }: PartCardProps) {
  const { part, quantityAvailable, quantityGiven, isLoaner, lowStockThreshold } = item;
  const remaining = quantityAvailable - quantityGiven;
  const packSize = part.packSize ?? 1;
  const hasPack = packSize > 1;

  const [giveAsPack, setGiveAsPack] = useState(hasPack);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const cartItem = cartItems.find((i) => i.part.id === part.id);
  const inCart = !!cartItem;

  function handleAdd() {
    if (lowStockThreshold && remaining <= lowStockThreshold) {
      toast(`Only ${remaining} units of ${part.name} remaining`, {
        icon: '⚠️',
        style: { background: '#78350f', color: '#fcd34d', border: '1px solid #92400e' },
        duration: 5000,
      });
    }
    addItem({
      part,
      inventoryItem: item,
      quantity: hasPack && giveAsPack ? packSize : 1,
      unitType: hasPack && giveAsPack ? 'pack' : 'each',
      isLoaner,
    });
  }

  return (
    <div
      className={cn(
        'bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl overflow-hidden flex flex-col',
        'hover:border-[#FF6B00]/40 transition-colors',
        remaining <= 0 && 'opacity-60'
      )}
    >
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Name + badges row */}
        <div className="flex items-start justify-between gap-1.5 min-h-0">
          <p className="text-sm font-semibold text-[var(--tx-primary)] leading-tight line-clamp-3 flex-1">
            {part.name}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            {isLoaner && <Lock className="w-3 h-3 text-[#FF6B00]" />}
            {lowStockThreshold && remaining > 0 && remaining <= lowStockThreshold && (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            )}
          </div>
        </div>

        {/* SKU + stock */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-mono text-[var(--tx-muted)] truncate">{part.sku}</p>
          <StockBadge remaining={remaining} threshold={lowStockThreshold} />
        </div>

        {/* Pack / individual toggle for -pk items */}
        {hasPack && !inCart && (
          <div className="flex rounded-lg overflow-hidden border border-[var(--bg-hover)] text-[10px] font-medium">
            <button
              onClick={() => setGiveAsPack(true)}
              className={cn(
                'flex-1 py-1 transition-colors',
                giveAsPack
                  ? 'bg-[#FF6B00] text-[var(--tx-primary)]'
                  : 'text-[var(--tx-muted)] hover:text-[var(--tx-primary)]'
              )}
            >
              Pack of {packSize}
            </button>
            <button
              onClick={() => setGiveAsPack(false)}
              className={cn(
                'flex-1 py-1 transition-colors',
                !giveAsPack
                  ? 'bg-[#FF6B00] text-[var(--tx-primary)]'
                  : 'text-[var(--tx-muted)] hover:text-[var(--tx-primary)]'
              )}
            >
              Individual
            </button>
          </div>
        )}

        {/* Cart controls */}
        {inCart ? (
          <QuantityControl
            value={cartItem.quantity}
            onChange={(qty) => updateQuantity(part.id, qty)}
            min={0}
            className="justify-center"
          />
        ) : (
          <button
            onClick={handleAdd}
            className="w-full py-2 rounded-lg bg-[#FF6B00] hover:bg-[#e55a00] text-[var(--tx-primary)] text-sm font-semibold transition-colors min-h-0"
          >
            {remaining <= 0 ? 'Add (Override)' : 'Add'}
          </button>
        )}
      </div>
    </div>
  );
}
