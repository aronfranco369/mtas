import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { renderAssessmentPdf, type AssessmentData } from '@/lib/pdf';
import { uploadPdf } from '@/lib/r2';
import { sendReportEmail } from '@/lib/email';
import { pdfObjectKey, reportFilename } from '@/lib/scoring';
import type { Section } from '@/lib/constants';

export type ProcessResult = {
  submissionId: string;
  pdfObjectKey: string;
  emailStatus: 'sent' | 'no_email_on_file' | 'failed';
  emailError?: string;
};

/**
 * Generates the report, stores it, and emails the trainee.
 *
 * Runs after the assessment and its scores are already committed, so a failure
 * here never loses assessment data — each step is independently retryable from
 * the admin dashboard. Uses the service client because it must act outside any
 * one user's RLS scope (an admin retrying another assessor's submission).
 */
export async function processSubmission(submissionId: string): Promise<ProcessResult> {
  const db = createServiceClient();

  const { data: submission, error } = await db
    .from('submissions')
    .select(
      `id, version, assessed_on, assessor_signature, theory_total, theory_percentage,
       practical_total, practical_percentage, theory_comments, practical_comments,
       students!inner (
         full_name, registration_number, occupation, course, email,
         centres!inner ( name, slug ),
         intakes!inner ( slug )
       ),
       profiles!submissions_assessor_id_fkey!inner ( full_name, email )`,
    )
    .eq('id', submissionId)
    .single();

  if (error || !submission) {
    throw new Error(`Submission ${submissionId} not found: ${error?.message ?? 'no row'}`);
  }

  const student = submission.students as unknown as {
    full_name: string;
    registration_number: string;
    occupation: string | null;
    course: string | null;
    email: string | null;
    centres: { name: string; slug: string };
    intakes: { slug: string };
  };
  const assessor = submission.profiles as unknown as {
    full_name: string;
    email: string | null;
  } | null;
  const assessorName = assessor?.full_name ?? '';

  // ── gather the 30 scores in form order ────────────────────────────────
  const { data: scoreRows } = await db
    .from('submission_scores')
    .select('score, assessment_areas!inner ( section, area_number, title )')
    .eq('submission_id', submissionId);

  const sections = { theory: [], practical: [] } as Record<
    Section,
    { areaNumber: number; title: string; score: number }[]
  >;

  for (const row of scoreRows ?? []) {
    const area = row.assessment_areas as unknown as {
      section: Section;
      area_number: number;
      title: string;
    };
    sections[area.section].push({
      areaNumber: area.area_number,
      title: area.title,
      score: row.score,
    });
  }

  sections.theory.sort((a, b) => a.areaNumber - b.areaNumber);
  sections.practical.sort((a, b) => a.areaNumber - b.areaNumber);

  const assessedOn = submission.assessed_on ?? new Date().toISOString().slice(0, 10);

  const data: AssessmentData = {
    student: {
      fullName: student.full_name,
      registrationNumber: student.registration_number,
      occupation: student.occupation,
      course: student.course,
    },
    assessorName,
    centreName: student.centres.name,
    assessedOn,
    sections: {
      theory: {
        rows: sections.theory,
        total: submission.theory_total ?? 0,
        percentage: submission.theory_percentage ?? 0,
        comments: submission.theory_comments,
      },
      practical: {
        rows: sections.practical,
        total: submission.practical_total ?? 0,
        percentage: submission.practical_percentage ?? 0,
        comments: submission.practical_comments,
      },
    },
    signature: submission.assessor_signature ?? assessorName,
  };

  // ── 1. render + store ──────────────────────────────────────────────────
  const pdf = await renderAssessmentPdf(data);
  const filename = reportFilename(student.full_name, assessorName, assessedOn);
  const key = pdfObjectKey({
    intakeSlug: student.intakes.slug,
    centreSlug: student.centres.slug,
    registrationNumber: student.registration_number,
    submissionId: submission.id,
    version: submission.version,
  });

  await uploadPdf(key, pdf, filename);

  await db
    .from('submissions')
    .update({
      pdf_object_key: key,
      pdf_generated_at: new Date().toISOString(),
      status: 'pdf_generated',
    })
    .eq('id', submissionId);

  await db.from('submission_events').insert({
    submission_id: submissionId,
    event_type: 'pdf_generated',
    detail: { key, version: submission.version },
  });

  // ── 2. deliver ─────────────────────────────────────────────────────────
  if (!student.email) {
    await db
      .from('submissions')
      .update({ email_status: 'no_email_on_file', status: 'pdf_generated' })
      .eq('id', submissionId);

    await db.from('submission_events').insert({
      submission_id: submissionId,
      event_type: 'email_skipped',
      detail: { reason: 'no_email_on_file' },
    });

    return { submissionId, pdfObjectKey: key, emailStatus: 'no_email_on_file' };
  }

  // Fixed College address, openly copied on every report.
  const reportCc = process.env.REPORT_CC_EMAIL || null;
  // The assessor is blind-copied: they keep a record of what they submitted
  // without their personal address being exposed to the trainee.
  const assessorBcc = assessor?.email ?? null;

  try {
    await sendReportEmail({
      to: student.email,
      cc: reportCc,
      bcc: assessorBcc,
      studentName: student.full_name,
      assessorName,
      centreName: student.centres.name,
      theoryTotal: submission.theory_total ?? 0,
      theoryPercentage: submission.theory_percentage ?? 0,
      practicalTotal: submission.practical_total ?? 0,
      practicalPercentage: submission.practical_percentage ?? 0,
      pdf,
      filename,
    });

    await db
      .from('submissions')
      .update({
        email_status: 'sent',
        email_sent_at: new Date().toISOString(),
        email_error: null,
        status: 'emailed',
      })
      .eq('id', submissionId);

    await db.from('submission_events').insert({
      submission_id: submissionId,
      event_type: 'emailed',
      detail: { to: student.email, cc: reportCc, bcc: assessorBcc },
    });

    return { submissionId, pdfObjectKey: key, emailStatus: 'sent' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown email failure';

    await db
      .from('submissions')
      .update({ email_status: 'failed', email_error: message, status: 'failed' })
      .eq('id', submissionId);

    await db.from('submission_events').insert({
      submission_id: submissionId,
      event_type: 'email_failed',
      detail: { error: message },
    });

    return { submissionId, pdfObjectKey: key, emailStatus: 'failed', emailError: message };
  }
}
