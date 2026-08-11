import type { SubmissionStatus } from '@/lib/database.types';

const STYLES: Record<SubmissionStatus | 'not_started', { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'bg-slate-100 text-slate-700' },
  draft: { label: 'Draft', className: 'bg-amber-100 text-amber-800' },
  submitted: { label: 'Submitted', className: 'bg-sky-100 text-sky-800' },
  pdf_generated: { label: 'Report ready', className: 'bg-indigo-100 text-indigo-800' },
  emailed: { label: 'Emailed', className: 'bg-mvttc-100 text-mvttc-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
};

export function StatusBadge({ status }: { status: SubmissionStatus | null }) {
  const { label, className } = STYLES[status ?? 'not_started'];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
