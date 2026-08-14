import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Registers a trainee by hand, for the arrivals that reach the college after
 * the roster import.
 *
 * Values are normalised to the conventions the imported roster already uses —
 * names and index numbers upper-case, occupations title-case — so a trainee
 * added here groups and sorts with the rest instead of forming a near-duplicate
 * of an existing occupation.
 */
const NewStudent = z.object({
  fullName: z.string().trim().min(3, 'Full name is required'),
  registrationNumber: z.string().trim().min(3, 'Index number is required'),
  centreId: z.string().uuid('A centre must be chosen'),
  gender: z.enum(['Male', 'Female']),
  email: z.string().trim().email('That email address is not valid').optional().or(z.literal('')),
  course: z.string().trim().optional(),
  occupation: z.string().trim().optional(),
});

const squash = (value: string) => value.trim().replace(/\s+/g, ' ');
const upper = (value: string) => squash(value).toUpperCase();
const titleCase = (value: string) =>
  squash(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());

export async function POST(request: Request) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const parsed = NewStudent.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    );
  }

  const { fullName, registrationNumber, centreId, gender, email, course, occupation } =
    parsed.data;
  const db = createServiceClient();

  const { data: intake } = await db
    .from('intakes')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (!intake) {
    return NextResponse.json(
      { error: 'No active intake — a trainee cannot be registered' },
      { status: 409 },
    );
  }

  const { data: centre } = await db
    .from('centres')
    .select('id, name')
    .eq('id', centreId)
    .maybeSingle();

  if (!centre) {
    return NextResponse.json({ error: 'Centre not found' }, { status: 404 });
  }

  const registration = upper(registrationNumber);

  // Uniqueness is (intake_id, registration_number); check it up front so the
  // administrator gets the name of the clashing trainee, not a constraint error.
  const { data: clash } = await db
    .from('students')
    .select('full_name')
    .eq('intake_id', intake.id)
    .eq('registration_number', registration)
    .maybeSingle();

  if (clash) {
    return NextResponse.json(
      { error: `${registration} is already registered to ${clash.full_name}` },
      { status: 409 },
    );
  }

  const { data, error } = await db
    .from('students')
    .insert({
      intake_id: intake.id,
      centre_id: centreId,
      full_name: upper(fullName),
      registration_number: registration,
      gender,
      email: email ? email.toLowerCase() : null,
      course: course ? upper(course) : null,
      occupation: occupation ? titleCase(occupation) : null,
      is_active: true,
    })
    .select('id, full_name, registration_number')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, student: data, centreName: centre.name });
}
