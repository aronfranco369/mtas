import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';
import { RetryButton } from '@/components/RetryButton';
import { formatAssessmentDate } from '@/lib/scoring';

export const metadata = { title: 'Admin' };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string; status?: string }>;
}) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') redirect('/');

  const { centre, status } = await searchParams;
  const supabase = await createClient();

  const [{ data: centres }, { data: progress }, { data: assessors }] = await Promise.all([
    supabase.from('centres').select('id, name').order('name'),
    supabase.from('centre_progress').select('*').order('centre_name'),
    supabase.from('assessor_progress').select('*').order('centre_name'),
  ]);

  let query = supabase
    .from('submissions')
    .select(
      `id, status, email_status, email_error, assessed_on,
       theory_total, theory_percentage, practical_total, practical_percentage,
       students!inner ( full_name, registration_number, centre_id, centres!inner ( name ) ),
       profiles!submissions_assessor_id_fkey!inner ( full_name )`,
    )
    .neq('status', 'draft')
    .order('assessed_on', { ascending: false })
    .limit(300);

  if (status) query = query.eq('status', status as never);

  const { data: allRows } = await query;

  // Centre lives on the joined student, so it is filtered after fetching.
  const rows = (allRows ?? []).filter((r) => {
    if (!centre) return true;
    return (r.students as unknown as { centre_id: string }).centre_id === centre;
  });

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Administration</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} assessment{rows.length === 1 ? '' : 's'}
            {Object.entries(counts).map(([k, v]) => ` · ${k}: ${v}`)}
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
            {rows.map((r) => {
              const student = r.students as unknown as {
                full_name: string;
                registration_number: string;
                centres: { name: string };
              };
              const assessor = r.profiles as unknown as { full_name: string };

              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{student.full_name}</p>
                    <p className="text-xs text-muted">{student.registration_number}</p>
                  </td>
                  <td className="px-4 py-3">{student.centres.name}</td>
                  <td className="px-4 py-3">{assessor.full_name}</td>
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
                    <div className="flex gap-2">
                      <Link
                        href={`/api/submissions/${r.id}/pdf`}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-mvttc-400"
                      >
                        PDF
                      </Link>
                      <RetryButton submissionId={r.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            No assessments match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
