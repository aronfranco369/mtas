# MVTTC ODeL Micro-Teaching Assessment

Web application replacing the Google Forms + Apps Script assessment workflow for
the Morogoro Vocational Teachers Training College ODeL programme.

See [`../PRD.md`](../PRD.md) for the full product specification.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React, TypeScript) |
| Database / Auth | Supabase — project `xriyvketoqomhsknmihc` (eu-west-2) |
| Object storage | Cloudflare R2 (S3-compatible) |
| PDF | `@react-pdf/renderer` |
| Email | Resend |
| Styling | Tailwind CSS v4 |

## Current state

**Done and verified**

- Database schema, RLS policies, server-side scoring function, Final Marks and
  per-area analytics views — applied to the live Supabase project
- Roster seeded: 1 intake, 6 centres, 30 assessment areas, **128 trainees**
- Authentication, role-based routing, centre isolation enforced at the database
- Assessment form: 30 areas, live running score, local draft persistence,
  debounced server sync, review step, lock on submit
- PDF generation matching the official Word form — verified against the supplied
  sample (`npm run verify:pdf`)
- R2 upload, Resend delivery, per-submission status tracking and retry
- Admin dashboard, Final Marks, CSV export, bulk PDF ZIP
- Type check and production build pass

**Blocked on external input**

1. **`SUPABASE_SERVICE_ROLE_KEY`** — needed for account provisioning and the
   background job. Supabase dashboard → Project Settings → API.
2. **Assessor email addresses** — the roster supplied names only. Fill them into
   `scripts/seed-users.ts`; the script refuses to run with placeholders.
3. **`RESEND_API_KEY`** and SPF/DKIM on `mvttc.ac.tz` — without domain DNS,
   report emails send from Resend's test domain and will land in spam.
4. **R2 bucket `mvttc-assessments`** must exist. Credentials in `.env.local` came
   from a plaintext file and **should be rotated** before deployment.
5. **MVTTC logo/crest** — `src/components/Crest.tsx` is a placeholder, and the
   brand palette in `src/app/globals.css` is provisional.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev
```

Provision accounts once the service-role key and assessor emails are in place:

```bash
npx tsx scripts/seed-users.ts
```

## Verifying the PDF

```bash
npm run verify:pdf
```

Renders the exact submission from the supplied Word sample (ABAS J. MGOVANO —
Theory 46/75 61%, Practical 41/75 55%) to `sample-output.pdf` and asserts the
scoring arithmetic against the published totals. Compare the output side-by-side
with `../ABAS J. MGOVANO - Frank Urio - 7-13-2026.docx`.

## Architecture notes

- **Scoring is server-authoritative.** The browser's running total is display
  only; `submit_assessment()` in Postgres recomputes both totals and both
  percentages, validates that all 30 areas are scored, and locks the row.
- **Centre isolation is a database property**, not a UI filter. An assessor's
  query cannot return another centre's rows even with a manipulated client.
- **Submission is decoupled from delivery.** Scores commit first; PDF generation
  and email run afterwards and are independently retryable, so a delivery
  failure never loses assessment data.
- **PDF rendering sits behind one function**, `renderAssessmentPdf()`. If the
  layout ever outgrows `@react-pdf/renderer`, swapping to Puppeteer touches only
  that module.
- **The tick mark is drawn as a vector**, not typed as `✔` — the built-in PDF
  fonts use WinAnsi encoding and have no check-mark glyph.

## Layout

```
src/
  app/
    (app)/            authenticated shell — trainees, assessment, admin
    login/            sign-in
    api/              submission processing, PDF streaming, exports
  components/
    pdf/              the official assessment form as a PDF document
  lib/
    scoring.ts        percentage rule, filenames, storage keys
    process-submission.ts   render → store → email pipeline
    r2.ts, email.ts, pdf.ts
    supabase/         browser, server and service-role clients
scripts/
  verify-sample-pdf.tsx   fidelity + arithmetic check
  seed-users.ts           account provisioning
```
