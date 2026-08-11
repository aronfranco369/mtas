'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Re-runs PDF generation and email delivery for one submission. */
export function RetryButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setState('busy');
    setMessage(null);

    const res = await fetch(`/api/submissions/${submissionId}/process`, {
      method: 'POST',
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      setState('ok');
      router.refresh();
    } else {
      setState('error');
      setMessage(body.error ?? res.statusText);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={retry}
        disabled={state === 'busy'}
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-mvttc-400 disabled:opacity-60"
      >
        {state === 'busy' ? 'Retrying…' : state === 'ok' ? 'Done' : 'Retry'}
      </button>
      {message && <span className="max-w-40 text-xs text-red-700">{message}</span>}
    </span>
  );
}
