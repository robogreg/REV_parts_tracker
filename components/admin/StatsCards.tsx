'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCard {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}

interface StatsCardsProps {
  cards: StatCard[];
  className?: string;
}

export function StatsCards({ cards, className }: StatsCardsProps) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3', className)}>
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-4 flex flex-col gap-2"
        >
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              card.accent ? 'bg-[#FF6B00]/20' : 'bg-[#2E2E2E]'
            )}
          >
            <card.icon
              className={cn('w-4 h-4', card.accent ? 'text-[#FF6B00]' : 'text-[#9CA3AF]')}
            />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-white leading-none">
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1">{card.label}</p>
            {card.sub && <p className="text-[10px] text-[#9CA3AF]/60 mt-0.5">{card.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
