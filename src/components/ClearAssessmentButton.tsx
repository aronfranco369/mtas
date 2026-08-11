'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Clears an assessment so the trainee returns to "Not started".
 *
 * Destructive and not undoable, so it asks for explicit typed confirmation
 * rather than a single click — this permanently removes a mark the trainee may
 * already have received.
 */
export function ClearAssessmentButton({
  submissionId,
  studentName,
}: {
  submissionId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    setBusy(true);
    setError(null);

    const query = reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : '';
    const res = await fetch(`/api/admin/submissions/${submissionId}${query}`, {
      method: 'DELETE',
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not clear the assessment.');
      return;
    }

    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Clear
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-2">
      <p className="text-xs text-red-900">
        Clear the assessment for <strong>{studentName}</strong>? The marks, the
        report and the assessment history are deleted, and the trainee returns to
        Not started. This cannot be undone.
      </p>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional, kept on record)"
        aria-label="Reason for clearing"
        className="w-full rounded border border-red-300 bg-surface px-2 py-1.5 text-xs"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={clear}
          className="rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
        >
          {busy ? 'Clearing…' : 'Yes, clear it'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-xs text-red-800">{error}</p>}
    </div>
  );
}
