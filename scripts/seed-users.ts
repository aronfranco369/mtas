/**
 * Provisions the admin and the six centre assessors.
 *
 *   npx tsx scripts/seed-users.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase dashboard →
 * Project Settings → API). There is no public sign-up route by design, so this
 * is the only way accounts are created.
 *
 * ⚠ FILL IN THE EMAIL ADDRESSES BELOW FIRST. The supplied roster listed
 * assessor names only, so the addresses cannot be inferred — using a wrong one
 * would send a password-setup link to a stranger.
 *
 * Each account is created with a random password and a password-recovery link
 * is printed; send that link to the person, or have them use "forgot password".
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Minimal .env.local loader — avoids a dependency for a one-off script.
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

const ACCOUNTS: { fullName: string; email: string; role: 'admin' | 'assessor'; centreSlug?: string }[] = [
  // ── College administration ────────────────────────────────────────────
  { fullName: 'MVTTC ICT Administrator', email: 'REPLACE-ME-admin@mvttc.ac.tz', role: 'admin' },

  // ── Centre assessors (one per centre, from the ODeL August 2026 roster) ─
  { fullName: 'Anicia Osward',      email: 'REPLACE-ME@example.com', role: 'assessor', centreSlug: 'veta-dar-es-salaam' },
  { fullName: 'Rodgers Amini',      email: 'REPLACE-ME@example.com', role: 'assessor', centreSlug: 'veta-dodoma' },
  { fullName: 'Enelisa Mbwile',     email: 'REPLACE-ME@example.com', role: 'assessor', centreSlug: 'veta-iringa' },
  { fullName: 'Laurent Mwaisanila', email: 'REPLACE-ME@example.com', role: 'assessor', centreSlug: 'veta-moshi' },
  { fullName: 'Benson Chibwi',      email: 'REPLACE-ME@example.com', role: 'assessor', centreSlug: 'veta-mwanza' },
  { fullName: 'Mkama Maugo',        email: 'REPLACE-ME@example.com', role: 'assessor', centreSlug: 'veta-tabora' },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }

  const unset = ACCOUNTS.filter((a) => a.email.includes('REPLACE-ME'));
  if (unset.length > 0) {
    console.error(`Refusing to run: ${unset.length} account(s) still have placeholder emails.`);
    console.error('Edit scripts/seed-users.ts and set every real address first.\n');
    unset.forEach((a) => console.error(`  · ${a.fullName}`));
    process.exit(1);
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: centres } = await db.from('centres').select('id, slug');
  const centreBySlug = new Map((centres ?? []).map((c) => [c.slug, c.id]));

  for (const account of ACCOUNTS) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: account.email,
      password: randomBytes(18).toString('base64url'),
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: account.role },
    });

    if (error) {
      console.error(`✗ ${account.fullName} <${account.email}>: ${error.message}`);
      continue;
    }

    const userId = created.user.id;

    // The handle_new_user trigger created the profile; make the role explicit
    // so a re-run repairs it rather than leaving a stale value.
    await db
      .from('profiles')
      .update({ full_name: account.fullName, role: account.role })
      .eq('id', userId);

    if (account.centreSlug) {
      const centreId = centreBySlug.get(account.centreSlug);
      if (!centreId) {
        console.error(`✗ ${account.fullName}: unknown centre "${account.centreSlug}"`);
        continue;
      }
      await db
        .from('assessor_centres')
        .upsert({ assessor_id: userId, centre_id: centreId });
    }

    const { data: link } = await db.auth.admin.generateLink({
      type: 'recovery',
      email: account.email,
    });

    console.log(`✓ ${account.fullName} <${account.email}> (${account.role})`);
    if (link?.properties?.action_link) {
      console.log(`   set password: ${link.properties.action_link}\n`);
    }
  }
}

main();
