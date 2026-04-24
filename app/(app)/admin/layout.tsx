'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, CalendarDays, BarChart3, LogOut, ChevronRight, Settings, Sun, Moon, ArrowLeft, Users } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const SUPER_ADMIN_EMAIL = 'greg@revrobotics.com';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true, superAdminOnly: false },
  { href: '/admin/events', label: 'Events', icon: CalendarDays, exact: false, superAdminOnly: false },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, exact: false, superAdminOnly: false },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false, superAdminOnly: true },
  { href: '/admin/settings', label: 'Settings', icon: Settings, exact: false, superAdminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOutUser } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/checkout');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || !user.isAdmin) return null;

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex">
      {/* ── Sidebar (desktop lg+) ─────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--bg-hover)]">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[var(--bg-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#FF6B00] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-display text-[var(--tx-primary)] text-xs font-bold">RP</span>
            </div>
            <div>
              <p className="text-xs text-[var(--tx-muted)] leading-none">REV Parts Pit</p>
              <p className="text-sm font-semibold text-[var(--tx-primary)] leading-none mt-0.5">Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {visibleNavItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#FF6B00]/15 text-[#FF6B00]'
                    : 'text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)]'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Back to pit form */}
        <div className="px-2 pb-2">
          <Link
            href="/checkout"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-[var(--tx-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Pit Form
          </Link>
        </div>

        {/* Bottom: user info + sign out */}
        <div className="p-3 border-t border-[var(--bg-hover)]">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00] text-xs font-bold flex-shrink-0">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--tx-primary)] truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--tx-muted)] truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-[var(--tx-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={signOutUser}
              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-red-400 hover:bg-red-900/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--bg-hover)]">
          <div className="w-7 h-7 bg-[#FF6B00] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="font-display text-[var(--tx-primary)] text-[10px] font-bold">RP</span>
          </div>
          <span className="text-sm font-semibold text-[var(--tx-primary)] flex-1">Admin</span>
          <span className="text-xs text-[var(--tx-muted)]">{user.name}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>

        {/* ── Mobile bottom tabs ──────────────────────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[var(--bg-card)] border-t border-[var(--bg-hover)] flex z-40">
          {visibleNavItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                  active ? 'text-[#FF6B00]' : 'text-[var(--tx-muted)]'
                )}
              >
                <item.icon className={cn('w-5 h-5', active && 'text-[#FF6B00]')} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={toggleTheme}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-[var(--tx-muted)] hover:text-[var(--tx-primary)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
            onClick={signOutUser}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-[var(--tx-muted)] hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
