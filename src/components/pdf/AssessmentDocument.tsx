import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Path } from '@react-pdf/renderer';
import {
  COLLEGE,
  SCALE_NOTE,
  SECTION_BLURB,
  SECTION_LABEL,
  SECTION_MAX,
  SECTIONS,
  type Section,
} from '@/lib/constants';
import { formatAssessmentDate } from '@/lib/scoring';

/**
 * Reproduces the official MVTTC Micro-Teaching Assessment Form (Theory &
 * Practical) as a single combined document, matching the Word original.
 *
 * Only the 14 built-in PDF fonts are used (Helvetica family), so nothing is
 * fetched at render time — this keeps generation fast and reliable in a
 * serverless function with no network access to a font CDN.
 */

export type AreaRow = { areaNumber: number; title: string; score: number };

export type AssessmentData = {
  student: {
    fullName: string;
    registrationNumber: string;
    occupation: string | null;
    course: string | null;
  };
  assessorName: string;
  centreName: string;
  assessedOn: string;
  sections: Record<
    Section,
    { rows: AreaRow[]; total: number; percentage: number; comments: string | null }
  >;
  signature: string;
};

// Column widths sum to 100%.
const COL = {
  sn: '6%',
  area: '48%',
  rating: '6%',
  score: '16%',
} as const;

const RATINGS = [5, 4, 3, 2, 1] as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 44,
    paddingHorizontal: 38,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#111111',
  },

  // ── letterhead ──────────────────────────────────────────────────────────
  header: { textAlign: 'center', marginBottom: 10 },
  collegeName: { fontFamily: 'Helvetica-Bold', fontSize: 12, letterSpacing: 0.2 },
  courseName: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 3 },
  formTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 3 },
  rule: { borderBottomWidth: 1.2, borderBottomColor: '#12665b', marginTop: 7 },

  // ── identity block ──────────────────────────────────────────────────────
  identity: { marginTop: 10, marginBottom: 8 },
  idRow: { flexDirection: 'row', marginBottom: 2.5 },
  idLabel: { fontFamily: 'Helvetica-Bold', width: 118 },
  idValue: { flex: 1 },

  scaleNote: { fontFamily: 'Helvetica-Oblique', fontSize: 7.5, marginBottom: 10 },

  // ── section ─────────────────────────────────────────────────────────────
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 6, marginBottom: 3 },
  sectionBlurb: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 7.5,
    color: '#444444',
    marginBottom: 5,
  },

  // ── table ───────────────────────────────────────────────────────────────
  table: { borderWidth: 0.8, borderColor: '#333333' },
  row: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: '#333333' },
  lastRow: { flexDirection: 'row' },
  headRow: { flexDirection: 'row', backgroundColor: '#e8f1ef' },

  cell: {
    borderRightWidth: 0.8,
    borderRightColor: '#333333',
    paddingVertical: 3.2,
    paddingHorizontal: 3.5,
    justifyContent: 'center',
  },
  cellLast: { paddingVertical: 3.2, paddingHorizontal: 3.5, justifyContent: 'center' },

  headText: { fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center' },
  areaText: { fontSize: 7.6, lineHeight: 1.25 },
  centerText: { textAlign: 'center' },
  tickWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 9 },
  scoreText: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'center' },

  // ── totals & comments ───────────────────────────────────────────────────
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: '#e8f1ef',
  },
  totalText: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  comments: { marginTop: 6, marginBottom: 4 },
  commentsLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 2 },
  commentsBody: {
    fontSize: 8.5,
    minHeight: 22,
    borderWidth: 0.6,
    borderColor: '#999999',
    padding: 4,
  },

  // ── signature ───────────────────────────────────────────────────────────
  signatureBlock: { flexDirection: 'row', marginTop: 18, gap: 30 },
  signatureField: { flex: 1 },
  signatureLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  signatureValue: {
    fontSize: 9,
    marginTop: 10,
    borderTopWidth: 0.8,
    borderTopColor: '#333333',
    paddingTop: 3,
  },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 38,
    right: 38,
    fontSize: 6.8,
    color: '#666666',
    textAlign: 'center',
  },
});

/**
 * The tick is drawn as a vector rather than typed as "✔".
 *
 * The 14 built-in PDF fonts use WinAnsi encoding, which has no check-mark
 * glyph — U+2714 silently renders as a missing/incorrect character. Drawing the
 * path removes the dependency on font encoding entirely, so the mark is
 * identical in every PDF viewer without bundling a font file.
 */
function Tick() {
  return (
    <View style={styles.tickWrap}>
      <Svg width={9} height={9} viewBox="0 0 12 12">
        <Path
          d="M1.5 6.3 L4.4 9.2 L10.5 2.6"
          stroke="#111111"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.idRow}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={styles.idValue}>{value}</Text>
    </View>
  );
}

function SectionTable({ rows }: { rows: AreaRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.headRow}>
        <View style={[styles.cell, { width: COL.sn }]}>
          <Text style={styles.headText}>S/N</Text>
        </View>
        <View style={[styles.cell, { width: COL.area }]}>
          <Text style={styles.headText}>Areas of Assessment</Text>
        </View>
        {RATINGS.map((r) => (
          <View key={r} style={[styles.cell, { width: COL.rating }]}>
            <Text style={styles.headText}>{r}</Text>
          </View>
        ))}
        <View style={[styles.cellLast, { width: COL.score }]}>
          <Text style={styles.headText}>SCORE</Text>
        </View>
      </View>

      {rows.map((row, i) => (
        <View key={row.areaNumber} style={i === rows.length - 1 ? styles.lastRow : styles.row}>
          <View style={[styles.cell, { width: COL.sn }]}>
            <Text style={[styles.areaText, styles.centerText]}>{row.areaNumber}</Text>
          </View>
          <View style={[styles.cell, { width: COL.area }]}>
            <Text style={styles.areaText}>{row.title}</Text>
          </View>

          {RATINGS.map((r) => (
            <View key={r} style={[styles.cell, { width: COL.rating }]}>
              {/* A score of 0 places no tick — the form has no 0 column. */}
              {row.score === r ? <Tick /> : <View style={styles.tickWrap} />}
            </View>
          ))}

          <View style={[styles.cellLast, { width: COL.score }]}>
            <Text style={styles.scoreText}>{row.score}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function AssessmentDocument({ data }: { data: AssessmentData }) {
  const dateText = formatAssessmentDate(data.assessedOn);

  return (
    <Document
      title={`Micro-Teaching Assessment — ${data.student.fullName}`}
      author={COLLEGE.shortName}
      subject={COLLEGE.formTitle}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.collegeName}>{COLLEGE.name}</Text>
          <Text style={styles.courseName}>{COLLEGE.course}</Text>
          <Text style={styles.formTitle}>{COLLEGE.formTitle}</Text>
          <View style={styles.rule} />
        </View>

        <View style={styles.identity}>
          <IdRow label="Instructor Trainee Name:" value={data.student.fullName} />
          <IdRow label="Registration Number:" value={data.student.registrationNumber} />
          <IdRow label="Occupation / Trade:" value={data.student.occupation ?? '—'} />
          <IdRow label="Supervisor:" value={data.assessorName} />
          <IdRow label="Centre of Study:" value={data.centreName} />
          <IdRow label="Date of Assessment:" value={dateText} />
        </View>

        <Text style={styles.scaleNote}>{SCALE_NOTE}</Text>

        {SECTIONS.map((section) => {
          const s = data.sections[section];
          return (
            <View key={section} wrap={false}>
              <Text style={styles.sectionTitle}>{SECTION_LABEL[section]}</Text>
              <Text style={styles.sectionBlurb}>{SECTION_BLURB[section]}</Text>

              <SectionTable rows={s.rows} />

              <View style={styles.totalRow}>
                <Text style={styles.totalText}>
                  {section.toUpperCase()} TOTAL: {s.total} / {SECTION_MAX}
                </Text>
                <Text style={styles.totalText}>PERCENTAGE: {s.percentage}%</Text>
              </View>

              <View style={styles.comments}>
                <Text style={styles.commentsLabel}>
                  Comments — {section === 'theory' ? 'Theory' : 'Practical'} Session:
                </Text>
                <Text style={styles.commentsBody}>{s.comments?.trim() || ' '}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.signatureBlock}>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Assessor Signature:</Text>
            <Text style={styles.signatureValue}>{data.signature}</Text>
          </View>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Date:</Text>
            <Text style={styles.signatureValue}>{dateText}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {COLLEGE.name} · {COLLEGE.address} · {COLLEGE.phone} · {COLLEGE.website}
        </Text>
      </Page>
    </Document>
  );
}
