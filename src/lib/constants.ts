/**
 * Institutional constants. These appear on screen and in the generated PDF,
 * so they live in one place rather than being retyped per template.
 */

/**
 * Where replies and support requests go. Deliberately separate from the
 * college's published switchboard address (mvttc@veta.go.tz) so that
 * assessment correspondence reaches the system administrator directly.
 */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'msofecomputer@gmail.com';

export const COLLEGE = {
  name: 'MOROGORO VOCATIONAL TEACHERS TRAINING COLLEGE',
  shortName: 'MVTTC',
  course: 'VOCATIONAL TEACHERS CERTIFICATE COURSE',
  // Rendered as two stacked lines on the report, above the rule.
  formTitle: 'MICRO–TEACHING ASSESSMENT FORM',
  formSubtitle: '(THEORY & PRACTICAL)',
  address: 'P.O. Box 671, Rwegasore Road, Morogoro, Tanzania',
  phone: '+255 23 261 4466',
  email: CONTACT_EMAIL,
  website: 'www.mvttc.ac.tz',
} as const;

/** 5 = Excellent … 1 = Poor. Printed verbatim on the assessment form. */
export const PERFORMANCE_SCALE = [
  { value: 5, label: 'Excellent' },
  { value: 4, label: 'Very Good' },
  { value: 3, label: 'Good' },
  { value: 2, label: 'Satisfactory' },
  { value: 1, label: 'Poor' },
] as const;

export const SCALE_NOTE =
  'Performance Scale: 5 = Excellent, 4 = Very Good, 3 = Good, 2 = Satisfactory, 1 = Poor.';

/** 15 areas per section, each scored 0–5. */
export const AREAS_PER_SECTION = 15;
export const MAX_SCORE_PER_AREA = 5;
export const SECTION_MAX = AREAS_PER_SECTION * MAX_SCORE_PER_AREA; // 75

export const SECTIONS = ['theory', 'practical'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  theory: 'THEORY ASSESSMENT',
  practical: 'PRACTICAL ASSESSMENT',
};

export const SECTION_BLURB: Record<Section, string> = {
  theory:
    "This section records the supervisor's direct observations of the trainee's classroom-based theoretical instruction, assessed against the 15 CBET performance areas below.",
  practical:
    "This section records the supervisor's direct observations of the trainee's hands-on / workshop-based practical instruction, assessed against the same 15 CBET performance areas, applied to practical delivery.",
};
