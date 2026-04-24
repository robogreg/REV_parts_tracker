'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Shield, ShieldCheck, ShieldAlert, Clock, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { StoredUser, UserRole } from '@/lib/types';
import toast from 'react-hot-toast';

const SUPER_ADMIN_EMAIL = 'greg@revrobotics.com';

const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ElementType; color: string; bg: string; description: string }> = {
  user: {
    label: 'User',
    icon: Shield,
    color: 'text-[var(--tx-muted)]',
    bg: 'bg-[var(--bg-hover)]',
    description: 'Checkout only — can give out parts but cannot access admin.',
  },
  manager: {
    label: 'Manager',
    icon: ShieldCheck,
    color: 'text-blue-400',
    bg: 'bg-blue-900/30',
    description: 'Full admin access — events, inventory, reports. Cannot change API keys.',
  },
  superadmin: {
    label: 'Super Admin',
    icon: ShieldAlert,
    color: 'text-[#FF6B00]',
    bg: 'bg-[#FF6B00]/15',
    description: 'Unrestricted access including API settings.',
  },
};

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [changingUid, setChangingUid] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ users: StoredUser[] }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${user?.idToken}` },
      });
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
    enabled: !!user?.idToken,
  });

  const updateRole = useMutation({
    mutationFn: async ({ uid, role, email }: { uid: string; role: UserRole; email: string }) => {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${user?.idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role, email }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to update role');
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`Role updated to ${ROLE_CONFIG[vars.role].label}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
    onSettled: () => setChangingUid(null),
  });

  const filtered = (data?.users ?? []).filter((u) => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });

  const counts = (data?.users ?? []).reduce(
    (acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc; },
    {} as Record<UserRole, number>
  );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--tx-primary)] flex items-center gap-2">
          <Users className="w-6 h-6 text-[#FF6B00]" />
          Users
        </h1>
        <p className="text-sm text-[var(--tx-muted)] mt-1">
          Everyone who has logged in with a @revrobotics.com account. Set their permission level here.
        </p>
      </div>

      {/* Role legend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={role} className={cn('rounded-xl p-4 border border-[var(--bg-hover)]', cfg.bg)}>
              <div className={cn('flex items-center gap-2 font-semibold text-sm mb-1', cfg.color)}>
                <Icon className="w-4 h-4" />
                {cfg.label}
                <span className="ml-auto text-xs font-normal text-[var(--tx-muted)]">
                  {counts[role] ?? 0} {counts[role] === 1 ? 'person' : 'people'}
                </span>
              </div>
              <p className="text-xs text-[var(--tx-muted)] leading-relaxed">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tx-muted)] pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 text-sm">Failed to load users.</div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-hover)] text-xs text-[var(--tx-muted)]">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Current Role</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">First Login</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.uid === user?.uid;
                  const isProtected = u.email === SUPER_ADMIN_EMAIL;
                  const isChanging = changingUid === u.uid;

                  return (
                    <tr
                      key={u.uid}
                      className="border-b border-[var(--bg-hover)] last:border-0 hover:bg-[var(--bg-input)] transition-colors"
                    >
                      {/* User info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF6B00]/15 flex items-center justify-center text-[#FF6B00] text-xs font-bold flex-shrink-0">
                            {u.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--tx-primary)] truncate">
                              {u.name}
                              {isSelf && <span className="ml-2 text-[10px] text-[var(--tx-muted)] font-normal">(you)</span>}
                            </p>
                            <p className="text-xs text-[var(--tx-muted)] truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Current role */}
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>

                      {/* First login */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-[var(--tx-muted)] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(u.firstLogin)}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-[var(--tx-muted)]">
                          {formatDate(u.lastLogin)}
                        </span>
                      </td>

                      {/* Role selector */}
                      <td className="px-4 py-3 text-right">
                        {isProtected ? (
                          <span className="text-xs text-[var(--tx-muted)] italic">protected</span>
                        ) : isChanging ? (
                          <Spinner size="sm" />
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => {
                              const newRole = e.target.value as UserRole;
                              if (newRole === u.role) return;
                              setChangingUid(u.uid);
                              updateRole.mutate({ uid: u.uid, role: newRole, email: u.email });
                            }}
                            className="bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-lg px-2 py-1 text-xs text-[var(--tx-primary)] outline-none focus:border-[#FF6B00] cursor-pointer transition-colors"
                          >
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="superadmin">Super Admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-[var(--tx-muted)] text-sm">
              {search ? 'No users match your search.' : 'No users have logged in yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
