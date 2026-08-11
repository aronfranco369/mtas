import 'server-only';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { COLLEGE, CONTACT_EMAIL, SECTION_MAX } from '@/lib/constants';

export type ReportEmailInput = {
  /** The trainee — the primary recipient of their own report. */
  to: string;
  /**
   * College coordination, copied openly so the trainee can see the report was
   * filed with the College and knows where to direct a query.
   */
  cc?: string | null;
  /**
   * The assessor, blind-copied. Blind rather than CC so the trainee is not
   * handed their assessor's personal address on every report.
   */
  bcc?: string | null;
  studentName: string;
  assessorName: string;
  centreName: string;
  theoryTotal: number;
  theoryPercentage: number;
  practicalTotal: number;
  practicalPercentage: number;
  pdf: Buffer;
  filename: string;
};

/**
 * Sends the assessment report to the trainee.
 *
 * Two transports are supported, chosen by which credentials are present:
 *
 *  · SMTP (set SMTP_HOST) — used when sending from an ordinary mailbox such as
 *    a Gmail account. API providers require a DNS-verified sending domain, and
 *    a @gmail.com address can never be verified, so SMTP is the only route that
 *    can genuinely send *from* such an address.
 *
 *  · Resend (set RESEND_API_KEY) — preferred once a college-owned domain is
 *    verified: better throughput, bounce tracking, and no per-account send cap.
 *
 * SMTP wins if both are configured, since it is the more specific choice.
 */
export async function sendReportEmail(input: ReportEmailInput) {
  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO || CONTACT_EMAIL;

  if (!from) {
    throw new Error('EMAIL_FROM is not configured — cannot send the report.');
  }

  const subject = `Micro-Teaching Assessment Report — ${input.studentName}`;
  const text = buildPlainText(input);
  const html = buildHtml(input);

  if (process.env.SMTP_HOST) {
    return sendViaSmtp({ from, replyTo, subject, text, html, input });
  }

  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ from, replyTo, subject, text, html, input });
  }

  throw new Error(
    'No email transport configured — set SMTP_HOST (with SMTP_USER/SMTP_PASSWORD) or RESEND_API_KEY.',
  );
}

type SendArgs = {
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  input: ReportEmailInput;
};

async function sendViaSmtp({ from, replyTo, subject, text, html, input }: SendArgs) {
  const port = Number(process.env.SMTP_PORT ?? 465);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const info = await transport.sendMail({
    from,
    to: input.to,
    cc: input.cc ?? undefined,
    bcc: input.bcc ?? undefined,
    replyTo,
    subject,
    text,
    html,
    attachments: [
      { filename: input.filename, content: input.pdf, contentType: 'application/pdf' },
    ],
  });

  return { id: info.messageId };
}

async function sendViaResend({ from, replyTo, subject, text, html, input }: SendArgs) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    cc: input.cc ?? undefined,
    bcc: input.bcc ?? undefined,
    replyTo,
    subject,
    text,
    html,
    attachments: [{ filename: input.filename, content: input.pdf }],
  });

  if (error) {
    throw new Error(error.message ?? 'Email provider rejected the message.');
  }

  return data;
}

function buildPlainText(i: ReportEmailInput): string {
  return [
    `Dear ${i.studentName},`,
    '',
    `Your micro-teaching assessment at ${i.centreName} has been completed by ${i.assessorName}.`,
    '',
    `Theory:    ${i.theoryTotal}/${SECTION_MAX}  (${i.theoryPercentage}%)`,
    `Practical: ${i.practicalTotal}/${SECTION_MAX}  (${i.practicalPercentage}%)`,
    '',
    'The full assessment form is attached to this email as a PDF.',
    '',
    'If any detail appears incorrect, contact the College using the details below.',
    '',
    COLLEGE.name,
    COLLEGE.address,
    `${COLLEGE.phone} · ${COLLEGE.email}`,
  ].join('\n');
}

function buildHtml(i: ReportEmailInput): string {
  const row = (label: string, total: number, pct: number) => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #dfe5e3;">${label}</td>
      <td style="padding:8px 12px;border:1px solid #dfe5e3;text-align:right;">${total} / ${SECTION_MAX}</td>
      <td style="padding:8px 12px;border:1px solid #dfe5e3;text-align:right;font-weight:600;">${pct}%</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f7f8f7;font-family:Arial,Helvetica,sans-serif;color:#14201d;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe5e3;border-radius:12px;overflow:hidden;">
    <div style="background:#13524b;color:#ffffff;padding:18px 24px;">
      <div style="font-size:14px;font-weight:700;line-height:1.35;">${COLLEGE.name}</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px;">Micro-Teaching Assessment — ODeL</div>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 14px;">Dear ${escapeHtml(i.studentName)},</p>
      <p style="margin:0 0 18px;line-height:1.5;">
        Your micro-teaching assessment at <strong>${escapeHtml(i.centreName)}</strong>
        has been completed by <strong>${escapeHtml(i.assessorName)}</strong>.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row('Theory session', i.theoryTotal, i.theoryPercentage)}
        ${row('Practical session', i.practicalTotal, i.practicalPercentage)}
      </table>

      <p style="margin:18px 0 0;line-height:1.5;">
        The full assessment form is attached to this email as a PDF.
      </p>
      <p style="margin:14px 0 0;line-height:1.5;color:#5c6b67;font-size:13px;">
        If any detail appears incorrect, please contact the College using the details below.
      </p>
    </div>

    <div style="border-top:1px solid #dfe5e3;padding:16px 24px;font-size:12px;color:#5c6b67;">
      ${COLLEGE.address}<br>${COLLEGE.phone} · ${COLLEGE.email}
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
