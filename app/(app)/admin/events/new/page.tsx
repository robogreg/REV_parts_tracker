'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, Users, CheckCircle2 } from 'lucide-react';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Program, FirstEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';

const PROGRAMS: Program[] = ['FRC', 'FTC', 'FLL', 'OTHER'];

interface FormState {
  name: string;
  program: Program;
  startDate: string;
  endDate: string;
  location: string;
  firstEventCode: string;
  firstSeason: number;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  name: '',
  program: 'FRC',
  startDate: '',
  endDate: '',
  location: '',
  firstEventCode: '',
  firstSeason: new Date().getFullYear(),
  notes: '',
};

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [teamsSynced, setTeamsSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // FIRST Event browser
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseProgram, setBrowseProgram] = useState<'FRC' | 'FTC'>('FRC');
  const [browseSeason, setBrowseSeason] = useState(new Date().getFullYear());
  const [browseSearch, setBrowseSearch] = useState('');
  const [firstEvents, setFirstEvents] = useState<FirstEvent[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.startDate || !form.endDate || !form.location) {
      setError('Please fill in all required fields.');
      return;
    }
    setError(null);
    setTeamsSynced(null);

    try {
      // Step 1: create the event
      setLoadingStep('Creating event…');
      const headers = await getAuthHeaders();
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          program: form.program,
          startDate: form.startDate,
          endDate: form.endDate,
          location: form.location,
          firstEventCode: form.firstEventCode || undefined,
          firstSeason: form.firstEventCode ? form.firstSeason : undefined,
          notes: form.notes || undefined,
          status: 'setup',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to create event');
      }

      const { event } = await res.json() as { event: { id: string } };

      // Step 2: auto-sync teams from FIRST if an event code was selected
      if (form.firstEventCode) {
        setLoadingStep('Syncing teams from FIRST…');
        try {
          const syncRes = await fetch(`/api/events/${event.id}/teams/sync`, {
            method: 'POST',
            headers,
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json() as { synced: number };
            setTeamsSynced(syncData.synced);
            // Brief pause so the user sees the count before redirect
            await new Promise((r) => setTimeout(r, 1200));
          }
          // If sync fails, still proceed — teams can be added manually
        } catch {
          // non-fatal
        }
      }

      router.push(`/admin/events/${event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoadingStep(null);
    }
  }

  async function fetchFirstEvents(program: 'FRC' | 'FTC', season: number) {
    setBrowseLoading(true);
    setBrowseError(null);
    setFirstEvents([]);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/first/events?program=${program}&season=${season}`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }
      const data = await res.json() as { events: FirstEvent[] };
      setFirstEvents(data.events ?? []);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setBrowseLoading(false);
    }
  }

  function openBrowse() {
    setBrowseOpen(true);
    setBrowseSearch('');
    fetchFirstEvents(browseProgram, browseSeason);
  }

  function switchProgram(p: 'FRC' | 'FTC') {
    setBrowseProgram(p);
    setBrowseSearch('');
    fetchFirstEvents(p, browseSeason);
  }

  function pickFirstEvent(ev: FirstEvent) {
    setForm((f) => ({
      ...f,
      name: ev.name,
      program: ev.program,
      startDate: ev.startDate.slice(0, 10),
      endDate: ev.endDate.slice(0, 10),
      location: [ev.venue, ev.city, ev.stateprov, ev.country].filter(Boolean).join(', '),
      firstEventCode: ev.code,
      firstSeason: ev.season,
    }));
    setBrowseOpen(false);
  }

  const filteredFirstEvents = firstEvents.filter(
    (ev) =>
      !browseSearch ||
      ev.name.toLowerCase().includes(browseSearch.toLowerCase()) ||
      ev.code.toLowerCase().includes(browseSearch.toLowerCase()) ||
      (ev.city ?? '').toLowerCase().includes(browseSearch.toLowerCase())
  );

  const inputClass =
    'w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl px-3 py-2.5 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00] transition-colors';
  const labelClass = 'block text-xs font-medium text-[var(--tx-muted)] mb-1.5';
  const isLoading = loadingStep !== null;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-sm text-[var(--tx-muted)] hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--bg-hover)] flex items-center justify-between">
          <h1 className="text-lg font-display font-bold text-[var(--tx-primary)]">Create New Event</h1>
          <button
            type="button"
            onClick={openBrowse}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors"
          >
            <Search className="w-4 h-4" />
            Browse FIRST Events
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className={labelClass}>
              Event Name <span className="text-[#FF6B00]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. 2026 FRC Sacramento Regional"
              className={inputClass}
              required
            />
          </div>

          {/* Program */}
          <div>
            <label className={labelClass}>Program</label>
            <div className="flex gap-2">
              {PROGRAMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setField('program', p)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-medium transition-colors border',
                    form.program === p
                      ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-[#FF6B00]'
                      : 'border-[var(--bg-hover)] text-[var(--tx-muted)] hover:text-white hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Start Date <span className="text-[#FF6B00]">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
                className={cn(inputClass, 'text-[var(--tx-primary)] [color-scheme:dark]')}
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                End Date <span className="text-[#FF6B00]">*</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
                className={cn(inputClass, 'text-[var(--tx-primary)] [color-scheme:dark]')}
                required
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>
              Location <span className="text-[#FF6B00]">*</span>
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Venue, City, State"
              className={inputClass}
              required
            />
          </div>

          {/* FIRST Event Code + Season */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-xs font-medium text-[var(--tx-muted)]">FIRST Event Code</label>
              {form.firstEventCode && (
                <span className="flex items-center gap-1 text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-800/40 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Teams will be auto-synced
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  type="text"
                  value={form.firstEventCode}
                  onChange={(e) => setField('firstEventCode', e.target.value.toUpperCase())}
                  placeholder="e.g. CASAC — or browse above"
                  className={cn(inputClass, 'font-mono')}
                />
              </div>
              <div>
                <input
                  type="number"
                  value={form.firstSeason}
                  onChange={(e) =>
                    setField('firstSeason', parseInt(e.target.value) || new Date().getFullYear())
                  }
                  min={2020}
                  max={2030}
                  placeholder="Season"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Any notes about this event…"
              rows={3}
              className={cn(inputClass, 'resize-none')}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Loading progress */}
          {isLoading && (
            <div className="flex items-center gap-3 bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl px-4 py-3">
              <Spinner size="sm" className="text-[#FF6B00]" />
              <span className="text-sm text-[var(--tx-primary)]">{loadingStep}</span>
              {teamsSynced !== null && (
                <span className="ml-auto flex items-center gap-1.5 text-green-400 text-sm">
                  <Users className="w-4 h-4" /> {teamsSynced} teams synced
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Link
              href="/admin/events"
              className="px-4 py-2 rounded-xl text-sm text-[var(--tx-muted)] hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {isLoading && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
              Create Event
            </button>
          </div>
        </form>
      </div>

      {/* FIRST Events Browser Modal */}
      <Modal
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        title="Browse FIRST Events"
        size="xl"
      >
        <div className="px-6 py-4 space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Program toggle */}
            <div className="flex gap-1 bg-[var(--bg-base)] border border-[var(--bg-hover)] rounded-lg p-0.5">
              {(['FRC', 'FTC'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => switchProgram(p)}
                  disabled={browseLoading}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                    browseProgram === p
                      ? 'bg-[#FF6B00] text-[var(--tx-primary)]'
                      : 'text-[var(--tx-muted)] hover:text-white'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Season */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--tx-muted)]">Season</label>
              <input
                type="number"
                value={browseSeason}
                onChange={(e) => setBrowseSeason(parseInt(e.target.value))}
                min={2020}
                max={2030}
                className="w-20 bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-lg px-3 py-1.5 text-sm text-[var(--tx-primary)] outline-none focus:border-[#FF6B00]"
              />
            </div>

            <button
              onClick={() => fetchFirstEvents(browseProgram, browseSeason)}
              disabled={browseLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors disabled:opacity-60"
            >
              {browseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>

            {firstEvents.length > 0 && (
              <span className="text-xs text-[var(--tx-muted)] ml-auto">
                {filteredFirstEvents.length} of {firstEvents.length} events
              </span>
            )}
          </div>

          {/* Search filter */}
          {firstEvents.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tx-muted)] pointer-events-none" />
              <input
                type="search"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder="Filter by name, code, city…"
                autoFocus
                className="w-full bg-[var(--bg-input)] border border-[var(--bg-hover)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-muted)] outline-none focus:border-[#FF6B00]"
              />
            </div>
          )}

          {/* Error */}
          {browseError && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
              {browseError}
            </p>
          )}

          {/* Loading */}
          {browseLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-[var(--tx-muted)]">
                Loading {browseProgram} {browseSeason} events…
              </p>
            </div>
          )}

          {/* Results */}
          {!browseLoading && filteredFirstEvents.length > 0 && (
            <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredFirstEvents.map((ev) => (
                <button
                  key={ev.code}
                  onClick={() => pickFirstEvent(ev)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--tx-primary)] group-hover:text-[#FF6B00] transition-colors truncate">
                        {ev.name}
                      </p>
                      <p className="text-xs text-[var(--tx-muted)] mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[#FF6B00] font-semibold">{ev.code}</span>
                        {ev.type && <span className="text-[var(--tx-faint)]">· {ev.type}</span>}
                        {ev.city && <span>· {ev.city}{ev.stateprov && `, ${ev.stateprov}`}</span>}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--tx-faint)] whitespace-nowrap flex-shrink-0 font-mono">
                      {ev.startDate.slice(0, 10)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!browseLoading && firstEvents.length > 0 && filteredFirstEvents.length === 0 && (
            <p className="text-center text-[var(--tx-muted)] text-sm py-8">No matching events.</p>
          )}

          {!browseLoading && firstEvents.length === 0 && !browseError && (
            <div className="text-center py-16 space-y-2">
              <p className="text-[var(--tx-muted)] text-sm">
                No events loaded. Click Search to fetch {browseProgram} {browseSeason} events.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
