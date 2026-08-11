import { notFound, redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { AssessmentForm } from '@/components/AssessmentForm';

export const metadata = { title: 'Assessment' };

export default async function AssessPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const { data: student } = await supabase
    .from('students')
    .select(
      'id, full_name, registration_number, course, occupation, gender, email, intake_id, centre_id, centres(name), intakes(name)',
    )
    .eq('id', studentId)
    .single();

  if (!student) notFound();

  const { data: areas } = await supabase
    .from('assessment_areas')
    .select('id, section, area_number, title')
    .eq('is_active', true)
    .order('section')
    .order('area_number');

  // One assessment per assessor per trainee per intake — reopen if it exists.
  const { data: submission } = await supabase
    .from('submissions')
    .select('*')
    .eq('student_id', studentId)
    .eq('assessor_id', profile.id)
    .eq('intake_id', student.intake_id)
    .maybeSingle();

  const { data: scores } = submission
    ? await supabase
        .from('submission_scores')
        .select('area_id, score')
        .eq('submission_id', submission.id)
    : { data: [] };

  return (
    <AssessmentForm
      student={{
        id: student.id,
        fullName: student.full_name,
        registrationNumber: student.registration_number,
        course: student.course,
        occupation: student.occupation,
        email: student.email,
        intakeId: student.intake_id,
        centreName: (student.centres as { name: string } | null)?.name ?? '—',
        intakeName: (student.intakes as { name: string } | null)?.name ?? '—',
      }}
      assessor={{ id: profile.id, fullName: profile.full_name }}
      areas={areas ?? []}
      submission={submission ?? null}
      existingScores={Object.fromEntries((scores ?? []).map((s) => [s.area_id, s.score]))}
    />
  );
}
