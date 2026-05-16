-- Add 'zone' column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS zone TEXT;

-- Update the comments for better documentation in Supabase
COMMENT ON COLUMN drivers.zone IS 'The geographical area or zone assigned to the driver';
