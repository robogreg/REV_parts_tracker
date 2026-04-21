'use client';

import { useEffect } from 'react';

export default function AdminEventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AdminEventsError]', error);
  }, [error]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-400">Something went wrong</h2>
        <pre className="text-xs text-red-300 whitespace-pre-wrap bg-red-950/30 rounded-xl p-4 overflow-auto max-h-64">
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-red-800/50 hover:bg-red-800 text-[var(--tx-primary)] text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
