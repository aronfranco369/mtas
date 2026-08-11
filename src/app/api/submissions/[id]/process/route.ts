import { NextResponse } from 'next/server';
import { createClient, getProfile } from '@/lib/supabase/server';
import { processSubmission } from '@/lib/process-submission';

// @react-pdf/renderer needs the Node runtime, not Edge.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Authorise against the caller's own RLS view before doing any work with the
  // service client: an assessor may only process their own submission.
  const supabase = await createClient();
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, assessor_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  if (profile.role !== 'admin' && submission.assessor_id !== profile.id) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  if (submission.status === 'draft') {
    return NextResponse.json(
      { error: 'Assessment has not been submitted yet' },
      { status: 400 },
    );
  }

  try {
    const result = await processSubmission(id);

    if (result.emailStatus === 'failed') {
      return NextResponse.json(
        { error: result.emailError ?? 'Email delivery failed', result },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Report generation failed' },
      { status: 500 },
    );
  }
}
