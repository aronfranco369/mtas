import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Reassigns a trainee to another centre.
 *
 * Only a trainee who has not been assessed may be moved: the centre appears on
 * the issued report and drives which assessor can see them, so moving someone
 * with a mark on record would silently contradict a report already sent.
 *
 * A part-finished draft does not block the move — it is discarded first. The
 * draft belongs to an assessor in the old centre who would lose sight of the
 * trainee anyway, and leaving it behind would block the new centre's assessor
 * from starting (one submission per assessor per trainee per intake).
 */
const MoveStudent = z.object({
  centreId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = MoveStudent.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid centre must be given' }, { status: 400 });
  }

  const { centreId } = parsed.data;
  const db = createServiceClient();

  const { data: student, error: studentError } = await db
    .from('students')
    .select('id, full_name, centre_id')
    .eq('id', id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
  }

  const { data: centre } = await db
    .from('centres')
    .select('id, name')
    .eq('id', centreId)
    .maybeSingle();

  if (!centre) {
    return NextResponse.json({ error: 'Centre not found' }, { status: 404 });
  }
  if (centre.id === student.centre_id) {
    return NextResponse.json(
      { error: `${student.full_name} is already at ${centre.name}` },
      { status: 400 },
    );
  }

  const { data: submissions, error: submissionError } = await db
    .from('submissions')
    .select('id, status')
    .eq('student_id', id);

  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }

  const assessed = (submissions ?? []).filter((s) => s.status !== 'draft');
  if (assessed.length > 0) {
    return NextResponse.json(
      {
        error: `${student.full_name} has already been assessed and cannot be moved. Clear the assessment first.`,
      },
      { status: 409 },
    );
  }

  // Drafts only. Deleting the submission cascades its scores and events.
  const draftIds = (submissions ?? []).map((s) => s.id);
  if (draftIds.length > 0) {
    const { error } = await db.from('submissions').delete().in('id', draftIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: updateError } = await db
    .from('students')
    .update({ centre_id: centreId })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    centreName: centre.name,
    draftsDiscarded: draftIds.length,
  });
}
