'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
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
  notes: string;
}

const DEFAULT_FORM: FormState = {
  name: '',
  program: 'FRC',
  startDate: '',
  endDate: '',
  location: '',
  firstEventCode: '',
  notes: '',
};

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setError(null);

    try {
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
          notes: form.notes || undefined,
          status: 'setup',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create event');
      }

      const data = await res.json();
      router.push(`/admin/events/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  async function handleBrowseFirst() {
    setBrowseLoading(true);
    setBrowseError(null);
    setFirstEvents([]);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/first/events?program=${browseProgram}&season=${browseSeason}`,
        { headers }
      );
      if (!res.ok) throw new Error('Failed to fetch FIRST events');
      const data = await res.json();
      setFirstEvents(data.events ?? []);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setBrowseLoading(false);
    }
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
    'w-full bg-[#242424] border border-[#2E2E2E] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors';
  const labelClass = 'block text-xs font-medium text-[#9CA3AF] mb-1.5';

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#2E2E2E] flex items-center justify-between">
          <h1 className="text-lg font-display font-bold text-white">Create New Event</h1>
          <button
            type="button"
            onClick={() => {
              setBrowseOpen(true);
              handleBrowseFirst();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white text-sm transition-colors"
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
              placeholder="e.g. 2025 FRC Sacramento Regional"
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
                      : 'border-[#2E2E2E] text-[#9CA3AF] hover:text-white hover:bg-[#2E2E2E]'
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
                className={cn(inputClass, 'text-white [color-scheme:dark]')}
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
                className={cn(inputClass, 'text-white [color-scheme:dark]')}
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

          {/* FIRST Event Code */}
          <div>
            <label className={labelClass}>FIRST Event Code (optional)</label>
            <input
              type="text"
              value={form.firstEventCode}
              onChange={(e) => setField('firstEventCode', e.target.value.toUpperCase())}
              placeholder="e.g. CASAC"
              className={cn(inputClass, 'font-mono')}
            />
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

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Link
              href="/admin/events"
              className="px-4 py-2 rounded-xl text-sm text-[#9CA3AF] hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {loading && <Spinner size="sm" className="text-white" />}
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
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2">
              {(['FRC', 'FTC'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setBrowseProgram(p)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors border',
                    browseProgram === p
                      ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-[#FF6B00]'
                      : 'border-[#2E2E2E] text-[#9CA3AF] hover:text-white hover:bg-[#2E2E2E]'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={browseSeason}
              onChange={(e) => setBrowseSeason(parseInt(e.target.value))}
              min={2020}
              max={2030}
              className="w-24 bg-[#242424] border border-[#2E2E2E] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#FF6B00]"
            />
            <button
              onClick={handleBrowseFirst}
              disabled={browseLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white text-sm transition-colors"
            >
              {browseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {/* Search filter */}
          {firstEvents.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              <input
                type="search"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder="Filter by name, code, city…"
                className="w-full bg-[#242424] border border-[#2E2E2E] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00]"
              />
            </div>
          )}

          {browseError && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
              {browseError}
            </p>
          )}

          {browseLoading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {!browseLoading && filteredFirstEvents.length > 0 && (
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {filteredFirstEvents.map((ev) => (
                <button
                  key={ev.code}
                  onClick={() => pickFirstEvent(ev)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#2E2E2E] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-[#FF6B00] transition-colors">
                        {ev.name}
                      </p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        <span className="font-mono text-[#FF6B00]">{ev.code}</span>
                        {ev.city && ` · ${ev.city}`}
                        {ev.stateprov && `, ${ev.stateprov}`}
                      </p>
                    </div>
                    <p className="text-xs text-[#9CA3AF] whitespace-nowrap flex-shrink-0">
                      {ev.startDate.slice(0, 10)} — {ev.endDate.slice(0, 10)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!browseLoading && firstEvents.length > 0 && filteredFirstEvents.length === 0 && (
            <p className="text-center text-[#9CA3AF] text-sm py-8">No matching events.</p>
          )}

          {!browseLoading && firstEvents.length === 0 && !browseError && (
            <p className="text-center text-[#9CA3AF] text-sm py-8">
              Click Search to load events for {browseProgram} {browseSeason}.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
