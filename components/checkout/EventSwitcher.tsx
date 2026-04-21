'use client';

import { Check, Calendar, Package } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useEvents } from '@/hooks/useEvents';
import { useAppStore, useCartStore } from '@/lib/store';
import { RevEvent } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

interface EventSwitcherProps {
  open: boolean;
  onClose: () => void;
}

const programColors: Record<string, 'orange' | 'success' | 'warning' | 'gray'> = {
  FRC: 'orange',
  FTC: 'success',
  FLL: 'warning',
  OTHER: 'gray',
};

function EventCard({ event, selected, onSelect }: {
  event: RevEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-5 py-4 hover:bg-[#242424] transition-colors flex items-center gap-4 min-h-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={programColors[event.program] ?? 'gray'}>{event.program}</Badge>
          {event.status === 'active' && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        <p className="font-semibold text-white truncate">{event.name}</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">
          {formatDate(event.startDate)} – {formatDate(event.endDate)} · {event.location}
        </p>
      </div>
      {selected && <Check className="w-5 h-5 text-[#FF6B00] flex-shrink-0" />}
    </button>
  );
}

export function EventSwitcher({ open, onClose }: EventSwitcherProps) {
  const { user } = useAuth();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const setActiveEvent = useAppStore((s) => s.setActiveEvent);
  const cartItems = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const { data: events = [], isLoading } = useEvents();

  const active = events.filter((e) => e.status === 'active');
  const setup = events.filter((e) => e.status === 'setup');

  function handleSelect(event: RevEvent) {
    if (event.id === activeEvent?.id) { onClose(); return; }
    if (cartItems.length > 0) {
      if (!confirm('Switching events will clear your cart. Continue?')) return;
      clearCart();
    }
    setActiveEvent(event);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Select Event">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="divide-y divide-[#2E2E2E]">
          {active.length > 0 && (
            <div>
              <p className="px-5 py-2 text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">
                Active
              </p>
              {active.map((e) => (
                <EventCard key={e.id} event={e} selected={activeEvent?.id === e.id} onSelect={() => handleSelect(e)} />
              ))}
            </div>
          )}
          {setup.length > 0 && (
            <div>
              <p className="px-5 py-2 text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">
                Setup
              </p>
              {setup.map((e) => (
                <EventCard key={e.id} event={e} selected={activeEvent?.id === e.id} onSelect={() => handleSelect(e)} />
              ))}
            </div>
          )}
          {events.length === 0 && (
            <p className="text-center text-[#9CA3AF] py-8 text-sm">No events available</p>
          )}
          {user?.isAdmin && (
            <div className="px-5 py-4">
              <Link
                href="/admin/events/new"
                onClick={onClose}
                className="text-sm text-[#FF6B00] hover:underline flex items-center gap-1 min-h-0 min-w-0 w-fit"
              >
                + Create New Event
              </Link>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
