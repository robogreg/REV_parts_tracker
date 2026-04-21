'use client';

import { X, Lock, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { CartItem } from './CartItem';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartPanel({ open, onClose, onCheckout }: CartPanelProps) {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const loanerItems = items.filter((i) => i.isLoaner);

  function handleClear() {
    if (items.length > 0 && confirm('Clear all items from cart?')) clearCart();
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-full w-80 bg-[#1A1A1A] border-l border-[#2E2E2E] flex flex-col z-40 transition-transform duration-300',
          'lg:static lg:translate-x-0 lg:z-auto lg:flex',
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#2E2E2E]">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="font-display text-lg text-white">
              Cart ({items.length} item{items.length !== 1 ? 's' : ''})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-[#9CA3AF] hover:text-white transition-colors min-h-0 min-w-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <ShoppingCart className="w-12 h-12 text-[#2E2E2E] mb-3" />
              <p className="text-[#9CA3AF] text-sm">Cart is empty</p>
              <p className="text-[#9CA3AF] text-xs mt-1">Tap a part to add it</p>
            </div>
          ) : (
            items.map((item) => <CartItem key={item.part.id} item={item} />)
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#2E2E2E] p-4 space-y-3">
            {/* Subtotal */}
            <div className="flex justify-between text-sm text-[#9CA3AF]">
              <span>{items.length} unique part{items.length !== 1 ? 's' : ''}</span>
              <span>{totalUnits} total unit{totalUnits !== 1 ? 's' : ''}</span>
            </div>

            {/* Loaner summary */}
            {loanerItems.length > 0 && (
              <div className="bg-[#FF6B00]/10 border border-[#FF6B00]/20 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-[#FF6B00]">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                {loanerItems.length} loaner item{loanerItems.length !== 1 ? 's' : ''} — remind team to return
              </div>
            )}

            {/* Checkout button */}
            <button
              onClick={onCheckout}
              disabled={items.length === 0}
              className="w-full py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e55a00] text-white font-display text-lg transition-colors disabled:opacity-50"
            >
              Check Out
            </button>

            {/* Clear */}
            <button
              onClick={handleClear}
              className="w-full text-center text-xs text-[#9CA3AF] hover:text-red-400 transition-colors min-h-0"
            >
              Clear cart
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
