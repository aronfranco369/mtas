import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Updates an existing account: rename, reset password, reassign centre, or
 * deactivate. Deactivation is preferred over deletion — submissions reference
 * the assessor, and an assessment must always name who carried it out.
 */
const UpdateUser = z.object({
  fullName: z.string().trim().min(2).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  centreId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['assessor', 'admin']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = UpdateUser.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    );
  }

  const { fullName, password, centreId, isActive, role } = parsed.data;
  const db = createServiceClient();

  // An administrator must not be able to lock themselves out of the panel.
  if (id === profile.id && (isActive === false || role === 'assessor')) {
    return NextResponse.json(
      { error: 'You cannot deactivate or demote your own account' },
      { status: 400 },
    );
  }

  if (password) {
    const { error } = await db.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (fullName || isActive !== undefined || role) {
    const { error } = await db
      .from('profiles')
      .update({
        ...(fullName ? { full_name: fullName } : {}),
        ...(isActive !== undefined ? { is_active: isActive } : {}),
        ...(role ? { role } : {}),
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // A centre reassignment replaces the existing link rather than adding one,
  // so an assessor is never silently left with access to a previous centre.
  if (centreId !== undefined) {
    await db.from('assessor_centres').delete().eq('assessor_id', id);

    if (centreId) {
      const { error } = await db
        .from('assessor_centres')
        .insert({ assessor_id: id, centre_id: centreId });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
