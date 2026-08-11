import { createClient, getProfile } from '@/lib/supabase/server';
import { TraineeList } from '@/components/TraineeList';

export const metadata = { title: 'Trainees' };

export default async function TraineesPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  // RLS restricts this to the assessor's own centres; admins see every centre.
  const [{ data: students }, { data: submissions }] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, registration_number, course, occupation, gender, email, centre_id, centres(name)')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('submissions')
      .select('id, student_id, status, theory_percentage, practical_percentage')
      .eq('assessor_id', profile!.id),
  ]);

  const byStudent = new Map((submissions ?? []).map((s) => [s.student_id, s]));

  const rows = (students ?? []).map((s) => ({
    id: s.id,
    fullName: s.full_name,
    registrationNumber: s.registration_number,
    course: s.course,
    occupation: s.occupation,
    centreName: (s.centres as { name: string } | null)?.name ?? '—',
    hasEmail: Boolean(s.email),
    submission: byStudent.get(s.id) ?? null,
  }));

  const done = rows.filter((r) => r.submission && r.submission.status !== 'draft').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Instructor trainees</h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} trainee{rows.length === 1 ? '' : 's'} · {done} assessed ·{' '}
          {rows.length - done} remaining
        </p>
      </div>

      <TraineeList rows={rows} />
    </div>
  );
}
