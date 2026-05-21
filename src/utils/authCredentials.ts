/**
 * Supabase Auth credential helpers.
 * Driver passwords are derived from custom_id + PIN so login can use signInWithPassword
 * after PIN verification (via RPC) without exposing the service role key.
 */

const DRIVER_EMAIL_DOMAIN = 'delivryx.app';
const ADMIN_EMAIL_DOMAIN = 'delivryx.app';

/** Normalize custom_id for use in auth email local-part. */
export const normalizeAuthId = (customId: string): string =>
  customId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export const getDriverAuthEmail = (customId: string): string =>
  `drv-${normalizeAuthId(customId)}@${DRIVER_EMAIL_DOMAIN}`;

/**
 * Deterministic password synced when the admin creates the driver auth user.
 * Must stay stable across app versions for existing drivers.
 */
export const getDriverAuthPassword = (customId: string, pin: string): string =>
  `Dx-${normalizeAuthId(customId)}-${pin}-v1`;

export const getAdminAuthEmail = (): string =>
  process.env.EXPO_PUBLIC_SUPABASE_ADMIN_EMAIL?.trim() ||
  `admin@${ADMIN_EMAIL_DOMAIN}`;

export const getAdminAuthPassword = (): string | null => {
  const value = process.env.EXPO_PUBLIC_SUPABASE_ADMIN_PASSWORD?.trim();
  return value || null;
};

export const isSupabaseAdminAuthConfigured = (): boolean =>
  Boolean(getAdminAuthEmail() && getAdminAuthPassword());
