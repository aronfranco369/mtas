'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { percentage } from '@/lib/scoring';
import { PERFORMANCE_SCALE, SECTION_MAX, SECTIONS, type Section } from '@/lib/constants';
import type { Submission } from '@/lib/database.types';

type Area = { id: string; section: Section; area_number: number; title: string };

type StudentInfo = {
  id: string;
  fullName: string;
  registrationNumber: string;
  course: string | null;
  occupation: string | null;
  email: string | null;
  intakeId: string;
  centreName: string;
  intakeName: string;
};

type Step = 'theory' | 'practical' | 'review';

const STEPS: Step[] = ['theory', 'practical', 'review'];

/**
 * Supabase rejects with a plain PostgrestError object, not an Error instance,
 * so `e instanceof Error` misses it and the real reason is lost. Pull the
 * message out of whatever shape actually arrives.
 */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const err = e as { message?: string; details?: string; hint?: string };
    const parts = [err.message, err.details, err.hint].filter(Boolean);
    if (parts.length > 0) return parts.join(' — ');
  }
  return fallback;
}

export function AssessmentForm({
  student,
  assessor,
  areas,
  submission,
  existingScores,
}: {
  student: StudentInfo;
  assessor: { id: string; fullName: string };
  areas: Area[];
  submission: Submission | null;
  existingScores: Record<string, number>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const draftKey = `mvttc:draft:${student.id}:${assessor.id}`;
  const locked = Boolean(submission?.locked_at);

  const [step, setStep] = useState<Step>('theory');
  const [scores, setScores] = useState<Record<string, number>>(existingScores);
  const [theoryComments, setTheoryComments] = useState(submission?.theory_comments ?? '');
  const [practicalComments, setPracticalComments] = useState(
    submission?.practical_comments ?? '',
  );
  const [signature, setSignature] = useState(
    submission?.assessor_signature ?? assessor.fullName,
  );
  const [assessedOn, setAssessedOn] = useState(
    submission?.assessed_on ?? new Date().toISOString().slice(0, 10),
  );

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ submissionId: string; delivered: boolean } | null>(
    null,
  );
  const submissionIdRef = useRef<string | null>(submission?.id ?? null);
  // Deduplicates concurrent ensureSubmission calls from overlapping saves.
  const ensureInFlightRef = useRef<Promise<string> | null>(null);
  // Retained so submit can report why saving failed instead of a generic message.
  const lastSaveErrorRef = useRef<string | null>(null);

  const bySection = useMemo(
    () => ({
      theory: areas.filter((a) => a.section === 'theory'),
      practical: areas.filter((a) => a.section === 'practical'),
    }),
    [areas],
  );

  const totals = useMemo(() => {
    const sum = (section: Section) =>
      bySection[section].reduce((t, a) => t + (scores[a.id] ?? 0), 0);
    const answered = (section: Section) =>
      bySection[section].filter((a) => scores[a.id] !== undefined).length;

    return {
      theory: { total: sum('theory'), answered: answered('theory') },
      practical: { total: sum('practical'), answered: answered('practical') },
    };
  }, [bySection, scores]);

  const allAnswered = totals.theory.answered === 15 && totals.practical.answered === 15;

  // ── local draft: survives a dropped connection mid-assessment ───────────
  useEffect(() => {
    if (locked) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      // Server values win where they exist; the local draft fills any gaps left
      // by a save that did not complete, so an interrupted sync is recoverable.
      if (d.scores) {
        setScores((server) => ({ ...d.scores, ...server }));
      }
      if (!submission?.theory_comments && d.theoryComments) setTheoryComments(d.theoryComments);
      if (!submission?.practical_comments && d.practicalComments)
        setPracticalComments(d.practicalComments);
    } catch {
      localStorage.removeItem(draftKey);
    }
    // Intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (locked) return;
    localStorage.setItem(
      draftKey,
      JSON.stringify({ scores, theoryComments, practicalComments }),
    );
  }, [draftKey, scores, theoryComments, practicalComments, locked]);

  // ── debounced server-side draft sync ───────────────────────────────────
  /**
   * Resolves the draft submission id, creating one only if none exists.
   *
   * Must be idempotent: (student_id, assessor_id, intake_id) is unique, so a
   * plain insert can only ever succeed once. If the in-memory id is lost — a
   * dev-server restart, a remount, or two debounced saves racing — a
   * create-only implementation fails with 23505 forever and silently drops
   * every later score. So it looks the row up first, and recovers by lookup if
   * it loses an insert race.
   */
  const ensureSubmission = useCallback((): Promise<string> => {
    if (submissionIdRef.current) return Promise.resolve(submissionIdRef.current);
    if (ensureInFlightRef.current) return ensureInFlightRef.current;

    const findExisting = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('id')
        .eq('student_id', student.id)
        .eq('assessor_id', assessor.id)
        .eq('intake_id', student.intakeId)
        .maybeSingle();
      return data?.id ?? null;
    };

    const run = (async () => {
      const existing = await findExisting();
      if (existing) {
        submissionIdRef.current = existing;
        return existing;
      }

      const { data, error } = await supabase
        .from('submissions')
        .insert({
          student_id: student.id,
          assessor_id: assessor.id,
          intake_id: student.intakeId,
          status: 'draft',
        })
        .select('id')
        .single();

      if (error) {
        // Lost a race with a concurrent insert — adopt the row that won.
        const recovered = await findExisting();
        if (recovered) {
          submissionIdRef.current = recovered;
          return recovered;
        }
        throw error;
      }

      submissionIdRef.current = data.id;
      return data.id;
    })();

    ensureInFlightRef.current = run;
    run.finally(() => {
      ensureInFlightRef.current = null;
    });

    return run;
  }, [supabase, student.id, student.intakeId, assessor.id]);

  const syncDraft = useCallback(async () => {
    if (locked) return;
    setSaveState('saving');

    try {
      const id = await ensureSubmission();

      await supabase
        .from('submissions')
        .update({
          theory_comments: theoryComments,
          practical_comments: practicalComments,
          assessor_signature: signature,
          assessed_on: assessedOn,
        })
        .eq('id', id);

      const rows = Object.entries(scores).map(([area_id, score]) => ({
        submission_id: id,
        area_id,
        score,
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('submission_scores')
          .upsert(rows, { onConflict: 'submission_id,area_id' });
        if (error) throw error;
      }

      lastSaveErrorRef.current = null;
      setSaveState('saved');
    } catch (e) {
      // Offline or transient failure — the localStorage draft is still intact.
      lastSaveErrorRef.current = errorMessage(e, 'could not reach the server');
      setSaveState('offline');
    }
  }, [
    locked,
    ensureSubmission,
    supabase,
    theoryComments,
    practicalComments,
    signature,
    assessedOn,
    scores,
  ]);

  useEffect(() => {
    if (locked || Object.keys(scores).length === 0) return;
    const t = setTimeout(syncDraft, 1200);
    return () => clearTimeout(t);
  }, [scores, theoryComments, practicalComments, signature, assessedOn, locked, syncDraft]);

  // ── submit ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(null);

    if (!allAnswered) {
      setError('Every one of the 30 assessment areas must be scored before submitting.');
      return;
    }
    if (!signature.trim()) {
      setError('An assessor signature is required.');
      return;
    }

    try {
      setProgress('Saving assessment…');
      await syncDraft();

      const id = submissionIdRef.current;
      if (!id) {
        throw new Error(
          lastSaveErrorRef.current
            ? `Assessment could not be saved: ${lastSaveErrorRef.current}`
            : 'Assessment could not be saved — no connection to the server.',
        );
      }

      // Saving is best-effort and swallows transient errors, so confirm the
      // server actually holds all 30 scores before locking the record.
      const { count } = await supabase
        .from('submission_scores')
        .select('id', { count: 'exact', head: true })
        .eq('submission_id', id);

      if ((count ?? 0) !== 30) {
        throw new Error(
          `Only ${count ?? 0} of 30 scores reached the server${
            lastSaveErrorRef.current ? ` (${lastSaveErrorRef.current})` : ''
          }. Nothing was submitted — check your connection and try again.`,
        );
      }

      const { error: rpcError } = await supabase.rpc('submit_assessment', {
        p_submission_id: id,
      });
      if (rpcError) throw rpcError;

      setProgress('Generating report…');
      const res = await fetch(`/api/submissions/${id}/process`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));

      localStorage.removeItem(draftKey);
      setProgress(null);

      if (!res.ok) {
        // The assessment itself is committed; only delivery failed. Say so
        // precisely rather than implying the work was lost.
        setError(
          `Assessment saved and locked, but the report could not be delivered: ${
            body.error ?? res.statusText
          }. An administrator can retry it from the dashboard.`,
        );
        setDone({ submissionId: id, delivered: false });
        router.refresh();
        return;
      }

      setDone({ submissionId: id, delivered: body.emailStatus === 'sent' });
      router.refresh();
    } catch (e) {
      setProgress(null);
      setError(errorMessage(e, 'Submission failed.'));
    }
  }

  // ── render ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <SubmittedNotice
        student={student}
        submissionId={done.submissionId}
        delivered={done.delivered}
        deliveryError={error}
        totals={totals}
      />
    );
  }

  if (locked) {
    return (
      <LockedNotice
        student={student}
        submission={submission!}
        onBack={() => router.push('/')}
      />
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    // pb clears the sticky footer, which is two rows tall below sm.
    <div className="space-y-5 pb-36 sm:pb-28">
      <TraineeHeader student={student} assessorName={assessor.fullName} />

      <ol className="flex items-center gap-2 text-sm" aria-label="Assessment progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 font-medium capitalize ${
                i === stepIndex
                  ? 'bg-mvttc-700 text-white'
                  : i < stepIndex
                    ? 'bg-mvttc-100 text-mvttc-800'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="text-border">→</span>}
          </li>
        ))}
      </ol>

      {step !== 'review' ? (
        <SectionStep
          section={step}
          areas={bySection[step]}
          scores={scores}
          onScore={(areaId, value) => setScores((p) => ({ ...p, [areaId]: value }))}
          comments={step === 'theory' ? theoryComments : practicalComments}
          onComments={step === 'theory' ? setTheoryComments : setPracticalComments}
          total={totals[step].total}
          answered={totals[step].answered}
        />
      ) : (
        <ReviewStep
          totals={totals}
          signature={signature}
          onSignature={setSignature}
          assessedOn={assessedOn}
          onAssessedOn={setAssessedOn}
          student={student}
        />
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Sticky footer: running score stays visible while ticking on a phone.
          The score and the buttons stack below sm — side by side they exceed a
          narrow viewport, and the overflow pushed Next off-screen to the right. */}
      <div className="fixed inset-x-0 bottom-0 z-10 overflow-x-hidden border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium tabular-nums">
              T {totals.theory.total}/{SECTION_MAX} ({percentage(totals.theory.total)}%) · P{' '}
              {totals.practical.total}/{SECTION_MAX} ({percentage(totals.practical.total)}%)
            </p>
            <p className="truncate text-xs text-muted">
              {totals.theory.answered + totals.practical.answered} of 30 areas scored
              {saveState === 'saving' && ' · saving…'}
              {saveState === 'saved' && ' · saved'}
              {saveState === 'offline' && ' · saved on this device only'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStep(STEPS[stepIndex - 1])}
                className="tap-target flex-1 rounded-lg border border-border px-4 text-sm font-medium sm:flex-none"
              >
                Back
              </button>
            )}

            {step !== 'review' ? (
              <button
                type="button"
                onClick={() => setStep(STEPS[stepIndex + 1])}
                className="tap-target flex-1 rounded-lg bg-mvttc-700 px-5 text-sm font-medium text-white hover:bg-mvttc-800 sm:flex-none"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={Boolean(progress)}
                className="tap-target flex-1 rounded-lg bg-mvttc-700 px-5 text-sm font-medium text-white hover:bg-mvttc-800 disabled:opacity-60 sm:flex-none"
              >
                {progress ?? 'Submit assessment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────

function TraineeHeader({
  student,
  assessorName,
}: {
  student: StudentInfo;
  assessorName: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h1 className="font-serif text-xl font-semibold">{student.fullName}</h1>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <Field label="Registration" value={student.registrationNumber} />
        <Field label="Occupation" value={student.occupation ?? '—'} />
        <Field label="Course" value={student.course ?? '—'} />
        <Field label="Centre" value={student.centreName} />
        <Field label="Intake" value={student.intakeName} />
        <Field label="Assessor" value={assessorName} />
      </dl>
      {!student.email && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No email address on file — the report will be generated for manual handover
          instead of being sent.
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function SectionStep({
  section,
  areas,
  scores,
  onScore,
  comments,
  onComments,
  total,
  answered,
}: {
  section: Section;
  areas: Area[];
  scores: Record<string, number>;
  onScore: (areaId: string, value: number) => void;
  comments: string;
  onComments: (v: string) => void;
  total: number;
  answered: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-semibold capitalize">{section} session</h2>
        <p className="text-sm tabular-nums text-muted">
          {answered}/15 scored · {total}/{SECTION_MAX}
        </p>
      </div>

      <ul className="space-y-2">
        {areas.map((area) => (
          <li key={area.id} className="rounded-xl border border-border bg-surface p-3">
            <fieldset>
              <legend className="mb-2.5 text-sm leading-snug font-medium">
                <span className="mr-1.5 text-muted">{area.area_number}.</span>
                {area.title}
              </legend>

              <div className="flex gap-1.5">
                {PERFORMANCE_SCALE.map((opt) => {
                  const active = scores[area.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onScore(area.id, opt.value)}
                      aria-pressed={active}
                      title={opt.label}
                      className={`tap-target flex-1 rounded-lg border text-sm font-semibold transition-colors ${
                        active
                          ? 'border-mvttc-700 bg-mvttc-700 text-white'
                          : 'border-border hover:border-mvttc-400 hover:bg-mvttc-50'
                      }`}
                    >
                      <span className="block">{opt.value}</span>
                      <span
                        className={`block text-[10px] font-normal ${
                          active ? 'text-mvttc-100' : 'text-muted'
                        }`}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5">
        <label htmlFor={`${section}-comments`} className="block text-sm font-medium">
          Comments — {section} session
        </label>
        <textarea
          id={`${section}-comments`}
          rows={3}
          value={comments}
          onChange={(e) => onComments(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-mvttc-500 focus:ring-2 focus:ring-mvttc-500/25"
        />
      </div>
    </section>
  );
}

function ReviewStep({
  totals,
  signature,
  onSignature,
  assessedOn,
  onAssessedOn,
  student,
}: {
  totals: { theory: { total: number }; practical: { total: number } };
  signature: string;
  onSignature: (v: string) => void;
  assessedOn: string;
  onAssessedOn: (v: string) => void;
  student: StudentInfo;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-lg font-semibold">Review and submit</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted capitalize">{s} session</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totals[s].total}
              <span className="text-base font-normal text-muted">/{SECTION_MAX}</span>
            </p>
            <p className="text-sm text-muted tabular-nums">
              {percentage(totals[s].total)}%
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="signature" className="block text-sm font-medium">
            Assessor signature
          </label>
          <input
            id="signature"
            value={signature}
            onChange={(e) => onSignature(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-mvttc-500 focus:ring-2 focus:ring-mvttc-500/25"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="assessed-on" className="block text-sm font-medium">
            Date of assessment
          </label>
          <input
            id="assessed-on"
            type="date"
            value={assessedOn}
            onChange={(e) => onAssessedOn(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-mvttc-500 focus:ring-2 focus:ring-mvttc-500/25"
          />
        </div>
      </div>

      <p className="rounded-lg bg-mvttc-50 px-4 py-3 text-sm text-mvttc-900">
        On submission this assessment is locked, the official report is generated, and
        {student.email ? ` it is emailed to ${student.email}` : ' it is made available for manual handover'}
        . Only an administrator can reopen it afterwards.
      </p>
    </section>
  );
}

function SubmittedNotice({
  student,
  submissionId,
  delivered,
  deliveryError,
  totals,
}: {
  student: StudentInfo;
  submissionId: string;
  delivered: boolean;
  deliveryError: string | null;
  totals: { theory: { total: number }; practical: { total: number } };
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            delivered ? 'bg-mvttc-100 text-mvttc-800' : 'bg-amber-100 text-amber-800'
          }`}
          aria-hidden="true"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5 9 17.5 20 6.5" />
          </svg>
        </div>

        <h1 className="mt-4 font-serif text-xl font-semibold">Assessment submitted</h1>
        <p className="mt-1 text-sm text-muted">
          {student.fullName} · {student.registrationNumber}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <div key={s} className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted capitalize">{s}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {totals[s].total}
                <span className="text-base font-normal text-muted">/{SECTION_MAX}</span>
              </p>
              <p className="text-sm text-muted tabular-nums">
                {percentage(totals[s].total)}%
              </p>
            </div>
          ))}
        </div>

        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            delivered
              ? 'bg-mvttc-50 text-mvttc-900'
              : 'bg-amber-50 text-amber-900'
          }`}
        >
          {delivered
            ? `The report has been emailed to ${student.email}.`
            : deliveryError ??
              'The report was generated but has not been emailed yet. An administrator can retry delivery.'}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="tap-target flex items-center rounded-lg bg-mvttc-700 px-5 text-sm font-medium text-white hover:bg-mvttc-800"
          >
            Back to trainees
          </Link>
          <a
            href={`/api/submissions/${submissionId}/pdf`}
            className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
          >
            Download report
          </a>
          <Link
            href="/submissions"
            className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
          >
            My assessments
          </Link>
        </div>
      </div>
    </div>
  );
}

function LockedNotice({
  student,
  submission,
  onBack,
}: {
  student: StudentInfo;
  submission: Submission;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <TraineeHeader student={student} assessorName="" />

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-serif text-lg font-semibold">Assessment submitted</h2>
        <p className="mt-1 text-sm text-muted">
          Submitted assessments are locked. Contact an administrator if a correction is
          required.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Summary
            label="Theory"
            total={submission.theory_total}
            pct={submission.theory_percentage}
          />
          <Summary
            label="Practical"
            total={submission.practical_total}
            pct={submission.practical_percentage}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <a
            href={`/api/submissions/${submission.id}/pdf`}
            className="tap-target flex items-center rounded-lg bg-mvttc-700 px-4 text-sm font-medium text-white hover:bg-mvttc-800"
          >
            Download report
          </a>
          <button
            type="button"
            onClick={onBack}
            className="tap-target rounded-lg border border-border px-4 text-sm font-medium"
          >
            Back to trainees
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({
  label,
  total,
  pct,
}: {
  label: string;
  total: number | null;
  pct: number | null;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {total ?? '—'}
        <span className="text-base font-normal text-muted">/{SECTION_MAX}</span>
      </p>
      <p className="text-sm text-muted tabular-nums">{pct ?? '—'}%</p>
    </div>
  );
}
