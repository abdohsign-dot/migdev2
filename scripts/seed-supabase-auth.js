/**
 * One-time server-side setup (uses service role — never ship this key in the app).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase-auth.js
 *
 * Creates:
 * - Shared admin auth user + profiles.admin = true
 * - Optional: links existing drivers to auth users (see DRIVER_SEEDS below)
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Add to .env (gitignored, never EXPO_PUBLIC):\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=<from Dashboard → Project Settings → API → service_role>\n' +
      '  EXPO_PUBLIC_SUPABASE_URL is used automatically if set.'
  );
  process.exit(1);
}

if (!adminPassword) {
  console.error('Set EXPO_PUBLIC_SUPABASE_ADMIN_PASSWORD (or SUPABASE_ADMIN_PASSWORD) in .env');
  process.exit(1);
}

const adminEmail =
  process.env.SUPABASE_ADMIN_EMAIL ||
  process.env.EXPO_PUBLIC_SUPABASE_ADMIN_EMAIL ||
  'admin@delivryx.app';
const adminPassword =
  process.env.SUPABASE_ADMIN_PASSWORD ||
  process.env.EXPO_PUBLIC_SUPABASE_ADMIN_PASSWORD;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalizeAuthId = (customId) =>
  customId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const driverAuthEmail = (customId) => `drv-${normalizeAuthId(customId)}@delivryx.app`;
const driverAuthPassword = (customId, pin) => `Dx-${normalizeAuthId(customId)}-${pin}-v1`;

async function ensureAdmin() {
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === adminEmail);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log('Created admin auth user:', adminEmail);
  } else {
    console.log('Admin auth user already exists:', adminEmail);
  }

  await supabase.from('profiles').upsert({
    id: user.id,
    email: adminEmail,
    admin: true,
    driver: false,
    updated_at: new Date().toISOString(),
  });

  console.log('Admin profile linked:', user.id);
}

async function linkDrivers() {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('id, custom_id, pin_code, is_active')
    .neq('custom_id', 'SYSTEM_ADMIN_PIN');

  if (error) throw error;

  for (const driver of drivers || []) {
    if (!driver.custom_id || !driver.pin_code) continue;

    const email = driverAuthEmail(driver.custom_id);
    const password = driverAuthPassword(driver.custom_id, driver.pin_code);

    const { data: list } = await supabase.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email === email);

    if (!user) {
      const { data, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        console.warn(`Skip ${driver.custom_id}:`, createErr.message);
        continue;
      }
      user = data.user;
      console.log('Created driver auth:', email);
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      email,
      admin: false,
      driver: true,
      driver_id: driver.id,
      updated_at: new Date().toISOString(),
    });
  }
}

(async () => {
  try {
    await ensureAdmin();
    await linkDrivers();
    console.log('Done.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
