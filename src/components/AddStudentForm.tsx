'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Registers a trainee who reached the college after the roster import.
 *
 * Course and occupation offer the values already in use as suggestions: the
 * roster groups on those strings, so a free-typed "Fitter mechanic" would sit
 * apart from the existing "Fitter Mechanics" for good.
 */
export function AddStudentForm({
  centres,
  courses,
  occupations,
}: {
  centres: { id: string; name: string }[];
  courses: string[];
  occupations: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    registrationNumber: '',
    centreId: centres[0]?.id ?? '',
    gender: 'Male',
    email: '',
    course: '',
    occupation: '',
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setAdded(null);

    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not register the trainee.');
      return;
    }

    setAdded(`${body.student.full_name} (${body.student.registration_number}) added to ${body.centreName}.`);
    setForm((f) => ({
      ...f,
      fullName: '',
      registrationNumber: '',
      email: '',
      occupation: '',
    }));
    router.refresh();
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
        >
          Add trainee
        </button>
        {added && <p className="mt-2 text-sm text-mvttc-800">{added}</p>}
      </div>
    );
  }

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-mvttc-500 focus:ring-2 focus:ring-mvttc-500/25';
  const label = 'block text-xs font-medium text-muted';

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">Add a trainee</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs font-medium text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className={label} htmlFor="new-name">
            Full name
          </label>
          <input
            id="new-name"
            required
            value={form.fullName}
            onChange={(e) => set('fullName')(e.target.value)}
            className={field}
          />
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="new-reg">
            Index number
          </label>
          <input
            id="new-reg"
            required
            placeholder="MVTTC/CAVT/2025/0000"
            value={form.registrationNumber}
            onChange={(e) => set('registrationNumber')(e.target.value)}
            className={field}
          />
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="new-centre">
            Centre
          </label>
          <select
            id="new-centre"
            required
            value={form.centreId}
            onChange={(e) => set('centreId')(e.target.value)}
            className={field}
          >
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="new-email">
            Email address
          </label>
          <input
            id="new-email"
            type="email"
            placeholder="Optional — no email means no report is sent"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            className={field}
          />
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="new-course">
            Course
          </label>
          <input
            id="new-course"
            list="course-options"
            value={form.course}
            onChange={(e) => set('course')(e.target.value)}
            className={field}
          />
          <datalist id="course-options">
            {courses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="new-occupation">
            Occupation
          </label>
          <input
            id="new-occupation"
            list="occupation-options"
            value={form.occupation}
            onChange={(e) => set('occupation')(e.target.value)}
            className={field}
          />
          <datalist id="occupation-options">
            {occupations.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="new-gender">
            Gender
          </label>
          <select
            id="new-gender"
            value={form.gender}
            onChange={(e) => set('gender')(e.target.value)}
            className={field}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {added && <p className="text-sm text-mvttc-800">{added}</p>}

      <button
        type="submit"
        disabled={busy}
        className="tap-target rounded-lg bg-mvttc-700 px-4 text-sm font-medium text-white hover:bg-mvttc-800 disabled:opacity-60"
      >
        {busy ? 'Adding…' : 'Add trainee'}
      </button>
    </form>
  );
}
