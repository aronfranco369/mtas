import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient, getProfile } from '@/lib/supabase/server';
import { UserManager } from '@/components/UserManager';

export const metadata = { title: 'Assessors & accounts' };

export default async function UsersPage() {
  const profile = await getProfile();
  if (profile?.role !== 'admin') redirect('/');

  const supabase = await createClient();
  const db = createServiceClient();

  const [{ data: centres }, { data: profiles }, { data: links }, { data: progress }] =
    await Promise.all([
      supabase.from('centres').select('id, name').eq('is_active', true).order('name'),
      db
        .from('profiles')
        .select('id, full_name, email, role, is_active')
        .order('role')
        .order('full_name'),
      db.from('assessor_centres').select('assessor_id, centre_id'),
      supabase.from('assessor_progress').select('assessor_id, submitted, drafts'),
    ]);

  const centreByAssessor = new Map((links ?? []).map((l) => [l.assessor_id, l.centre_id]));
  const statsByAssessor = new Map((progress ?? []).map((p) => [p.assessor_id, p]));

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    role: p.role,
    isActive: p.is_active,
    centreId: centreByAssessor.get(p.id) ?? null,
    submitted: statsByAssessor.get(p.id)?.submitted ?? 0,
    drafts: statsByAssessor.get(p.id)?.drafts ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Assessors &amp; accounts</h1>
          <p className="mt-1 text-sm text-muted">
            Create and manage sign-in accounts. Passwords are stored only by
            Supabase Auth, salted and hashed — never in a table, and never readable
            back, including by you.
          </p>
        </div>
        <Link
          href="/admin"
          className="tap-target flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-mvttc-400"
        >
          Back to dashboard
        </Link>
      </div>

      <UserManager
        users={users}
        centres={centres ?? []}
        currentUserId={profile.id}
      />
    </div>
  );
}
