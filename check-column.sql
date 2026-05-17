-- Check if statusHistory column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'packages' AND column_name = 'statushistory';

-- List all columns in packages table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'packages' 
ORDER BY ordinal_position;
