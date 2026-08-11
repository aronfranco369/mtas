import { NextResponse } from 'next/server';
import { createClient, getProfile } from '@/lib/supabase/server';
import { getPdf } from '@/lib/r2';
import { reportFilename } from '@/lib/scoring';

export const runtime = 'nodejs';

/**
 * Streams the stored report. The R2 bucket is private, so the object is fetched
 * server-side after the caller's access has been checked through RLS — no
 * public or guessable URL ever exists for a trainee's assessment.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from('submissions')
    .select(
      'id, pdf_object_key, assessed_on, students!inner ( full_name ), profiles!submissions_assessor_id_fkey!inner ( full_name )',
    )
    .eq('id', id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  if (!submission.pdf_object_key) {
    return NextResponse.json(
      { error: 'The report has not been generated yet' },
      { status: 409 },
    );
  }

  const studentName =
    (submission.students as unknown as { full_name: string }).full_name;
  const assessorName =
    (submission.profiles as unknown as { full_name: string } | null)?.full_name ?? '';

  const pdf = await getPdf(submission.pdf_object_key);
  const filename = reportFilename(
    studentName,
    assessorName,
    submission.assessed_on ?? new Date(),
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
