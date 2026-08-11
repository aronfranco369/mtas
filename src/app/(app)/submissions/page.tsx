import Link from 'next/link';
import { createClient, getProfile } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';
import { formatAssessmentDate } from '@/lib/scoring';

export const metadata = { title: 'My assessments' };

export default async function SubmissionsPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: rows } = await supabase
    .from('submissions')
    .select(
      'id, status, email_status, assessed_on, theory_total, theory_percentage, practical_total, practical_percentage, students!inner ( full_name, registration_number )',
    )
    .eq('assessor_id', profile!.id)
    .neq('status', 'draft')
    .order('assessed_on', { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold">My assessments</h1>
        <p className="mt-1 text-sm text-muted">
          {rows?.length ?? 0} submitted assessment{rows?.length === 1 ? '' : 's'}
        </p>
      </div>

      {!rows || rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
          No assessments submitted yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const student = r.students as unknown as {
              full_name: string;
              registration_number: string;
            };

            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{student.full_name}</p>
                  <p className="text-sm text-muted">
                    {student.registration_number}
                    {r.assessed_on && ` · ${formatAssessmentDate(r.assessed_on)}`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-muted">
                    T {r.theory_total}/75 ({r.theory_percentage}%) · P {r.practical_total}/75
                    ({r.practical_percentage}%)
                  </span>
                  <StatusBadge status={r.status} />
                  <Link
                    href={`/api/submissions/${r.id}/pdf`}
                    className="tap-target flex items-center rounded-lg border border-border px-3 text-sm font-medium hover:border-mvttc-400"
                  >
                    PDF
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
