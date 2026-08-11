/**
 * Verifies the mail transport and sends one real test message with a PDF
 * attached, so delivery is proven before running a live assessment.
 *
 *   npm run check:email -- someone@example.com
 *
 * With no argument it sends to EMAIL_REPLY_TO.
 */
import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

async function main() {
  const to = process.argv[2] || process.env.EMAIL_REPLY_TO;
  const from = process.env.EMAIL_FROM;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);

  if (!host) {
    console.error('SMTP_HOST is not set. This check only covers the SMTP transport.');
    process.exit(1);
  }
  if (!process.env.SMTP_PASSWORD) {
    console.error(
      'SMTP_PASSWORD is empty.\n' +
        'Generate a Google App Password at https://myaccount.google.com/apppasswords\n' +
        '(2-Step Verification must be enabled on the account first), then paste the\n' +
        '16-character value into .env.local.',
    );
    process.exit(1);
  }
  if (!to) {
    console.error('No recipient. Pass one as an argument or set EMAIL_REPLY_TO.');
    process.exit(1);
  }

  console.log(`host: ${host}:${port}`);
  console.log(`from: ${from}`);
  console.log(`to:   ${to}\n`);

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  try {
    await transport.verify();
    console.log('PASS  SMTP credentials accepted');
  } catch (e) {
    console.error(`FAIL  SMTP login rejected: ${e instanceof Error ? e.message : e}`);
    console.error('\nUsual causes: using the account password instead of an App Password,');
    console.error('2-Step Verification not enabled, or a stale/revoked App Password.');
    process.exit(1);
  }

  // A tiny valid PDF, so attachment handling is exercised too.
  const pdf = Buffer.from(
    'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8' +
      'PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdl' +
      'L1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgOTkgOTldPj5lbmRvYmoKdHJhaWxlcjw8L1Jvb3QgMSAw' +
      'IFI+Pg==',
    'base64',
  );

  const info = await transport.sendMail({
    from,
    to,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: 'MVTTC Assessment System — delivery test',
    text:
      'This is a delivery test from the MVTTC micro-teaching assessment system.\n\n' +
      'If you are reading this, SMTP sending and PDF attachments both work.',
    attachments: [
      { filename: 'delivery-test.pdf', content: pdf, contentType: 'application/pdf' },
    ],
  });

  console.log(`PASS  sent (message id: ${info.messageId})`);
  console.log('\nCheck the inbox — and the spam folder, which is where a plain');
  console.log('Gmail sender most often lands on first contact.');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
