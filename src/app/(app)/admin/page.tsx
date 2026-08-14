import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';
import { RetryButton } from '@/components/RetryButton';
import { ClearAssessmentButton } from '@/components/ClearAssessmentButton';
import { StudentCentreMove } from '@/components/StudentCentreMove';
import { AddStudentForm } from '@/components/AddStudentForm';
import { formatAssessmentDate } from '@/lib/scoring';
import type { SubmissionStatus } from '@/lib/database.types';

export const metadata = { title: 'Admin' };

/** Trainees per page. The list is paginated so one screen is one small query. */
const PAGE_SIZE = 25;

type TraineeRow = {
  id: string;
  full_name: string;
  registration_number: string;
  centre_id: string;
  centres: { name: string } | null;
  submissions: {
    id: string;
    status: SubmissionStatus;
    email_status: string | null;
    email_error: string | null;
    assessed_on: string | null;
    theory_total: number | null;
    theory_percentage: number | null;
    practical_total: number | null;
    practical_percentage: number | null;
    profiles: { full_name: string } | null;
  }[];
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string; status?: string; q?: string; page?: string }>;
}) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') redirect('/');

  const { centre, status, q, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: centres }, { data: progress }, { data: assessors }, { data: roster }] =
    await Promise.all([
      supabase.from('centres').select('id, name').order('name'),
      supabase.from('centre_progress').select('*').order('centre_name'),
      supabase.from('assessor_progress').select('*').order('centre_name'),
      // Existing course and occupation wording, offered as suggestions when
      // registering a trainee so the values stay groupable.
      supabase.from('students').select('course, occupation'),
    ]);

  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
  const courses = distinct((roster ?? []).map((r) => r.course));
  const occupations = distinct((roster ?? []).map((r) => r.occupation));

  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  // Commas and parentheses are the or() filter's own syntax, so they cannot be
  // passed through from a search box.
  const search = (q ?? '').trim().replace(/[,()*"\\]/g, ' ').trim();

  /**
   * The list is keyed on the trainee, not the assessment, so trainees who have
   * never been assessed appear too — they are the ones an administrator may
   * move between centres. Filtering by a status inner-joins the assessments,
   * which narrows the page to trainees holding one.
   */
  let query = supabase
    .from('students')
    .select(
      `id, full_name, registration_number, centre_id,
       centres ( name ),
       submissions${status ? '!inner' : ''} (
         id, status, email_status, email_error, assessed_on,
         theory_total, theory_percentage, practical_total, practical_percentage,
         profiles!submissions_assessor_id_fkey ( full_name )
       )`,
      { count: 'exact' },
    )
    .eq('is_active', true)
    // id breaks ties: names repeat, and an unstable sort would let a trainee
    // appear on two pages or on none.
    .order('full_name')
    .order('id')
    .range(from, from + PAGE_SIZE - 1);

  if (centre) query = query.eq('centre_id', centre);
  if (status) query = query.eq('submissions.status', status as never);
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,registration_number.ilike.%${search}%`,
    );
  }

  const { data, count } = await query;
  const trainees = (data ?? []) as unknown as TraineeRow[];

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { centre, status, q, page: String(page), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/admin?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Administration</h1>
          <p className="mt-1 text-sm text-muted">
            {total} trainee{total === 1 ? '' : 's'} match
            {total === 1 ? 'es' : ''} these filters
            {total > 0 && ` · showing ${from + 1}–${Math.min(from + PAGE_SIZE, total)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/users"
            className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
          >
            Assessors &amp; accounts
          </Link>
          <Link
            href="/admin/final-marks"
            className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
          >
            Final marks
          </Link>
          <Link
            href="/api/admin/bulk-pdf"
            className="tap-target flex items-center rounded-lg bg-mvttc-700 px-4 text-sm font-medium text-white hover:bg-mvttc-800"
          >
            Download all PDFs
          </Link>
        </div>
      </div>

      {/* Progress per centre — the college-wide "how far along is everyone" view. */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Progress by centre</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(progress ?? []).map((c) => {
            const pct = Number(c.percent_complete ?? 0);
            const centreAssessors = (assessors ?? []).filter(
              (a) => a.centre_id === c.centre_id,
            );

            return (
              <div
                key={c.centre_id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">{c.centre_name}</h3>
                  <span className="text-sm font-semibold tabular-nums">{pct}%</span>
                </div>

                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-mvttc-100"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${c.centre_name} assessment progress`}
                >
                  <div
                    className="h-full rounded-full bg-mvttc-600"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="mt-2 text-sm tabular-nums text-muted">
                  {c.assessed ?? 0} of {c.trainees ?? 0} assessed · {c.remaining ?? 0}{' '}
                  remaining
                </p>

                <p className="mt-1 text-xs text-muted">
                  {c.emailed ?? 0} emailed
                  {(c.pending_delivery ?? 0) > 0 && ` · ${c.pending_delivery} awaiting delivery`}
                  {(c.drafts ?? 0) > 0 && ` · ${c.drafts} in progress`}
                  {(c.failed ?? 0) > 0 && (
                    <span className="text-red-700"> · {c.failed} failed</span>
                  )}
                </p>

                <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                  {centreAssessors.length === 0 ? (
                    <li className="text-amber-700">No assessor assigned</li>
                  ) : (
                    centreAssessors.map((a) => (
                      <li key={a.assessor_id} className="flex justify-between gap-2">
                        <span className={a.is_active ? '' : 'text-muted line-through'}>
                          {a.full_name}
                        </span>
                        <span className="tabular-nums text-muted">
                          {a.submitted ?? 0} submitted
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <h2 className="font-serif text-lg font-semibold">Assessments</h2>

      <AddStudentForm
        centres={centres ?? []}
        courses={courses}
        occupations={occupations}
      />

      <form className="flex flex-wrap gap-2" method="get">
        <select
          name="centre"
          defaultValue={centre ?? ''}
          className="tap-target rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">All centres</option>
          {centres?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status ?? ''}
          className="tap-target rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="pdf_generated">Report ready</option>
          <option value="emailed">Emailed</option>
          <option value="failed">Failed</option>
        </select>

        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or index number"
          aria-label="Search trainees by name or index number"
          className="tap-target min-w-56 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
        />

        <button
          type="submit"
          className="tap-target rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
        >
          Apply
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-mvttc-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Trainee</th>
              <th className="px-4 py-3 font-medium">Centre</th>
              <th className="px-4 py-3 font-medium">Assessor</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Theory</th>
              <th className="px-4 py-3 text-right font-medium">Practical</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((t) => {
              const assessments = t.submissions.filter((s) => s.status !== 'draft');
              const centreName = t.centres?.name ?? '—';

              // Never assessed: one row for the trainee, and the only row where
              // the centre may be changed. A draft is shown but does not block.
              if (assessments.length === 0) {
                const draft = t.submissions.find((s) => s.status === 'draft');

                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.full_name}</p>
                      <p className="text-xs text-muted">{t.registration_number}</p>
                    </td>
                    <td className="px-4 py-3">{centreName}</td>
                    <td className="px-4 py-3">{draft?.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">—</td>
                    <td className="px-4 py-3 text-right tabular-nums">—</td>
                    <td className="px-4 py-3 text-right tabular-nums">—</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={draft ? 'draft' : null} />
                    </td>
                    <td className="px-4 py-3">
                      <StudentCentreMove
                        studentId={t.id}
                        studentName={t.full_name}
                        centreId={t.centre_id}
                        centres={centres ?? []}
                        draftAssessor={draft ? (draft.profiles?.full_name ?? 'an assessor') : null}
                      />
                    </td>
                  </tr>
                );
              }

              return assessments.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.full_name}</p>
                    <p className="text-xs text-muted">{t.registration_number}</p>
                  </td>
                  <td className="px-4 py-3">{centreName}</td>
                  <td className="px-4 py-3">{r.profiles?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.assessed_on ? formatAssessmentDate(r.assessed_on) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.theory_total}/75 ({r.theory_percentage}%)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.practical_total}/75 ({r.practical_percentage}%)
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                    {r.email_error && (
                      <p className="mt-1 max-w-48 text-xs text-red-700">{r.email_error}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <Link
                        href={`/api/submissions/${r.id}/pdf`}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-mvttc-400"
                      >
                        PDF
                      </Link>
                      <RetryButton submissionId={r.id} />
                      <ClearAssessmentButton
                        submissionId={r.id}
                        studentName={t.full_name}
                      />
                    </div>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>

        {trainees.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            No trainees match these filters.
          </p>
        )}
      </div>

      {pageCount > 1 && (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Assessments pagination"
        >
          {page > 1 ? (
            <Link
              href={params({ page: String(page - 1) })}
              className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}

          <p className="text-sm text-muted tabular-nums">
            Page {page} of {pageCount}
          </p>

          {page < pageCount ? (
            <Link
              href={params({ page: String(page + 1) })}
              className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
