'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Copy,
  Trash2,
  ChevronDown,
  CalendarDays,
} from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { getAuthHeaders } from '@/lib/firebase-client';
import { RevEvent, EventStatus } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

const STATUS_BADGE: Record<EventStatus, 'warning' | 'success' | 'gray'> = {
  setup: 'warning',
  active: 'success',
  closed: 'gray',
};

const STATUS_OPTIONS: EventStatus[] = ['setup', 'active', 'closed'];

export default function EventsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading } = useEvents();

  const [deleteTarget, setDeleteTarget] = useState<RevEvent | null>(null);
  const [statusTarget, setStatusTarget] = useState<RevEvent | null>(null);
  const [statusValue, setStatusValue] = useState<EventStatus>('setup');

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setDeleteTarget(null);
    },
  });

  // Clone mutation
  const cloneMutation = useMutation({
    mutationFn: async (event: RevEvent) => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${event.name} (Copy)`,
          program: event.program,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
          notes: event.notes,
          status: 'setup',
        }),
      });
      if (!res.ok) throw new Error('Clone failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      router.push(`/admin/events/${data.event.id}`);
    },
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EventStatus }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Status update failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setStatusTarget(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--tx-primary)]">Events</h1>
          <p className="text-sm text-[var(--tx-muted)] mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/events/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create your first event to get started."
          action={
            <Link
              href="/admin/events/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </Link>
          }
        />
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-hover)] text-xs text-[var(--tx-muted)]">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Program</th>
                  <th className="text-left px-4 py-3 font-medium">Dates</th>
                  <th className="text-left px-4 py-3 font-medium">Location</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-[var(--bg-hover)] last:border-0 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[var(--tx-primary)] font-medium">{event.name}</p>
                      {event.firstEventCode && (
                        <p className="text-[10px] text-[var(--tx-muted)] font-mono mt-0.5">
                          {event.firstEventCode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="orange">{event.program}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--tx-muted)] text-xs whitespace-nowrap">
                      {formatDate(event.startDate)} — {formatDate(event.endDate)}
                    </td>
                    <td className="px-4 py-3 text-[var(--tx-muted)] text-xs max-w-[160px] truncate">
                      {event.location}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_BADGE[event.status]}>
                        {event.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Edit */}
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="p-2 rounded-lg text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>

                        {/* Clone */}
                        <button
                          onClick={() => cloneMutation.mutate(event)}
                          disabled={cloneMutation.isPending}
                          className="p-2 rounded-lg text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
                          title="Clone"
                        >
                          {cloneMutation.isPending ? (
                            <Spinner size="sm" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Change status */}
                        <button
                          onClick={() => {
                            setStatusTarget(event);
                            setStatusValue(event.status);
                          }}
                          className="p-2 rounded-lg text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
                          title="Change status"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(event)}
                          className="p-2 rounded-lg text-[var(--tx-muted)] hover:text-red-400 hover:bg-red-900/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Event"
        size="sm"
      >
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-[var(--tx-muted)]">
            Are you sure you want to delete{' '}
            <span className="text-[var(--tx-primary)] font-semibold">{deleteTarget?.name}</span>? This action
            cannot be undone and will remove all associated inventory and transactions.
          </p>
          {deleteMutation.isError && (
            <p className="text-sm text-red-400">
              {(deleteMutation.error as Error)?.message ?? 'Delete failed'}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[var(--bg-hover)] flex gap-3 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-[var(--tx-primary)] text-sm font-medium transition-colors disabled:opacity-60"
          >
            {deleteMutation.isPending && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
            Delete Event
          </button>
        </div>
      </Modal>

      {/* Change status modal */}
      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title="Change Status"
        size="sm"
      >
        <div className="px-6 py-4 space-y-4">
          <p className="text-xs text-[var(--tx-muted)]">
            Event: <span className="text-[var(--tx-primary)]">{statusTarget?.name}</span>
          </p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusValue(s)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors border',
                  statusValue === s
                    ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-[#FF6B00]'
                    : 'border-[var(--bg-hover)] text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {statusMutation.isError && (
            <p className="text-sm text-red-400">
              {(statusMutation.error as Error)?.message ?? 'Update failed'}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[var(--bg-hover)] flex gap-3 justify-end">
          <button
            onClick={() => setStatusTarget(null)}
            className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              statusTarget &&
              statusMutation.mutate({ id: statusTarget.id, status: statusValue })
            }
            disabled={statusMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-medium transition-colors disabled:opacity-60"
          >
            {statusMutation.isPending && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
            Update Status
          </button>
        </div>
      </Modal>
    </div>
  );
}
