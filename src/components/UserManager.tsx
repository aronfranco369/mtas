'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Centre = { id: string; name: string };

type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'assessor' | 'admin';
  isActive: boolean;
  centreId: string | null;
  submitted: number;
  drafts: number;
};

const inputClass =
  'tap-target w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-mvttc-500 focus:ring-2 focus:ring-mvttc-500/25';

export function UserManager({
  users,
  centres,
  currentUserId,
}: {
  users: ManagedUser[];
  centres: Centre[];
  currentUserId: string;
}) {
  const router = useRouter();
  const centreName = (id: string | null) =>
    centres.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <CreateUserForm centres={centres} onCreated={() => router.refresh()} />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border bg-mvttc-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Centre</th>
              <th className="px-4 py-3 text-right font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                centres={centres}
                centreName={centreName(u.centreId)}
                isSelf={u.id === currentUserId}
                onChanged={() => router.refresh()}
              />
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">No accounts yet.</p>
        )}
      </div>
    </div>
  );
}

function CreateUserForm({
  centres,
  onCreated,
}: {
  centres: Centre[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'assessor' | 'admin'>('assessor');
  const [centreId, setCentreId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        email,
        password,
        role,
        centreId: role === 'assessor' ? centreId || null : null,
      }),
    });

    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not create the account.');
      return;
    }

    setOk(`${fullName} can now sign in with ${email}.`);
    setFullName('');
    setEmail('');
    setPassword('');
    setCentreId('');
    onCreated();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target rounded-lg bg-mvttc-700 px-5 text-sm font-medium text-white hover:bg-mvttc-800"
      >
        Add an account
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold">New account</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted underline"
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="new-name" className="block text-sm font-medium">
            Full name
          </label>
          <input
            id="new-name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Anicia Osward"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-email" className="block text-sm font-medium">
            Email address
          </label>
          <input
            id="new-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="new-password"
            type="text"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputClass}
          />
          <p className="text-xs text-muted">
            Shown in plain text so you can pass it on. It is hashed on save and
            cannot be retrieved afterwards — only reset.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-role" className="block text-sm font-medium">
            Role
          </label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'assessor' | 'admin')}
            className={inputClass}
          >
            <option value="assessor">Assessor — one centre</option>
            <option value="admin">Administrator — all centres</option>
          </select>
        </div>

        {role === 'assessor' && (
          <div className="space-y-1.5">
            <label htmlFor="new-centre" className="block text-sm font-medium">
              Centre
            </label>
            <select
              id="new-centre"
              required
              value={centreId}
              onChange={(e) => setCentreId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a centre…</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-lg bg-mvttc-50 px-3 py-2 text-sm text-mvttc-900">{ok}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="tap-target rounded-lg bg-mvttc-700 px-5 text-sm font-medium text-white hover:bg-mvttc-800 disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

function UserRow({
  user,
  centres,
  centreName,
  isSelf,
  onChanged,
}: {
  user: ManagedUser;
  centres: Centre[];
  centreName: string;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, successNote?: string) {
    setBusy(true);
    setError(null);
    setNote(null);

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(payload.error ?? 'Update failed.');
      return;
    }

    if (successNote) setNote(successNote);
    onChanged();
  }

  async function resetPassword() {
    const next = window.prompt(`New password for ${user.fullName} (min 8 characters):`);
    if (!next) return;
    if (next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    await patch({ password: next }, 'Password updated.');
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 font-medium">{user.fullName}</td>
      <td className="px-4 py-3">{user.email}</td>
      <td className="px-4 py-3 capitalize">{user.role}</td>
      <td className="px-4 py-3">
        {user.role === 'admin' ? (
          <span className="text-muted">All centres</span>
        ) : (
          <select
            disabled={busy}
            value={user.centreId ?? ''}
            onChange={(e) => patch({ centreId: e.target.value || null })}
            aria-label={`Centre for ${user.fullName}`}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {user.role === 'assessor' && !user.centreId && (
          <p className="mt-1 text-xs text-amber-700">
            No centre — will see no trainees
          </p>
        )}
        <span className="sr-only">{centreName}</span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {user.submitted}
        {user.drafts > 0 && (
          <span className="text-muted"> (+{user.drafts} draft)</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            user.isActive ? 'bg-mvttc-100 text-mvttc-800' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {user.isActive ? 'Active' : 'Deactivated'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={resetPassword}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-mvttc-400 disabled:opacity-60"
          >
            Reset password
          </button>

          {!isSelf && (
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ isActive: !user.isActive })}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-mvttc-400 disabled:opacity-60"
            >
              {user.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
        </div>

        {error && <p className="mt-1 max-w-48 text-xs text-red-700">{error}</p>}
        {note && <p className="mt-1 text-xs text-mvttc-700">{note}</p>}
      </td>
    </tr>
  );
}
