'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Lock, AlertTriangle, Package, Wrench, Cpu, Zap } from 'lucide-react';
import { InventoryItem } from '@/lib/types';
import { useCartStore } from '@/lib/store';
import { QuantityControl } from '@/components/ui/QuantityControl';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PartCardProps {
  item: InventoryItem;
}

function CategoryIcon({ category }: { category: string }) {
  const cat = category.toLowerCase();
  if (cat.includes('motor')) return <Zap className="w-8 h-8 text-[#FF6B00]" />;
  if (cat.includes('electronic') || cat.includes('sensor')) return <Cpu className="w-8 h-8 text-[#FF6B00]" />;
  if (cat.includes('hardware') || cat.includes('mechanic')) return <Wrench className="w-8 h-8 text-[#FF6B00]" />;
  return <Package className="w-8 h-8 text-[#FF6B00]" />;
}

function StockBadge({ remaining, threshold }: { remaining: number; threshold?: number }) {
  if (remaining <= 0) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">
        OUT
      </span>
    );
  }
  if (threshold && remaining <= threshold) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">
        {remaining} left
      </span>
    );
  }
  if (remaining <= 10) {
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

  // For -pk items, track whether the user wants to give a full pack or individuals
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
    // When giving as a full pack, quantity represents 1 pack = packSize individual units
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
      {/* Image */}
      <div className="relative aspect-square bg-[var(--bg-base)] flex items-center justify-center">
        {part.imageUrl ? (
          <Image
            src={part.imageUrl}
            alt={part.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <CategoryIcon category={part.category} />
        )}
        {/* Loaner badge */}
        {isLoaner && (
          <div className="absolute top-2 left-2 bg-[#FF6B00]/20 border border-[#FF6B00]/40 rounded-full p-1">
            <Lock className="w-3 h-3 text-[#FF6B00]" />
          </div>
        )}
        {/* Low stock warning */}
        {lowStockThreshold && remaining > 0 && remaining <= lowStockThreshold && (
          <div className="absolute top-2 right-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-sm font-semibold text-[var(--tx-primary)] leading-tight line-clamp-2">{part.name}</p>
          <p className="text-xs font-mono text-[var(--tx-muted)] mt-0.5">{part.sku}</p>
        </div>

        <div className="flex items-center justify-between">
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
