import { NextResponse } from 'next/server';
import { createClient, getProfile } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Final marks as CSV, for the college's own reporting. */
export async function GET() {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: marks } = await supabase
    .from('final_marks')
    .select('*')
    .order('centre_name')
    .order('full_name');

  const headers = [
    'Centre',
    'Trainee name',
    'Registration number',
    'Course',
    'Occupation',
    'Assessors',
    'Theory total (avg)',
    'Theory %',
    'Practical total (avg)',
    'Practical %',
  ];

  const rows = (marks ?? []).map((m) => [
    m.centre_name,
    m.full_name,
    m.registration_number,
    m.course,
    m.occupation,
    m.assessor_count,
    m.theory_total_avg,
    m.theory_percentage,
    m.practical_total_avg,
    m.practical_percentage,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="MVTTC-final-marks-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote when the value contains a delimiter, quote or newline.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
