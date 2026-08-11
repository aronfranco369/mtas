/**
 * Renders the exact submission from the supplied Word sample
 * (ABAS J. MGOVANO — Theory 46/75 61%, Practical 41/75 55%) so the output can
 * be compared side-by-side with the original document.
 *
 *   npx tsx scripts/verify-sample-pdf.tsx
 *
 * Also asserts the scoring arithmetic against the published totals, so a
 * regression in the percentage rule fails loudly rather than silently
 * producing plausible wrong marks.
 */
import { writeFileSync } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import {
  AssessmentDocument,
  type AssessmentData,
} from '../src/components/pdf/AssessmentDocument';
import { percentage } from '../src/lib/scoring';

const THEORY: [string, number][] = [
  ['SETS AND STATES LEARNING OBJECTIVES CLEARLY AND APPROPRIATELY', 3],
  ['PREPARES APPROPRIATE CONTENT/SUBJECT MATTER', 3],
  ['ABILITY TO DESIGN TEACHING AIDS', 4],
  ['ABILITY TO OBSERVE HEALTH AND SAFETY REQUIREMENTS', 4],
  ['ABILITY TO PREPARE LESSON PLAN AND ASSESSMENT TOOLS', 4],
  ['ABILITY TO SET TIME FOR A TASK', 3],
  ['ABILITY TO ORGANISE STUDENTS', 2],
  ['ABILITY TO IDENTIFY AND USE TEACHING METHOD/TECHNIQUE', 3],
  ["ABILITY TO RESPOND TO STUDENTS' LEARNING NEEDS", 3],
  ['ABILITY TO GIVE INSTRUCTIONS (COMMUNICATION)', 3],
  ['MASTERY OF KNOWLEDGE AND SKILLS', 3],
  ["ABILITY TO ASSESS LEARNERS' WORK", 3],
  ['PROVIDE A MODEL OF GOOD OCCUPATIONAL PRACTICES', 3],
  ['RELATIONSHIP TO TRAINEES', 2],
  ['RELATIONSHIP TO COLLEAGUES', 3],
];

const PRACTICAL: [string, number][] = [
  ['SETS AND STATES LEARNING OBJECTIVES CLEARLY AND APPROPRIATELY', 3],
  ['PREPARES APPROPRIATE TASKS', 2],
  ['ABILITY TO DESIGN TEACHING AIDS', 2],
  ['ABILITY TO OBSERVE HEALTH AND SAFETY REQUIREMENTS', 3],
  ['ABILITY TO PREPARE OPERATION AND ASSESSMENT SHEET', 3],
  ['ABILITY TO SET TIME FOR A TASK', 3],
  ['ABILITY TO ORGANISE STUDENTS', 3],
  ['ABILITY TO IDENTIFY AND USE DEMONSTRATION TECHNIQUE', 3],
  ["ABILITY TO RESPOND TO STUDENTS' LEARNING NEEDS", 3],
  ['ABILITY TO GIVE INSTRUCTIONS (COMMUNICATION)', 2],
  ['MASTERY OF KNOWLEDGE AND SKILLS', 1],
  ["ABILITY TO ASSESS LEARNERS' WORK", 2],
  ['PROVIDE A MODEL OF GOOD OCCUPATIONAL PRACTICES', 2],
  ['RELATIONSHIP TO TRAINEES', 4],
  ['RELATIONSHIP TO COLLEAGUES', 5],
];

const rows = (src: [string, number][]) =>
  src.map(([title, score], i) => ({ areaNumber: i + 1, title, score }));

const theoryTotal = THEORY.reduce((t, [, s]) => t + s, 0);
const practicalTotal = PRACTICAL.reduce((t, [, s]) => t + s, 0);

// Values printed on the original document.
const EXPECTED = { theory: [46, 61], practical: [41, 55] } as const;

function assert(label: string, actual: number, expected: number) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual} (expected ${expected})`);
  if (!ok) process.exitCode = 1;
}

assert('Theory total', theoryTotal, EXPECTED.theory[0]);
assert('Theory percentage', percentage(theoryTotal), EXPECTED.theory[1]);
assert('Practical total', practicalTotal, EXPECTED.practical[0]);
assert('Practical percentage', percentage(practicalTotal), EXPECTED.practical[1]);

const data: AssessmentData = {
  student: {
    fullName: 'ABAS J. MGOVANO',
    registrationNumber: 'MVTTC/CAVT/2025/0357',
    occupation: 'Motor Vehicle Mechanics',
    course: 'CAVT',
  },
  assessorName: 'Frank Urio',
  centreName: 'VETA DAR ES SALAAM',
  assessedOn: '2026-07-13',
  sections: {
    theory: {
      rows: rows(THEORY),
      total: theoryTotal,
      percentage: percentage(theoryTotal),
      comments: 'Improve documentation and involve learners to participate.',
    },
    practical: {
      rows: rows(PRACTICAL),
      total: practicalTotal,
      percentage: percentage(practicalTotal),
      comments: 'Improve documentation and emphasise safety issues.',
    },
  },
  signature: 'Frank Urio',
};

async function main() {
  const out = 'sample-output.pdf';
  const element = React.createElement(AssessmentDocument, { data });
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  writeFileSync(out, buffer);

  console.log(`\nWrote ${out} (${(buffer.length / 1024).toFixed(1)} KB)`);
  console.log('Compare against "ABAS J. MGOVANO - Frank Urio - 7-13-2026.docx".');
}

main();
