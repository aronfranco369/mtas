import { SECTION_MAX } from './constants';

/**
 * Percentage shown on the assessment form.
 *
 * Half-up rounding to a whole number, matching the official document:
 *   46/75 → 61.33 → 61%
 *   41/75 → 54.67 → 55%
 *
 * Math.round is half-up for positive numbers, which is what we want here.
 * These values are recomputed server-side on submit (see the submit_assessment
 * Postgres function); anything computed in the browser is display-only.
 */
export function percentage(total: number, max: number = SECTION_MAX): number {
  if (max <= 0) return 0;
  return Math.round((total / max) * 100);
}

/** Sum of the 15 area scores for a section. */
export function sectionTotal(scores: Record<number, number | undefined>): number {
  return Object.values(scores).reduce<number>((sum, s) => sum + (s ?? 0), 0);
}

/** How many of the 15 areas have been scored — drives the progress indicator. */
export function answeredCount(scores: Record<number, number | undefined>): number {
  return Object.values(scores).filter((s) => typeof s === 'number').length;
}

/**
 * Filename matching the convention the college already uses:
 *   "ABAS J. MGOVANO - Frank Urio - 7-13-2026.pdf"
 * Used for downloads and ZIP entries; storage keys are separate and use IDs.
 */
export function reportFilename(
  studentName: string,
  assessorName: string,
  assessedOn: string | Date,
): string {
  const d = typeof assessedOn === 'string' ? new Date(assessedOn) : assessedOn;
  const stamp = `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safe(studentName)} - ${safe(assessorName)} - ${stamp}.pdf`;
}

/** M/D/YYYY, as printed on the form. */
export function formatAssessmentDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Storage key: IDs and version keep regeneration idempotent and non-destructive. */
export function pdfObjectKey(params: {
  intakeSlug: string;
  centreSlug: string;
  registrationNumber: string;
  submissionId: string;
  version: number;
}): string {
  const reg = params.registrationNumber.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${params.intakeSlug}/${params.centreSlug}/${reg}/${params.submissionId}-v${params.version}.pdf`;
}
