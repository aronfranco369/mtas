import { NextResponse, type NextRequest } from 'next/server';
import JSZip from 'jszip';
import { createClient, getProfile } from '@/lib/supabase/server';
import { getPdf } from '@/lib/r2';
import { reportFilename } from '@/lib/scoring';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Bundles every generated report into one ZIP, foldered by centre.
 *
 * Optional ?centre=<uuid> narrows it to a single centre — the usual case, and
 * the one that keeps the response comfortably inside the function timeout.
 * Reports that have not been generated yet are listed in a manifest inside the
 * archive rather than silently omitted.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const centreId = request.nextUrl.searchParams.get('centre');
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('submissions')
    .select(
      `id, pdf_object_key, assessed_on,
       students!inner ( full_name, centre_id, centres!inner ( name ) ),
       profiles!submissions_assessor_id_fkey!inner ( full_name )`,
    )
    .neq('status', 'draft')
    .order('assessed_on', { ascending: false });

  const selected = (rows ?? []).filter((r) => {
    if (!centreId) return true;
    return (r.students as unknown as { centre_id: string }).centre_id === centreId;
  });

  if (selected.length === 0) {
    return NextResponse.json({ error: 'No assessments to export' }, { status: 404 });
  }

  const zip = new JSZip();
  const missing: string[] = [];

  for (const row of selected) {
    const student = row.students as unknown as {
      full_name: string;
      centres: { name: string };
    };
    const assessorName =
      (row.profiles as unknown as { full_name: string } | null)?.full_name ?? '';

    const name = reportFilename(
      student.full_name,
      assessorName,
      row.assessed_on ?? new Date(),
    );

    if (!row.pdf_object_key) {
      missing.push(`${student.centres.name} — ${student.full_name}`);
      continue;
    }

    try {
      const pdf = await getPdf(row.pdf_object_key);
      zip.folder(student.centres.name)!.file(name, pdf);
    } catch {
      missing.push(`${student.centres.name} — ${student.full_name} (retrieval failed)`);
    }
  }

  if (missing.length > 0) {
    zip.file(
      'MISSING-REPORTS.txt',
      [
        'The following assessments have no stored report and were not included.',
        'Use the Retry action on the admin dashboard to generate them.',
        '',
        ...missing,
      ].join('\n'),
    );
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="MVTTC-assessment-reports-${stamp}.zip"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
