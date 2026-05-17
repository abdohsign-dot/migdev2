-- Add statusHistory column to packages table
-- This column stores a JSONB array of StatusHistoryEntry objects
-- Each entry contains: status, changedAt, changedBy (OperationContext), and optional reason

ALTER TABLE packages
ADD COLUMN statusHistory JSONB DEFAULT '[]'::jsonb;

-- Create an index for efficient querying
CREATE INDEX idx_packages_statusHistory ON packages USING GIN (statusHistory);

-- Set NOT NULL constraint after adding default values
ALTER TABLE packages
ALTER COLUMN statusHistory SET NOT NULL;
