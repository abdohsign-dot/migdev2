-- Fix existing drivers with null custom_id
-- This script generates custom_id for drivers that have null values

-- Function to generate custom_id
CREATE OR REPLACE FUNCTION generate_custom_driver_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'DRV-';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all drivers with null custom_id
UPDATE drivers
SET custom_id = generate_custom_driver_id()
WHERE custom_id IS NULL;

-- Verify the update
SELECT id, custom_id, name, phone
FROM drivers
ORDER BY created_at DESC;
