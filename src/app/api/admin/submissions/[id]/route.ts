import { NextResponse } from 'next/server';
import { getProfile, createServiceClient } from '@/lib/supabase/server';
import { deletePdf } from '@/lib/r2';

export const runtime = 'nodejs';

/**
 * Clears an assessment, returning the trainee to "Not started" so they can be
 * assessed again from scratch.
 *
 * Deleting the submission cascades its scores and its event history, so the
 * essentials are copied into submission_resets first — a mark may already have
 * reached the trainee by email, and there must remain a record that it existed
 * and who withdrew it.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const { id } = await params;
  const reason = new URL(request.url).searchParams.get('reason');
  const db = createServiceClient();

  const { data: submission, error } = await db
    .from('submissions')
    .select(
      `id, student_id, assessor_id, assessed_on, theory_total, theory_percentage,
       practical_total, practical_percentage, email_status, pdf_object_key`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!submission) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const { error: logError } = await db.from('submission_resets').insert({
    student_id: submission.student_id,
    assessor_id: submission.assessor_id,
    cleared_by: profile.id,
    original_submission_id: submission.id,
    assessed_on: submission.assessed_on,
    theory_total: submission.theory_total,
    theory_percentage: submission.theory_percentage,
    practical_total: submission.practical_total,
    practical_percentage: submission.practical_percentage,
    email_status: submission.email_status,
    pdf_object_key: submission.pdf_object_key,
    reason,
  });

  // Refuse to clear if the record of the clearing cannot be written.
  if (logError) {
    return NextResponse.json(
      { error: `Could not record the reset: ${logError.message}` },
      { status: 500 },
    );
  }

  // Best effort — an orphaned object in R2 is harmless, and must not block the
  // reset the administrator asked for.
  if (submission.pdf_object_key) {
    try {
      await deletePdf(submission.pdf_object_key);
    } catch {
      // intentionally ignored
    }
  }

  const { error: deleteError } = await db.from('submissions').delete().eq('id', id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, studentId: submission.student_id });
}
