-- Auth helpers: driver login PIN check + driver self-read RLS
-- Run in Supabase SQL Editor after deploying the client auth migration.

-- Drivers can read their own row (needed after sign-in for profile-linked queries)
DROP POLICY IF EXISTS "Drivers can view own row" ON drivers;
CREATE POLICY "Drivers can view own row" ON drivers
  FOR SELECT USING (
    id IN (
      SELECT driver_id
      FROM profiles
      WHERE id = auth.uid() AND driver = true
    )
  );

-- Admins can delete drivers
DROP POLICY IF EXISTS "Admins can delete drivers" ON drivers;
CREATE POLICY "Admins can delete drivers" ON drivers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

-- Admins can delete packages
DROP POLICY IF EXISTS "Admins can delete packages" ON packages;
CREATE POLICY "Admins can delete packages" ON packages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

-- Pre-auth PIN verification (anon + authenticated)
CREATE OR REPLACE FUNCTION public.verify_driver_pin(p_custom_id text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  IF p_custom_id IS NULL OR p_pin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  SELECT id, is_active, pin_code, custom_id INTO d
  FROM drivers
  WHERE custom_id = p_custom_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF d.custom_id = 'SYSTEM_ADMIN_PIN' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT COALESCE(d.is_active, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;

  IF d.pin_code IS DISTINCT FROM p_pin THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_pin');
  END IF;

  RETURN jsonb_build_object('ok', true, 'driver_uuid', d.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_driver_pin(text, text) TO anon, authenticated;

-- Remote admin PIN check (boolean only — no PIN returned)
CREATE OR REPLACE FUNCTION public.verify_admin_pin_remote(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin text;
BEGIN
  IF p_pin IS NULL OR length(p_pin) <> 8 OR p_pin !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(pin_code, pin) INTO stored_pin
  FROM drivers
  WHERE custom_id = 'SYSTEM_ADMIN_PIN'
  LIMIT 1;

  IF stored_pin IS NULL THEN
    RETURN false;
  END IF;

  RETURN stored_pin = p_pin;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_pin_remote(text) TO anon, authenticated;

-- Link a new auth.users row to a drivers row (admin-only, called after signUp)
CREATE OR REPLACE FUNCTION public.link_driver_auth_profile(
  p_auth_user_id uuid,
  p_driver_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO profiles (id, email, admin, driver, driver_id, updated_at)
  SELECT p_auth_user_id, u.email, false, true, p_driver_uuid, NOW()
  FROM auth.users u
  WHERE u.id = p_auth_user_id
  ON CONFLICT (id) DO UPDATE
  SET driver = true,
      driver_id = p_driver_uuid,
      admin = false,
      updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_driver_auth_profile(uuid, uuid) TO authenticated;

-- Bootstrap / fix admin profile (bypasses RLS — run from SQL Editor after creating auth user)
CREATE OR REPLACE FUNCTION public.set_user_admin(p_user_id uuid, p_email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT COALESCE(p_email, u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'auth user not found: %', p_user_id;
  END IF;

  INSERT INTO public.profiles (id, email, admin, driver, updated_at)
  VALUES (p_user_id, v_email, true, false, NOW())
  ON CONFLICT (id) DO UPDATE
  SET admin = true,
      driver = false,
      email = EXCLUDED.email,
      updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_admin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_admin(uuid, text) TO postgres;
