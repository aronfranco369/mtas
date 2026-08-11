import 'server-only';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import {
  AssessmentDocument,
  type AssessmentData,
} from '@/components/pdf/AssessmentDocument';

/**
 * The single seam for PDF rendering.
 *
 * If @react-pdf/renderer ever proves unable to match the official layout
 * closely enough, swapping to a Puppeteer/HTML pipeline means replacing the
 * body of this one function — nothing else in the app calls the renderer.
 */
export async function renderAssessmentPdf(data: AssessmentData): Promise<Buffer> {
  // renderToBuffer types its argument as a literal <Document> element, so a
  // component that returns one does not match structurally.
  const element = React.createElement(AssessmentDocument, { data });
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

export type { AssessmentData };
