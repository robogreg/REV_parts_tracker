'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, CalendarDays, BarChart3, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/events', label: 'Events', icon: CalendarDays, exact: false },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/checkout');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || !user.isAdmin) return null;

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex">
      {/* ── Sidebar (desktop lg+) ─────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-[#1A1A1A] border-r border-[#2E2E2E]">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[#2E2E2E]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#FF6B00] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-display text-white text-xs font-bold">RP</span>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF] leading-none">REV Parts Pit</p>
              <p className="text-sm font-semibold text-white leading-none mt-0.5">Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#FF6B00]/15 text-[#FF6B00]'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-[#2E2E2E]'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user info + sign out */}
        <div className="p-3 border-t border-[#2E2E2E]">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00] text-xs font-bold flex-shrink-0">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[#9CA3AF] truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={signOutUser}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-[#9CA3AF] hover:text-red-400 hover:bg-red-900/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#1A1A1A] border-b border-[#2E2E2E]">
          <div className="w-7 h-7 bg-[#FF6B00] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="font-display text-white text-[10px] font-bold">RP</span>
          </div>
          <span className="text-sm font-semibold text-white flex-1">Admin</span>
          <span className="text-xs text-[#9CA3AF]">{user.name}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>

        {/* ── Mobile bottom tabs ──────────────────────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#1A1A1A] border-t border-[#2E2E2E] flex z-40">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                  active ? 'text-[#FF6B00]' : 'text-[#9CA3AF]'
                )}
              >
                <item.icon className={cn('w-5 h-5', active && 'text-[#FF6B00]')} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={signOutUser}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-[#9CA3AF] hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
