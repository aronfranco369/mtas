import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/server';
import { Crest } from '@/components/Crest';
import { SignOutButton } from '@/components/SignOutButton';
import { COLLEGE } from '@/lib/constants';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (!profile) redirect('/login');

  if (!profile.is_active) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-serif text-xl font-semibold">Account deactivated</h1>
          <p className="text-sm text-muted">
            This account is no longer active. Please contact the College ICT office at{' '}
            <a href={`mailto:${COLLEGE.email}`} className="text-mvttc-700 underline">
              {COLLEGE.email}
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-mvttc-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Crest className="h-8 w-8 shrink-0" />
            <span className="leading-tight">
              <span className="block text-sm font-semibold">MVTTC Assessments</span>
              <span className="block text-[11px] text-mvttc-200">
                Micro-Teaching · ODeL
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="tap-target flex items-center rounded-lg px-3 hover:bg-white/10"
            >
              Trainees
            </Link>
            <Link
              href="/submissions"
              className="tap-target flex items-center rounded-lg px-3 hover:bg-white/10"
            >
              My&nbsp;assessments
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="tap-target flex items-center rounded-lg px-3 hover:bg-white/10"
              >
                Admin
              </Link>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted">
          <p className="font-medium text-foreground">{COLLEGE.name}</p>
          <p className="mt-1">
            {COLLEGE.address} · {COLLEGE.phone} ·{' '}
            <a href={`mailto:${COLLEGE.email}`} className="underline">
              {COLLEGE.email}
            </a>
          </p>
          <p className="mt-2">
            Signed in as {profile.full_name} ({profile.role})
          </p>
        </div>
      </footer>
    </div>
  );
}
