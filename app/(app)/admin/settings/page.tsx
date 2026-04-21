'use client';

import { useState, useEffect } from 'react';
import { KeyRound, Check, AlertCircle, Eye, EyeOff, ExternalLink, Trash2, FlaskConical } from 'lucide-react';
import { getAuthHeaders } from '@/lib/firebase-client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const SUPER_ADMIN_EMAIL = 'greg@revrobotics.com';

interface SettingsState {
  firstApiKeySet: boolean;
  firstFtcApiKeySet: boolean;
  bigcommerceStoreHash: string;
  bigcommerceApiTokenSet: boolean;
}

// Credential row for simple single-value credentials (BigCommerce store hash, API token)
function CredentialRow({
  label,
  description,
  isSet,
  onSave,
  onClear,
  placeholder,
  helpUrl,
  helpText,
  isHash = false,
}: {
  label: string;
  description: string;
  isSet: boolean;
  onSave: (value: string) => Promise<void>;
  onClear: () => Promise<void>;
  placeholder: string;
  helpUrl?: string;
  helpText?: string;
  isHash?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(value.trim());
      setValue('');
      setEditing(false);
      setShow(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await onClear();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--tx-primary)]">{label}</p>
            {isSet ? (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-800/40 rounded-full px-2 py-0.5">
                <Check className="w-3 h-3" /> Configured
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-900/30 text-amber-400 border border-amber-800/40 rounded-full px-2 py-0.5">
                <AlertCircle className="w-3 h-3" /> Not set
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--tx-muted)] mt-1">{description}</p>
          {helpUrl && (
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#FF6B00] hover:underline mt-1"
            >
              {helpText ?? 'Get credentials'} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSet && !editing && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="p-1.5 text-[var(--tx-muted)] hover:text-red-400 transition-colors"
              title="Clear this credential"
            >
              {saving ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-xs font-medium transition-colors"
          >
            {isSet ? 'Replace' : 'Set'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <input
              type={isHash || show ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={placeholder}
              autoFocus
              className="w-full bg-[var(--bg-base)] border border-[var(--bg-hover2)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-faint)] outline-none focus:border-[#FF6B00] transition-colors font-mono"
            />
            {!isHash && (
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx-faint)] hover:text-white p-1"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(false); setValue(''); setShow(false); }}
              className="px-3 py-1.5 text-xs text-[var(--tx-muted)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-xs font-medium transition-colors disabled:opacity-60"
            >
              {saving && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Dedicated row for FIRST API keys — accepts username + token separately and
// auto-encodes to Base64, so the user never has to touch btoa() themselves.
function FirstApiKeyRow({
  label,
  description,
  isSet,
  settingsKey,
  program,
  onSave,
  onClear,
  helpUrl,
}: {
  label: string;
  description: string;
  isSet: boolean;
  settingsKey: string;
  program: 'FRC' | 'FTC';
  onSave: (key: string, value: string) => Promise<void>;
  onClear: () => Promise<void>;
  helpUrl: string;
}) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSave() {
    if (!username.trim() || !token.trim()) return;
    setSaving(true);
    try {
      const encoded = btoa(`${username.trim()}:${token.trim()}`);
      await onSave(settingsKey, encoded);
      setUsername('');
      setToken('');
      setEditing(false);
      setTestResult(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!username.trim() || !token.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const encoded = btoa(`${username.trim()}:${token.trim()}`);
      const headers = await getAuthHeaders();
      const season = new Date().getFullYear();
      const res = await fetch(
        `/api/first/events/test?program=${program}&season=${season}&key=${encodeURIComponent(encoded)}`,
        { headers }
      );
      const data = await res.json() as { ok: boolean; message: string };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'Request failed' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--tx-primary)]">{label}</p>
            {isSet ? (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-800/40 rounded-full px-2 py-0.5">
                <Check className="w-3 h-3" /> Configured
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-900/30 text-amber-400 border border-amber-800/40 rounded-full px-2 py-0.5">
                <AlertCircle className="w-3 h-3" /> Not set
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--tx-muted)] mt-1">{description}</p>
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#FF6B00] hover:underline mt-1"
          >
            Register for {program} API access <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSet && !editing && (
            <button
              onClick={onClear}
              className="p-1.5 text-[var(--tx-muted)] hover:text-red-400 transition-colors"
              title="Clear this credential"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => { setEditing(!editing); setTestResult(null); }}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-xs font-medium transition-colors"
          >
            {isSet ? 'Replace' : 'Set'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your FIRST account username"
              autoFocus
              className="w-full bg-[var(--bg-base)] border border-[var(--bg-hover2)] rounded-lg px-3 py-2 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-faint)] outline-none focus:border-[#FF6B00] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--tx-muted)] mb-1">Auth Token</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token from FIRST API portal"
                className="w-full bg-[var(--bg-base)] border border-[var(--bg-hover2)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--tx-primary)] placeholder-[var(--tx-faint)] outline-none focus:border-[#FF6B00] transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx-faint)] hover:text-white p-1"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
              testResult.ok
                ? 'bg-green-900/20 border border-green-800/40 text-green-400'
                : 'bg-red-900/20 border border-red-800/40 text-red-400'
            }`}>
              {testResult.ok ? <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(false); setUsername(''); setToken(''); setTestResult(null); }}
              className="px-3 py-1.5 text-xs text-[var(--tx-muted)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTest}
              disabled={testing || saving || !username.trim() || !token.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-xs font-medium transition-colors disabled:opacity-60"
            >
              {testing ? <Spinner size="sm" /> : <FlaskConical className="w-3.5 h-3.5" />}
              Test
            </button>
            <button
              onClick={handleSave}
              disabled={saving || testing || !username.trim() || !token.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-xs font-medium transition-colors disabled:opacity-60"
            >
              {saving && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [fetching, setFetching] = useState(true);

  // Guard: only super admin can access this page
  useEffect(() => {
    if (!loading && user && user.email !== SUPER_ADMIN_EMAIL) {
      router.replace('/admin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.email !== SUPER_ADMIN_EMAIL) return;
    fetchSettings();
  }, [user]);

  async function fetchSettings() {
    setFetching(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/settings', { headers });
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json() as SettingsState;
      setSettings(data);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setFetching(false);
    }
  }

  async function saveKey(key: string, value: string) {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) throw new Error('Save failed');
    toast.success('Saved');
    await fetchSettings();
    return;
  }

  async function clearKey(key: string) {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/settings', {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error('Clear failed');
    toast.success('Cleared');
    await fetchSettings();
  }

  if (loading || (user && user.email !== SUPER_ADMIN_EMAIL)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-[#FF6B00]/15 rounded-lg flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-[#FF6B00]" />
          </div>
          <h1 className="text-xl font-display text-[var(--tx-primary)]">Settings</h1>
        </div>
        <p className="text-sm text-[var(--tx-muted)]">
          Super admin only — API credentials for external integrations. Keys are stored securely
          server-side and never exposed to the browser.
        </p>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* FIRST Inspires */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wider mb-3">
              FIRST Inspires API
            </h2>
            <div className="space-y-3">
              <FirstApiKeyRow
                label="FRC API Key"
                description="Credentials for the FRC Events API (frc-events.firstinspires.org). FRC and FTC use separate accounts."
                isSet={settings?.firstApiKeySet ?? false}
                settingsKey="firstApiKey"
                program="FRC"
                onSave={saveKey}
                onClear={() => clearKey('firstApiKey')}
                helpUrl="https://frc-events.firstinspires.org/services/API"
              />
              <FirstApiKeyRow
                label="FTC API Key"
                description="Credentials for the FTC Events API (ftc-events.firstinspires.org). FRC and FTC use separate accounts."
                isSet={settings?.firstFtcApiKeySet ?? false}
                settingsKey="firstFtcApiKey"
                program="FTC"
                onSave={saveKey}
                onClear={() => clearKey('firstFtcApiKey')}
                helpUrl="https://ftc-events.firstinspires.org/services/API"
              />
            </div>
          </section>

          {/* BigCommerce / REV Catalog */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wider mb-3">
              REV Robotics Product Catalog (BigCommerce)
            </h2>
            <div className="space-y-3">
              <CredentialRow
                label="Store Hash"
                description="The store identifier from your BigCommerce URL: api.bigcommerce.com/stores/{store_hash}/v3"
                isSet={!!(settings?.bigcommerceStoreHash)}
                placeholder="abc123xyz"
                helpUrl="https://developer.bigcommerce.com/docs/rest-authentication"
                helpText="BigCommerce API docs"
                isHash
                onSave={(v) => saveKey('bigcommerceStoreHash', v)}
                onClear={() => clearKey('bigcommerceStoreHash')}
              />
              <CredentialRow
                label="API Token"
                description="X-Auth-Token header value from your BigCommerce API account."
                isSet={settings?.bigcommerceApiTokenSet ?? false}
                placeholder="your-bigcommerce-api-token"
                helpUrl="https://support.bigcommerce.com/s/article/Store-API-Accounts"
                helpText="Create a BigCommerce API account"
                onSave={(v) => saveKey('bigcommerceApiToken', v)}
                onClear={() => clearKey('bigcommerceApiToken')}
              />
            </div>
          </section>

          {/* Current admin list note */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wider mb-3">
              Admin Access
            </h2>
            <div className="bg-[var(--bg-card)] border border-[var(--bg-hover)] rounded-xl p-4 text-sm text-[var(--tx-muted)]">
              <p>
                Admin emails are set via the <code className="text-[var(--tx-primary)] text-xs bg-[var(--bg-hover)] px-1 py-0.5 rounded">NEXT_PUBLIC_ADMIN_EMAILS</code> environment
                variable in <code className="text-[var(--tx-primary)] text-xs bg-[var(--bg-hover)] px-1 py-0.5 rounded">.env.production</code>.
                Changing them requires a new Docker build and deploy.
              </p>
              <p className="mt-2 text-xs">
                Current value: <span className="text-[var(--tx-primary)] font-mono">{process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '(not set)'}</span>
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
