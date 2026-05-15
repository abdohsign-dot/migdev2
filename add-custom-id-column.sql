-- Add custom_id column to drivers table
-- Run this in Supabase SQL Editor

ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS custom_id TEXT UNIQUE;

-- Create index for faster lookups by custom_id
CREATE INDEX IF NOT EXISTS idx_drivers_custom_id ON drivers(custom_id);
