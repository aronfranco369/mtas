import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';

export const metadata = { title: 'Final marks' };

export default async function FinalMarksPage() {
  const profile = await getProfile();
  if (profile?.role !== 'admin') redirect('/');

  const supabase = await createClient();

  const { data: marks } = await supabase
    .from('final_marks')
    .select('*')
    .order('centre_name')
    .order('full_name');

  const assessed = (marks ?? []).filter((m) => (m.assessor_count ?? 0) > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Final marks</h1>
          <p className="mt-1 text-sm text-muted">
            {assessed.length} of {marks?.length ?? 0} trainees assessed. Theory and
            practical are averaged across assessors and reported separately.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/api/admin/export"
            className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
          >
            Export CSV
          </Link>
          <Link
            href="/admin"
            className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border bg-mvttc-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Trainee</th>
              <th className="px-4 py-3 font-medium">Centre</th>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Occupation</th>
              <th className="px-4 py-3 text-right font-medium">Assessors</th>
              <th className="px-4 py-3 text-right font-medium">Theory</th>
              <th className="px-4 py-3 text-right font-medium">Practical</th>
            </tr>
          </thead>
          <tbody>
            {(marks ?? []).map((m) => (
              <tr key={m.student_id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{m.full_name}</p>
                  <p className="text-xs text-muted">{m.registration_number}</p>
                </td>
                <td className="px-4 py-3">{m.centre_name}</td>
                <td className="px-4 py-3">{m.course ?? '—'}</td>
                <td className="px-4 py-3">{m.occupation ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {m.assessor_count ?? 0}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {m.theory_percentage !== null ? `${m.theory_percentage}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {m.practical_percentage !== null ? `${m.practical_percentage}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
