-- =============================================================================
-- Delivry App — RPC-based Auth & Sync
-- Run this entire script in your Supabase Dashboard > SQL Editor
-- All functions use SECURITY DEFINER so they bypass RLS entirely.
-- The anon key is safe to ship because no table is accessible without a PIN.
-- =============================================================================

-- NOTE: This file is intended to be re-runnable.
-- Drop any functions whose signature/return type we might change to avoid 42P13.
DROP FUNCTION IF EXISTS driver_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_get_drivers(TEXT);
DROP FUNCTION IF EXISTS admin_create_driver(TEXT, JSONB);

-- Avoid PostgREST ambiguity due to overloaded get_packages_since() / admin_get_drivers_since()
DROP FUNCTION IF EXISTS admin_get_drivers_since(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_get_drivers_since(TEXT, TIMESTAMPTZ);

DROP FUNCTION IF EXISTS get_packages_since(TEXT, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_packages_since(TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT);




-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------

-- Internal: verify admin PIN against the SYSTEM_ADMIN_PIN sentinel row
CREATE OR REPLACE FUNCTION _verify_admin_pin(p_admin_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin TEXT;
BEGIN
  SELECT pin INTO v_pin
  FROM drivers
  WHERE custom_id = 'SYSTEM_ADMIN_PIN'
  LIMIT 1;

  -- If no sentinel row yet, accept the hardcoded default
  IF v_pin IS NULL THEN
    RETURN p_admin_pin = '90230155';
  END IF;

  RETURN p_admin_pin = v_pin;
END;
$$;

-- Internal: verify driver PIN and return driver row or NULL
CREATE OR REPLACE FUNCTION _verify_driver(p_driver_id TEXT, p_pin TEXT)
RETURNS drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver drivers;
BEGIN
  -- Support both UUID and custom_id
  SELECT * INTO v_driver
  FROM drivers
  WHERE (id::TEXT = p_driver_id OR custom_id = p_driver_id)
    AND custom_id <> 'SYSTEM_ADMIN_PIN'
  LIMIT 1;

  -- Schema uses pin_code (NOT NULL). App passes driver PIN as p_pin.
  IF NOT FOUND OR v_driver.pin_code <> p_pin THEN
    RETURN NULL;
  END IF;

  RETURN v_driver;
END;
$$;

-- ---------------------------------------------------------------------------
-- AUTH RPCs
-- ---------------------------------------------------------------------------

-- Admin login: returns TRUE on success, raises exception on failure
CREATE OR REPLACE FUNCTION admin_login(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN' USING ERRCODE = 'P0001';
  END IF;
  RETURN TRUE;
END;
$$;

-- Driver login: returns driver row on success, raises exception on failure
CREATE OR REPLACE FUNCTION driver_login(p_driver_id TEXT, p_pin TEXT)
RETURNS drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver drivers;
BEGIN
  v_driver := _verify_driver(p_driver_id, p_pin);

  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Invalid driver ID or PIN' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_driver;
END;
$$;

-- ---------------------------------------------------------------------------
-- PACKAGE RPCs — ADMIN
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_get_packages(p_admin_pin TEXT)
RETURNS SETOF packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY SELECT * FROM packages ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_package_stats(p_admin_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT json_build_object(
    'total',     COUNT(*),
    'pending',   COUNT(*) FILTER (WHERE status = 'Pending'),
    'assigned',  COUNT(*) FILTER (WHERE status = 'Assigned'),
    'inTransit', COUNT(*) FILTER (WHERE status = 'In Transit'),
    'delivered', COUNT(*) FILTER (WHERE status = 'Delivered'),
    'returned',  COUNT(*) FILTER (WHERE status = 'Returned'),
    'archived',  COUNT(*) FILTER (WHERE status = 'Archived')
  ) INTO v_stats FROM packages;

  RETURN v_stats;
END;
$$;

CREATE OR REPLACE FUNCTION admin_search_packages(p_admin_pin TEXT, p_query TEXT)
RETURNS SETOF packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT * FROM packages
    WHERE ref_number ILIKE '%' || p_query || '%'
       OR customer_name ILIKE '%' || p_query || '%'
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_upsert_package(p_admin_pin TEXT, p_package JSONB)
RETURNS packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result packages;
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO packages (
    id, ref_number, customer_name, customer_phone, customer_address,
    status, assigned_to, notes, zone, _last_modified, _version, created_at
  )
  SELECT
    COALESCE((p_package->>'id')::UUID, gen_random_uuid()),
    p_package->>'ref_number',
    p_package->>'customer_name',
    p_package->>'customer_phone',
    p_package->>'customer_address',
    COALESCE(p_package->>'status', 'Pending'),
    (p_package->>'assigned_to')::UUID,
    p_package->>'notes',
    p_package->>'zone',
    COALESCE(p_package->>'_last_modified', now()::TEXT),
    COALESCE(p_package->>'_version', '1'),
    COALESCE((p_package->>'created_at')::TIMESTAMPTZ, now())
  ON CONFLICT (id) DO UPDATE SET
    ref_number       = EXCLUDED.ref_number,
    customer_name    = EXCLUDED.customer_name,
    customer_phone   = EXCLUDED.customer_phone,
    customer_address = EXCLUDED.customer_address,
    status           = EXCLUDED.status,
    assigned_to      = EXCLUDED.assigned_to,
    notes            = EXCLUDED.notes,
    zone             = EXCLUDED.zone,
    _last_modified   = EXCLUDED._last_modified,
    _version         = EXCLUDED._version
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_package(p_admin_pin TEXT, p_package_id UUID, p_updates JSONB)
RETURNS packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result packages;
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  UPDATE packages SET
    status           = COALESCE(p_updates->>'status',           status::TEXT)::TEXT,
    customer_name    = COALESCE(p_updates->>'customer_name',    customer_name),
    customer_phone   = COALESCE(p_updates->>'customer_phone',   customer_phone),
    customer_address = COALESCE(p_updates->>'customer_address', customer_address),
    assigned_to      = CASE WHEN p_updates ? 'assigned_to' THEN (p_updates->>'assigned_to')::UUID ELSE assigned_to END,
    notes            = COALESCE(p_updates->>'notes',            notes),
    zone             = COALESCE(p_updates->>'zone',             zone),
    _last_modified   = COALESCE((p_updates->>'_last_modified')::timestamptz, now()),

    _version         = COALESCE(p_updates->>'_version',         _version)
  WHERE id = p_package_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_package(p_admin_pin TEXT, p_package_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM packages WHERE id = p_package_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_all_packages(p_admin_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM packages;
END;
$$;

-- ---------------------------------------------------------------------------
-- PACKAGE RPCs — SHARED (admin or driver)
-- ---------------------------------------------------------------------------

-- Get a single package by ID. Auth: admin PIN OR driver PIN+ID.
CREATE OR REPLACE FUNCTION get_package_by_id(
  p_package_id   UUID,
  p_admin_pin    TEXT DEFAULT NULL,
  p_driver_id    TEXT DEFAULT NULL,
  p_pin          TEXT DEFAULT NULL
)
RETURNS packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result packages;
  v_driver drivers;
BEGIN
  -- Must supply either admin PIN or driver credentials
  IF p_admin_pin IS NOT NULL THEN
    IF NOT _verify_admin_pin(p_admin_pin) THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_driver_id IS NOT NULL AND p_pin IS NOT NULL THEN
    v_driver := _verify_driver(p_driver_id, p_pin);
    IF v_driver IS NULL THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'No credentials supplied' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_result FROM packages WHERE id = p_package_id LIMIT 1;
  RETURN v_result;
END;
$$;

-- Incremental pull since a timestamp
CREATE OR REPLACE FUNCTION get_packages_since(
  p_since_iso      TEXT,
  p_target_driver_id UUID DEFAULT NULL,
  p_admin_pin      TEXT DEFAULT NULL,
  p_driver_id      TEXT DEFAULT NULL,
  p_pin            TEXT DEFAULT NULL
)
RETURNS SETOF packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver drivers;
BEGIN
  IF p_admin_pin IS NOT NULL THEN
    IF NOT _verify_admin_pin(p_admin_pin) THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_driver_id IS NOT NULL AND p_pin IS NOT NULL THEN
    v_driver := _verify_driver(p_driver_id, p_pin);
    IF v_driver IS NULL THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'No credentials supplied' USING ERRCODE = 'P0001';
  END IF;

  -- _last_modified is timestamptz; compare via cast to avoid implicit-cast/type overload ambiguity
  IF p_target_driver_id IS NOT NULL THEN
    RETURN QUERY
      SELECT * FROM packages
      WHERE assigned_to = p_target_driver_id
        AND _last_modified > p_since_iso::timestamptz
      ORDER BY _last_modified ASC;
  ELSE
    RETURN QUERY
      SELECT * FROM packages
      WHERE _last_modified > p_since_iso::timestamptz
      ORDER BY _last_modified ASC;
  END IF;
END;
$$;

-- Get all packages assigned to a driver
CREATE OR REPLACE FUNCTION get_packages_by_driver(
  p_target_driver_id UUID,
  p_driver_id        TEXT DEFAULT NULL,
  p_pin              TEXT DEFAULT NULL,
  p_admin_pin        TEXT DEFAULT NULL
)
RETURNS SETOF packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver drivers;
BEGIN
  IF p_admin_pin IS NOT NULL THEN
    IF NOT _verify_admin_pin(p_admin_pin) THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_driver_id IS NOT NULL AND p_pin IS NOT NULL THEN
    v_driver := _verify_driver(p_driver_id, p_pin);
    IF v_driver IS NULL THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'No credentials supplied' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT * FROM packages
    WHERE assigned_to = p_target_driver_id
    ORDER BY created_at DESC;
END;
$$;

-- Upsert a package (by id field in JSONB)
CREATE OR REPLACE FUNCTION upsert_package_by_id(
  p_package    JSONB,
  p_admin_pin  TEXT DEFAULT NULL,
  p_driver_id  TEXT DEFAULT NULL,
  p_pin        TEXT DEFAULT NULL
)
RETURNS packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result packages;
  v_driver drivers;
BEGIN
  IF p_admin_pin IS NOT NULL THEN
    IF NOT _verify_admin_pin(p_admin_pin) THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_driver_id IS NOT NULL AND p_pin IS NOT NULL THEN
    v_driver := _verify_driver(p_driver_id, p_pin);
    IF v_driver IS NULL THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'No credentials supplied' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO packages (
    id, ref_number, customer_name, customer_phone, customer_address,
    status, assigned_to, notes, zone, _last_modified, _version, created_at
  )
  SELECT
    COALESCE((p_package->>'id')::UUID, gen_random_uuid()),
    p_package->>'ref_number',
    p_package->>'customer_name',
    p_package->>'customer_phone',
    p_package->>'customer_address',
    COALESCE(p_package->>'status', 'Pending'),
    (p_package->>'assigned_to')::UUID,
    p_package->>'notes',
    p_package->>'zone',
    COALESCE(p_package->>'_last_modified', now()::TEXT),
    COALESCE(p_package->>'_version', '1'),
    COALESCE((p_package->>'created_at')::TIMESTAMPTZ, now())
  ON CONFLICT (id) DO UPDATE SET
    ref_number       = EXCLUDED.ref_number,
    customer_name    = EXCLUDED.customer_name,
    customer_phone   = EXCLUDED.customer_phone,
    customer_address = EXCLUDED.customer_address,
    status           = EXCLUDED.status,
    assigned_to      = EXCLUDED.assigned_to,
    notes            = EXCLUDED.notes,
    zone             = EXCLUDED.zone,
    _last_modified   = EXCLUDED._last_modified,
    _version         = EXCLUDED._version
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Driver update package (status + notes only — limited scope)
CREATE OR REPLACE FUNCTION driver_update_package(
  p_driver_id  TEXT,
  p_pin        TEXT,
  p_package_id UUID,
  p_updates    JSONB
)
RETURNS packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver drivers;
  v_result packages;
BEGIN
  v_driver := _verify_driver(p_driver_id, p_pin);
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- Drivers may only update packages assigned to them
  UPDATE packages SET
    status         = COALESCE(p_updates->>'status',         status::TEXT)::TEXT,
    notes          = COALESCE(p_updates->>'notes',          notes),
    _last_modified = COALESCE(p_updates->>'_last_modified', now()::TEXT),
    _version       = COALESCE(p_updates->>'_version',       _version)
  WHERE id = p_package_id
    AND assigned_to = v_driver.id
  RETURNING * INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Package not found or not assigned to driver' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- DRIVER RPCs — ADMIN
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_get_drivers(p_admin_pin TEXT)
RETURNS SETOF drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT * FROM drivers
    WHERE custom_id <> 'SYSTEM_ADMIN_PIN'
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_active_drivers(p_admin_pin TEXT)
RETURNS SETOF drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT * FROM drivers
    WHERE custom_id <> 'SYSTEM_ADMIN_PIN'
      AND is_active = TRUE
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_driver(p_admin_pin TEXT, p_driver_id TEXT)
RETURNS drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result drivers;
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_result FROM drivers
  WHERE (id::TEXT = p_driver_id OR custom_id = p_driver_id)
    AND custom_id <> 'SYSTEM_ADMIN_PIN'
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_drivers_since(p_admin_pin TEXT, p_since_iso TEXT)
RETURNS SETOF drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- _last_modified is timestamptz; compare via cast to avoid overload ambiguity
  RETURN QUERY
    SELECT * FROM drivers
    WHERE custom_id <> 'SYSTEM_ADMIN_PIN'
      AND _last_modified > p_since_iso::timestamptz
    ORDER BY _last_modified ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_search_drivers(p_admin_pin TEXT, p_query TEXT)
RETURNS SETOF drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT * FROM drivers
    WHERE custom_id <> 'SYSTEM_ADMIN_PIN'
      AND (name ILIKE '%' || p_query || '%' OR phone ILIKE '%' || p_query || '%')
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_driver(p_admin_pin TEXT, p_driver JSONB)
RETURNS drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result drivers;
  v_custom_id TEXT;
  v_pin TEXT;
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  v_custom_id := COALESCE(p_driver->>'custom_id', p_driver->>'id');
  -- Schema uses pin_code (NOT NULL). Keep app payload key `pin` mapped into pin_code.
  v_pin := COALESCE(NULLIF(p_driver->>'pin',''), p_driver->>'pin_code');

  IF v_pin IS NULL THEN
    RAISE EXCEPTION 'pin_code is required' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO drivers (
    name, phone, pin_code, custom_id, zone, is_active, vehicle_type, _last_modified, _version
  ) VALUES (
    p_driver->>'name',
    p_driver->>'phone',
    v_pin,
    v_custom_id,
    p_driver->>'zone',
    COALESCE((p_driver->>'is_active')::BOOLEAN, TRUE),
    COALESCE(p_driver->>'vehicle_type', 'moto'),
    COALESCE((p_driver->>'_last_modified')::timestamptz, now()),
    COALESCE(p_driver->>'_version', '1')
  )

  ON CONFLICT (custom_id) DO UPDATE SET
    name           = EXCLUDED.name,
    phone          = EXCLUDED.phone,
    pin_code       = EXCLUDED.pin_code,
    zone           = EXCLUDED.zone,
    is_active      = EXCLUDED.is_active,
    _last_modified = EXCLUDED._last_modified,
    _version       = EXCLUDED._version
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_driver(p_admin_pin TEXT, p_driver_id TEXT, p_updates JSONB)
RETURNS drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result drivers;
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  UPDATE drivers SET
    name           = COALESCE(p_updates->>'name',           name),
    phone          = COALESCE(p_updates->>'phone',          phone),
    pin_code      = COALESCE(NULLIF(p_updates->>'pin',''), p_updates->>'pin_code', pin_code),
    zone           = COALESCE(p_updates->>'zone',           zone),
    is_active      = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
    vehicle_type   = COALESCE(p_updates->>'vehicle_type',   vehicle_type),
    _last_modified = COALESCE((p_updates->>'_last_modified')::timestamptz, now()),
    _version       = COALESCE(p_updates->>'_version',       _version)
  WHERE (id::TEXT = p_driver_id OR custom_id = p_driver_id)
    AND custom_id <> 'SYSTEM_ADMIN_PIN'
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_driver(p_admin_pin TEXT, p_driver_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM drivers
  WHERE (id::TEXT = p_driver_id OR custom_id = p_driver_id)
    AND custom_id <> 'SYSTEM_ADMIN_PIN';
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_all_drivers(p_admin_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_admin_pin) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM drivers WHERE custom_id <> 'SYSTEM_ADMIN_PIN';
END;
$$;

-- Admin PIN management RPC
CREATE OR REPLACE FUNCTION admin_update_pin(p_current_pin TEXT, p_new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _verify_admin_pin(p_current_pin) THEN
    RAISE EXCEPTION 'Invalid current admin PIN' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert the sentinel row
  INSERT INTO drivers (name, custom_id, pin_code, is_active, _last_modified, _version)
  VALUES ('System Admin PIN Settings', 'SYSTEM_ADMIN_PIN', p_new_pin, FALSE, now(), '1')

  ON CONFLICT (custom_id) DO UPDATE SET
    pin_code = EXCLUDED.pin_code,
    _last_modified = EXCLUDED._last_modified;

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- REVOKE direct table access from anon role
-- (Run after creating functions — ensures only RPCs work)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE packages FROM anon;
REVOKE ALL ON TABLE drivers  FROM anon;

-- Grant execute on all new RPCs to anon so the client can call them
GRANT EXECUTE ON FUNCTION _verify_admin_pin(TEXT)                         TO anon;
GRANT EXECUTE ON FUNCTION _verify_driver(TEXT, TEXT)                      TO anon;
GRANT EXECUTE ON FUNCTION admin_login(TEXT)                               TO anon;
GRANT EXECUTE ON FUNCTION driver_login(TEXT, TEXT)                        TO anon;
GRANT EXECUTE ON FUNCTION admin_get_packages(TEXT)                        TO anon;
GRANT EXECUTE ON FUNCTION admin_get_package_stats(TEXT)                   TO anon;
GRANT EXECUTE ON FUNCTION admin_search_packages(TEXT, TEXT)               TO anon;
GRANT EXECUTE ON FUNCTION admin_upsert_package(TEXT, JSONB)               TO anon;
GRANT EXECUTE ON FUNCTION admin_update_package(TEXT, UUID, JSONB)         TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_package(TEXT, UUID)                TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_all_packages(TEXT)                 TO anon;
GRANT EXECUTE ON FUNCTION get_package_by_id(UUID, TEXT, TEXT, TEXT)       TO anon;
GRANT EXECUTE ON FUNCTION get_packages_since(TEXT, UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_packages_by_driver(UUID, TEXT, TEXT, TEXT)  TO anon;
GRANT EXECUTE ON FUNCTION upsert_package_by_id(JSONB, TEXT, TEXT, TEXT)   TO anon;
GRANT EXECUTE ON FUNCTION driver_update_package(TEXT, TEXT, UUID, JSONB)  TO anon;
GRANT EXECUTE ON FUNCTION admin_get_drivers(TEXT)                         TO anon;
GRANT EXECUTE ON FUNCTION admin_get_active_drivers(TEXT)                  TO anon;
GRANT EXECUTE ON FUNCTION admin_get_driver(TEXT, TEXT)                    TO anon;
GRANT EXECUTE ON FUNCTION admin_get_drivers_since(TEXT, TEXT)             TO anon;
GRANT EXECUTE ON FUNCTION admin_search_drivers(TEXT, TEXT)                TO anon;
GRANT EXECUTE ON FUNCTION admin_create_driver(TEXT, JSONB)                TO anon;
GRANT EXECUTE ON FUNCTION admin_update_driver(TEXT, TEXT, JSONB)          TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_driver(TEXT, TEXT)                 TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_all_drivers(TEXT)                  TO anon;
GRANT EXECUTE ON FUNCTION admin_update_pin(TEXT, TEXT)                    TO anon;
