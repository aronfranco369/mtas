'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Moves an unassessed trainee to another centre.
 *
 * Only rendered for trainees with no submitted assessment; the server enforces
 * the same rule. A part-finished draft is discarded by the move, so that case
 * asks for confirmation first rather than acting on one click.
 */
export function StudentCentreMove({
  studentId,
  studentName,
  centreId,
  centres,
  draftAssessor,
}: {
  studentId: string;
  studentName: string;
  centreId: string;
  centres: { id: string; name: string }[];
  draftAssessor: string | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(centreId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function move() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centreId: target }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not move the trainee.');
      return;
    }

    setConfirming(false);
    router.refresh();
  }

  const unchanged = target === centreId;

  if (confirming) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
        <p className="text-xs text-amber-900">
          Move <strong>{studentName}</strong> to{' '}
          <strong>{centres.find((c) => c.id === target)?.name}</strong>? The draft
          started by {draftAssessor} is discarded.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={move}
            className="rounded-lg bg-amber-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {busy ? 'Moving…' : 'Yes, move'}
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

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={`centre-${studentId}`} className="sr-only">
          Centre for {studentName}
        </label>
        <select
          id={`centre-${studentId}`}
          value={target}
          disabled={busy}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
        >
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={busy || unchanged}
          onClick={() => (draftAssessor ? setConfirming(true) : move())}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-mvttc-400 disabled:opacity-40"
        >
          {busy ? 'Moving…' : 'Move'}
        </button>
      </div>

      {error && <p className="max-w-48 text-xs text-red-700">{error}</p>}
    </div>
  );
}
