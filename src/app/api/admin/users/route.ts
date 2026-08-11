import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Creates an assessor (or another administrator).
 *
 * The password is handed straight to Supabase Auth, which salts and hashes it.
 * It is never stored in an application table and never read back — this
 * endpoint is what lets an administrator manage staff without touching the
 * database, and without a plaintext credential existing anywhere.
 */
const CreateUser = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['assessor', 'admin']).default('assessor'),
  centreId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const db = createServiceClient();

  const [{ data: profiles }, { data: links }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, role, is_active, created_at').order('full_name'),
    db.from('assessor_centres').select('assessor_id, centre_id, centres ( id, name )'),
  ]);

  const centreByAssessor = new Map(
    (links ?? []).map((l) => [
      l.assessor_id,
      l.centres as unknown as { id: string; name: string } | null,
    ]),
  );

  return NextResponse.json({
    users: (profiles ?? []).map((p) => ({
      ...p,
      centre: centreByAssessor.get(p.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const parsed = CreateUser.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    );
  }

  const { fullName, email, password, role, centreId } = parsed.data;

  if (role === 'assessor' && !centreId) {
    return NextResponse.json(
      { error: 'An assessor must be assigned to a centre' },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    // No public sign-up exists, so an administrator creating the account is
    // itself the verification step.
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    const duplicate = /already|exists|registered/i.test(error.message);
    return NextResponse.json(
      {
        error: duplicate
          ? `An account already exists for ${email}`
          : error.message,
      },
      { status: duplicate ? 409 : 400 },
    );
  }

  const userId = created.user.id;

  // The handle_new_user trigger creates the profile from user_metadata; set the
  // fields explicitly so the row is correct even if metadata is ever missing.
  const { error: profileError } = await db
    .from('profiles')
    .update({ full_name: fullName, role, is_active: true })
    .eq('id', userId);

  if (profileError) {
    // Do not leave an auth user without a usable profile.
    await db.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (centreId) {
    const { error: linkError } = await db
      .from('assessor_centres')
      .insert({ assessor_id: userId, centre_id: centreId });

    if (linkError) {
      await db.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: userId, email, fullName, role }, { status: 201 });
}
