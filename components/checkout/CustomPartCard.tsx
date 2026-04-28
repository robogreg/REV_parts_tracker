'use client';

import { useState, useRef, useEffect } from 'react';
import { PenLine, Lock, Unlock, X } from 'lucide-react';
import { useCartStore, useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { CartItem, InventoryItem, Part } from '@/lib/types';
import toast from 'react-hot-toast';

/**
 * Always-visible card for checking out an unlisted / custom part.
 * The operator enters the last 4 digits of the SKU, a quantity, and optional comments.
 */
export function CustomPartCard() {
  const [open, setOpen] = useState(false);
  const [skuSuffix, setSkuSuffix] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState('');
  const [isLoaner, setIsLoaner] = useState(false);
  const [error, setError] = useState('');

  const activeEvent = useAppStore((s) => s.activeEvent);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const skuInputRef = useRef<HTMLInputElement>(null);

  // Focus SKU input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => skuInputRef.current?.focus(), 50);
    }
  }, [open]);

  function reset() {
    setSkuSuffix('');
    setQuantity(1);
    setComments('');
    setIsLoaner(false);
    setError('');
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  function handleAdd() {
    const suffix = skuSuffix.trim().toUpperCase();
    if (!suffix) { setError('Enter the last 4 digits of the SKU'); return; }
    if (quantity < 1) { setError('Quantity must be at least 1'); return; }

    const partId = `custom-${suffix}-${Date.now()}`;
    const sku = `CUSTOM-${suffix}`;

    // Check if an identical custom entry (same suffix) already exists in cart —
    // if so, just bump its quantity rather than adding a duplicate row.
    const existing = cartItems.find(
      (i) => i.part.sku === sku && i.part.id.startsWith('custom-')
    );
    if (existing) {
      // Re-use the existing cart store update path
      useCartStore.getState().updateQuantity(existing.part.id, existing.quantity + quantity);
      toast.success(`Updated ${sku} — now ×${existing.quantity + quantity}`);
      handleClose();
      return;
    }

    const customPart: Part = {
      id: partId,
      name: 'Custom / Unlisted Part',
      sku,
      category: 'Custom',
      packSize: 1,
      defaultLoaner: false,
    };

    const inventoryItem: InventoryItem = {
      id: partId,
      eventId: activeEvent?.id ?? '',
      part: customPart,
      quantityAvailable: 9999,
      quantityGiven: 0,
      isLoaner,
    };

    const cartItem: CartItem = {
      part: customPart,
      inventoryItem,
      quantity,
      unitType: 'each',
      isLoaner,
      notes: comments.trim() || undefined,
    };

    addItem(cartItem);
    toast.success(`Added ${sku} ×${quantity}`);
    handleClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') handleClose();
  }

  return (
    <>
      {/* Card — compact, matches PartCard layout */}
      <div
        className={cn(
          'bg-[var(--bg-card)] border-2 border-dashed border-[var(--bg-hover)] rounded-xl overflow-hidden flex flex-col',
          'hover:border-[#FF6B00]/50 transition-colors cursor-pointer group'
        )}
        onClick={handleOpen}
      >
        <div className="p-3 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <p className="text-sm font-semibold text-[var(--tx-primary)] leading-tight flex-1">
              Custom / Unlisted Part
            </p>
            <PenLine className="w-3.5 h-3.5 text-[#FF6B00] flex-shrink-0 mt-0.5" />
          </div>
          <p className="text-[11px] font-mono text-[var(--tx-muted)]">Enter SKU + qty</p>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpen(); }}
            className="w-full py-2 rounded-lg bg-[var(--bg-hover)] hover:bg-[#FF6B00] text-[var(--tx-muted)] hover:text-[var(--tx-primary)] text-sm font-semibold transition-colors mt-auto"
          >
            Add
          </button>
        </div>
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bg-hover)]">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-[#FF6B00]" />
                <h2 className="text-sm font-semibold text-[var(--tx-primary)]">Custom / Unlisted Part</h2>
              </div>
              <button onClick={handleClose} className="text-[var(--tx-muted)] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              {/* SKU suffix */}
              <div>
                <label className="block text-xs font-medium text-[var(--tx-muted)] mb-1.5">
                  Last 4 digits of SKU <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--tx-muted)] font-mono flex-shrink-0">CUSTOM-</span>
                  <input
                    ref={skuInputRef}
                    type="text"
                    value={skuSuffix}
                    onChange={(e) => {
                      setSkuSuffix(e.target.value.toUpperCase().slice(0, 6));
                      setError('');
                    }}
                    placeholder="1234"
                    maxLength={6}
                    className="flex-1 bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors tracking-widest uppercase"
                  />
                </div>
                {skuSuffix && (
                  <p className="text-[10px] text-[var(--tx-muted)] mt-1">
                    Will be recorded as <span className="font-mono text-[#FF6B00]">CUSTOM-{skuSuffix.toUpperCase()}</span>
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-medium text-[var(--tx-muted)] mb-1.5">
                  Quantity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-lg px-3 py-2 text-sm text-[var(--tx-primary)] outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-medium text-[var(--tx-muted)] mb-1.5">
                  Comments <span className="text-[var(--tx-muted)] font-normal">(optional)</span>
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Part description, reason, or other notes…"
                  rows={2}
                  maxLength={200}
                  className="w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-lg px-3 py-2 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors resize-none"
                />
              </div>

              {/* Loaner toggle */}
              <button
                onClick={() => setIsLoaner((v) => !v)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                  isLoaner
                    ? 'bg-[#FF6B00]/15 border-[#FF6B00]/40 text-[#FF6B00]'
                    : 'bg-[var(--bg-input)] border-[var(--bg-hover)] text-[var(--tx-muted)] hover:text-[var(--tx-primary)]'
                )}
              >
                {isLoaner ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {isLoaner ? 'Loaner — team must return' : 'Keep — team keeps this part'}
              </button>

              {/* Error */}
              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--bg-hover)] text-sm text-[var(--tx-muted)] hover:text-[var(--tx-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e55a00] text-[var(--tx-primary)] text-sm font-semibold transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
