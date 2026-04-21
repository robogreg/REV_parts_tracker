'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Upload,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Package,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/firebase-client';
import toast from 'react-hot-toast';
import { useInventory } from '@/hooks/useInventory';
import { useTeams } from '@/hooks/useTeams';
import { RevEvent, EventStatus, Program, Team, InventoryItem } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { CsvUploader } from '@/components/admin/CsvUploader';

type Tab = 'inventory' | 'teams' | 'settings';

const STATUS_OPTIONS: EventStatus[] = ['setup', 'active', 'closed'];
const PROGRAMS: Program[] = ['FRC', 'FTC', 'FLL', 'OTHER'];

async function fetchEvent(id: string): Promise<RevEvent> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/events/${id}`, { headers });
  if (!res.ok) throw new Error('Event not found');
  const data = await res.json();
  return data.event;
}

function buildCsv(items: InventoryItem[]): string {
  const header = 'Name,SKU,Category,Available,Given,Remaining,Loaner';
  const rows = items.map((i) =>
    [
      `"${i.part.name}"`,
      i.part.sku,
      `"${i.part.category}"`,
      i.quantityAvailable,
      i.quantityGiven,
      i.quantityAvailable - i.quantityGiven,
      i.isLoaner ? 'yes' : 'no',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

function downloadFile(content: string, filename: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('inventory');

  // Fetch event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id),
  });

  const { data: inventory = [], isLoading: invLoading } = useInventory(id);
  const { data: teams = [], isLoading: teamsLoading } = useTeams(id);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<RevEvent>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Modals
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [revImporting, setRevImporting] = useState(false);
  const [syncingFirst, setSyncingFirst] = useState(false);

  // Add team form
  const [newTeam, setNewTeam] = useState({
    teamNumber: '',
    teamName: '',
    program: 'FRC' as Program,
    city: '',
    state: '',
  });

  // Add part (simple SKU lookup)
  const [newPartSku, setNewPartSku] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [addPartLoading, setAddPartLoading] = useState(false);
  const [addPartError, setAddPartError] = useState<string | null>(null);

  // Inventory mutations
  const invMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: Record<string, unknown> }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}/inventory/${itemId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory', id] }),
  });

  // Remove team mutation
  const removeTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}/teams/${teamId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Remove failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams', id] }),
  });

  // Remove inventory item
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}/inventory/${itemId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Remove failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory', id] }),
  });

  async function handleBulkDelete(ids: string[]) {
    const headers = await getAuthHeaders();
    await Promise.all(
      ids.map((itemId) =>
        fetch(`/api/events/${id}/inventory/${itemId}`, { method: 'DELETE', headers })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['inventory', id] });
    toast.success(`Removed ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) throw new Error('Save failed');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleDeleteEvent() {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/events/${id}`, { method: 'DELETE', headers });
      router.push('/admin/events');
    } catch {
      setSettingsError('Delete failed');
    }
  }

  async function handleRevImport() {
    setRevImporting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}/inventory/rev`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Import failed (${res.status})`);
      }
      const data = await res.json() as { added: number };
      toast.success(`Imported ${data.added} parts from REV catalog`);
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'REV import failed');
    } finally {
      setRevImporting(false);
    }
  }

  async function handleSyncFirst() {
    setSyncingFirst(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}/teams/sync`, { method: 'POST', headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Sync failed (${res.status})`);
      }
      const data = await res.json() as { synced: number };
      toast.success(`Synced ${data.synced} teams from FIRST`);
      queryClient.invalidateQueries({ queryKey: ['teams', id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'FIRST sync failed');
    } finally {
      setSyncingFirst(false);
    }
  }

  async function handleAddTeam() {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/events/${id}/teams`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(newTeam),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['teams', id] });
      setAddTeamOpen(false);
      setNewTeam({ teamNumber: '', teamName: '', program: 'FRC', city: '', state: '' });
    }
  }

  async function handleAddPart() {
    setAddPartLoading(true);
    setAddPartError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/events/${id}/inventory`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: newPartSku, quantity: newPartQty }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to add part');
      }
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      setAddPartOpen(false);
      setNewPartSku('');
      setNewPartQty(1);
    } catch (err) {
      setAddPartError(err instanceof Error ? err.message : 'Failed to add part');
    } finally {
      setAddPartLoading(false);
    }
  }

  // Inventory stats
  const totalSKUs = inventory.length;
  const totalAvailable = inventory.reduce((s, i) => s + i.quantityAvailable, 0);
  const totalGiven = inventory.reduce((s, i) => s + i.quantityGiven, 0);
  const totalRemaining = totalAvailable - totalGiven;

  const inputClass =
    'w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl px-3 py-2.5 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors';
  const labelClass = 'block text-xs font-medium text-[var(--tx-muted)] mb-1.5';

  if (eventLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center text-[var(--tx-muted)]">
        Event not found.{' '}
        <Link href="/admin/events" className="text-[#FF6B00] hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* Back + header */}
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-sm text-[var(--tx-muted)] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--tx-primary)]">{event.name}</h1>
          <p className="text-sm text-[var(--tx-muted)] mt-0.5">
            {formatDate(event.startDate)} — {formatDate(event.endDate)} · {event.location}
          </p>
        </div>
        <Badge
          variant={
            event.status === 'active' ? 'success' : event.status === 'setup' ? 'warning' : 'gray'
          }
          className="text-sm px-3 py-1 self-start"
        >
          {event.status}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl p-1 w-fit">
        {(
          [
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'teams', label: 'Teams', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
          ] as { id: Tab; label: string; icon: React.ElementType }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.id ? 'bg-[#FF6B00] text-[var(--tx-primary)]' : 'text-[var(--tx-muted)] hover:text-white'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INVENTORY TAB ───────────────────────────────────────────────── */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total SKUs', value: totalSKUs },
              { label: 'Total Available', value: totalAvailable },
              { label: 'Total Given', value: totalGiven },
              { label: 'Remaining', value: totalRemaining },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl px-4 py-3">
                <p className="text-xl font-display font-bold text-[var(--tx-primary)]">{s.value}</p>
                <p className="text-xs text-[var(--tx-muted)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <CsvUploader
              endpoint={`/api/events/${id}/inventory/csv`}
              label="Upload CSV"
              templateType="inventory"
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['inventory', id] })}
            />
            <button
              onClick={handleRevImport}
              disabled={revImporting}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors"
            >
              {revImporting ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
              Import from REV
            </button>
            <button
              onClick={() => setAddPartOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
            <button
              onClick={() =>
                downloadFile(buildCsv(inventory), `${event.name}-inventory.csv`)
              }
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors ml-auto"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Inventory table */}
          <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl p-4">
            {invLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <InventoryTable
                items={inventory}
                onUpdateAvailable={(itemId, value) =>
                  invMutation.mutate({ itemId, data: { quantityAvailable: value } })
                }
                onToggleLoaner={(itemId, value) =>
                  invMutation.mutate({ itemId, data: { isLoaner: value } })
                }
                onUpdateThreshold={(itemId, value) =>
                  invMutation.mutate({ itemId, data: { lowStockThreshold: value } })
                }
                onDelete={(itemId) => removeItemMutation.mutate(itemId)}
                onBulkDelete={handleBulkDelete}
              />
            )}
          </div>
        </div>
      )}

      {/* ── TEAMS TAB ──────────────────────────────────────────────────── */}
      {tab === 'teams' && (
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <CsvUploader
              endpoint={`/api/events/${id}/teams/csv`}
              label="Upload CSV"
              templateType="teams"
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['teams', id] })}
            />
            {event.firstEventCode && (
              <button
                onClick={handleSyncFirst}
                disabled={syncingFirst}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors"
              >
                {syncingFirst ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                Sync from FIRST
              </button>
            )}
            <button
              onClick={() => setAddTeamOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Team
            </button>
          </div>

          {/* Teams table */}
          <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl overflow-hidden">
            {teamsLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : teams.length === 0 ? (
              <p className="text-center py-12 text-[var(--tx-muted)]">No teams added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bg-hover)] text-xs text-[var(--tx-muted)]">
                      <th className="text-left px-4 py-3 font-medium">Team #</th>
                      <th className="text-left px-4 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">Program</th>
                      <th className="text-left px-4 py-3 font-medium">City</th>
                      <th className="text-left px-4 py-3 font-medium">State</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr
                        key={team.id}
                        className="border-b border-[var(--bg-hover)] last:border-0 hover:bg-[var(--bg-input)] transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-[var(--tx-primary)]">
                          {team.teamNumber}
                        </td>
                        <td className="px-4 py-3 text-[var(--tx-primary)]">{team.teamName}</td>
                        <td className="px-4 py-3">
                          <Badge variant="orange">{team.program}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[var(--tx-muted)]">{team.city ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--tx-muted)]">{team.state ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeTeamMutation.mutate(team.id)}
                            disabled={removeTeamMutation.isPending}
                            className="p-2 rounded-lg text-[var(--tx-muted)] hover:text-red-400 hover:bg-red-900/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ───────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-6 max-w-xl">
          {/* Edit form */}
          <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl p-5 space-y-5">
            <h2 className="text-base font-semibold text-[var(--tx-primary)]">Event Settings</h2>

            <div>
              <label className={labelClass}>Event Name</label>
              <input
                type="text"
                defaultValue={event.name}
                onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start Date</label>
                <input
                  type="date"
                  defaultValue={event.startDate}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, startDate: e.target.value }))}
                  className={cn(inputClass, '[color-scheme:dark]')}
                />
              </div>
              <div>
                <label className={labelClass}>End Date</label>
                <input
                  type="date"
                  defaultValue={event.endDate}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, endDate: e.target.value }))}
                  className={cn(inputClass, '[color-scheme:dark]')}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                defaultValue={event.location}
                onChange={(e) => setSettingsForm((f) => ({ ...f, location: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSettingsForm((f) => ({ ...f, status: s }))}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors border',
                      (settingsForm.status ?? event.status) === s
                        ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-[#FF6B00]'
                        : 'border-[var(--bg-hover)] text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)]'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>FIRST Event Code</label>
                <input
                  type="text"
                  defaultValue={event.firstEventCode ?? ''}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, firstEventCode: e.target.value.toUpperCase() || undefined }))
                  }
                  placeholder="e.g. CASAC"
                  className={cn(inputClass, 'font-mono')}
                />
              </div>
              <div>
                <label className={labelClass}>FIRST Season</label>
                <input
                  type="number"
                  defaultValue={event.firstSeason ?? new Date().getFullYear()}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, firstSeason: parseInt(e.target.value) || undefined }))
                  }
                  min={2020}
                  max={2030}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                defaultValue={event.notes ?? ''}
                onChange={(e) => setSettingsForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className={cn(inputClass, 'resize-none')}
              />
            </div>

            {settingsError && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
                {settingsError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {settingsSaving && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
            </div>
            <p className="text-sm text-[var(--tx-muted)]">
              Deleting this event is permanent and will remove all inventory, teams, and transaction
              history.
            </p>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-700 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete This Event
            </button>
          </div>
        </div>
      )}

      {/* Add Part Modal */}
      <Modal open={addPartOpen} onClose={() => setAddPartOpen(false)} title="Add Part" size="sm">
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className={labelClass}>Part SKU</label>
            <input
              type="text"
              value={newPartSku}
              onChange={(e) => setNewPartSku(e.target.value)}
              placeholder="e.g. REV-11-1271"
              className={cn(inputClass, 'font-mono')}
            />
          </div>
          <div>
            <label className={labelClass}>Quantity Available</label>
            <input
              type="number"
              value={newPartQty}
              onChange={(e) => setNewPartQty(parseInt(e.target.value) || 1)}
              min={1}
              className={inputClass}
            />
          </div>
          {addPartError && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
              {addPartError}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[var(--bg-hover)] flex gap-3 justify-end">
          <button
            onClick={() => setAddPartOpen(false)}
            className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAddPart}
            disabled={addPartLoading || !newPartSku}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-medium disabled:opacity-60"
          >
            {addPartLoading && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
            Add Part
          </button>
        </div>
      </Modal>

      {/* Add Team Modal */}
      <Modal open={addTeamOpen} onClose={() => setAddTeamOpen(false)} title="Add Team" size="sm">
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Team Number</label>
              <input
                type="text"
                value={newTeam.teamNumber}
                onChange={(e) => setNewTeam((t) => ({ ...t, teamNumber: e.target.value }))}
                placeholder="e.g. 254"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Program</label>
              <select
                value={newTeam.program}
                onChange={(e) => setNewTeam((t) => ({ ...t, program: e.target.value as Program }))}
                className={inputClass}
              >
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Team Name</label>
            <input
              type="text"
              value={newTeam.teamName}
              onChange={(e) => setNewTeam((t) => ({ ...t, teamName: e.target.value }))}
              placeholder="Team name"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                value={newTeam.city}
                onChange={(e) => setNewTeam((t) => ({ ...t, city: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                type="text"
                value={newTeam.state}
                onChange={(e) => setNewTeam((t) => ({ ...t, state: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--bg-hover)] flex gap-3 justify-end">
          <button
            onClick={() => setAddTeamOpen(false)}
            className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAddTeam}
            disabled={!newTeam.teamNumber || !newTeam.teamName}
            className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-medium disabled:opacity-60"
          >
            Add Team
          </button>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Event"
        size="sm"
      >
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-[var(--tx-muted)]">
            Type the event name to confirm deletion:
          </p>
          <input
            type="text"
            placeholder={event.name}
            id="delete-confirm-input"
            className={inputClass}
          />
        </div>
        <div className="px-6 py-4 border-t border-[var(--bg-hover)] flex gap-3 justify-end">
          <button
            onClick={() => setDeleteConfirm(false)}
            className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const input = document.getElementById('delete-confirm-input') as HTMLInputElement;
              if (input?.value === event.name) handleDeleteEvent();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-[var(--tx-primary)] text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Delete Forever
          </button>
        </div>
      </Modal>
    </div>
  );
}
