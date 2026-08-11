'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import type { SubmissionStatus } from '@/lib/database.types';

export type TraineeRow = {
  id: string;
  fullName: string;
  registrationNumber: string;
  course: string | null;
  occupation: string | null;
  centreName: string;
  hasEmail: boolean;
  submission: {
    id: string;
    status: SubmissionStatus;
    theory_percentage: number | null;
    practical_percentage: number | null;
  } | null;
};

export function TraineeList({ rows }: { rows: TraineeRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((r) => {
      const assessed = Boolean(r.submission && r.submission.status !== 'draft');
      if (filter === 'pending' && assessed) return false;
      if (filter === 'done' && !assessed) return false;
      if (!q) return true;

      // Search across the three fields that disambiguate a trainee in practice.
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.registrationNumber.toLowerCase().includes(q) ||
        (r.occupation ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, registration number or occupation"
          aria-label="Search trainees"
          className="tap-target flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-mvttc-500 focus:ring-2 focus:ring-mvttc-500/25"
        />

        <div
          role="group"
          aria-label="Filter by assessment status"
          className="flex rounded-lg border border-border bg-surface p-0.5"
        >
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`tap-target flex-1 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-mvttc-700 text-white' : 'hover:bg-mvttc-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
          No trainees match that search.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/assess/${r.id}`}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-mvttc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-mvttc-500"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="font-medium">{r.fullName}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {r.registrationNumber}
                      {r.occupation ? ` · ${r.occupation}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.course ?? '—'} · {r.centreName}
                      {!r.hasEmail && (
                        <span className="ml-2 text-amber-700">· no email on file</span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {r.submission &&
                      r.submission.theory_percentage !== null &&
                      r.submission.practical_percentage !== null && (
                        <span className="text-sm tabular-nums text-muted">
                          T {r.submission.theory_percentage}% · P{' '}
                          {r.submission.practical_percentage}%
                        </span>
                      )}
                    <StatusBadge status={r.submission?.status ?? null} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
