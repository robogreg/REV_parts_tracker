'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Settings, ShoppingCart, Wifi, WifiOff } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppStore, useCartStore } from '@/lib/store';
import { useInventory } from '@/hooks/useInventory';
import { useAuth } from '@/components/auth/AuthProvider';
import { PartsGrid } from '@/components/checkout/PartsGrid';
import { CartPanel } from '@/components/checkout/CartPanel';
import { CheckoutModal } from '@/components/checkout/CheckoutModal';
import { EventSwitcher } from '@/components/checkout/EventSwitcher';
import { CategoryFilter } from '@/components/checkout/CategoryFilter';
import { SyncBanner } from '@/components/ui/SyncBanner';
import { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function CheckoutPage() {
  const { user } = useAuth();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const isOnline = useAppStore((s) => s.isOnline);
  const pendingCount = useAppStore((s) => s.pendingCount);
  const cartItems = useCartStore((s) => s.items);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [eventSwitcherOpen, setEventSwitcherOpen] = useState(false);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const { data: inventory = [], isLoading } = useInventory(activeEvent?.id);

  const categories = [...new Set(inventory.map((i) => i.part.category))].sort();

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        searchRef.current?.blur();
        setCartOpen(false);
        setCheckoutOpen(false);
        setEventSwitcherOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function handleCheckoutSuccess(tx: Transaction) {
    setLastTx(tx);
    setCheckoutOpen(false);
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] overflow-hidden">
      {/* Sync/Offline banner */}
      <SyncBanner />

      {/* Header */}
      <header className="flex-shrink-0 bg-[var(--bg-card)] border-b border-[var(--bg-hover)] px-3 py-2 flex items-center gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-[#FF6B00] rounded-lg flex items-center justify-center">
            <span className="font-display text-[var(--tx-primary)] text-xs">RP</span>
          </div>
        </div>

        {/* Event switcher */}
        <button
          onClick={() => setEventSwitcherOpen(true)}
          className={cn(
            'flex-1 text-left px-3 py-2 rounded-xl transition-colors min-h-0 min-w-0',
            activeEvent
              ? 'bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
              : 'bg-[#FF6B00]/10 border border-[#FF6B00]/50 animate-pulse'
          )}
        >
          {activeEvent ? (
            <div>
              <p className="text-xs text-[var(--tx-muted)]">{activeEvent.program} Event</p>
              <p className="text-sm font-semibold text-[var(--tx-primary)] truncate">{activeEvent.name}</p>
            </div>
          ) : (
            <p className="text-sm text-[#FF6B00] font-semibold">Select Event</p>
          )}
        </button>

        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Online/offline pill */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
              isOnline
                ? 'bg-green-900/30 text-green-400'
                : 'bg-amber-900/30 text-amber-400'
            )}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {!isOnline && pendingCount > 0 && (
              <span className="bg-amber-500 text-black rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </div>

          {/* Admin link */}
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="p-2 text-[var(--tx-muted)] hover:text-white transition-colors min-h-0 min-w-0"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}

          {/* User avatar */}
          {user?.photoUrl ? (
            <Image
              src={user.photoUrl}
              alt={user.name}
              width={32}
              height={32}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00] text-xs font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}

          {/* Cart button (mobile) */}
          <button
            onClick={() => setCartOpen(true)}
            className="lg:hidden relative p-2 text-[var(--tx-muted)] hover:text-white transition-colors min-h-0 min-w-0"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-[#FF6B00] text-[var(--tx-primary)] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Search + Category filter */}
      <div className="flex-shrink-0 bg-[var(--bg-card)] border-b border-[var(--bg-hover)] py-2 space-y-2">
        <div className="relative px-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tx-muted)] pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search parts… (press "/" to focus)'
            className="w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors"
          />
        </div>
        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Parts grid */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick reorder after success */}
          {lastTx && (
            <div className="m-4 bg-green-900/20 border border-green-800/40 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-400">Parts given to Team {lastTx.teamNumber}!</p>
                <p className="text-xs text-[var(--tx-muted)]">{lastTx.items.length} item type{lastTx.items.length !== 1 ? 's' : ''} · {lastTx.totalItems} units</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLastTx(null)}
                  className="text-xs text-[var(--tx-muted)] hover:text-white min-h-0 min-w-0 px-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <PartsGrid
            items={inventory}
            loading={isLoading}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
          />
        </div>

        {/* Cart panel (always visible on lg) */}
        <CartPanel
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        />
      </div>

      {/* Modals */}
      <EventSwitcher open={eventSwitcherOpen} onClose={() => setEventSwitcherOpen(false)} />
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}
