/**
 * Migration script to sync local data to Supabase
 * Run with: node run-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function runMigration() {
  try {
    console.log('🔄 Starting migration...');

    // Check existing data
    const { data: existingPackages } = await supabase.from('packages').select('id, ref_number');
    const { data: existingDrivers } = await supabase.from('drivers').select('id, name');
    
    console.log(`📦 Existing packages: ${existingPackages?.length || 0}`);
    console.log(`🚚 Existing drivers: ${existingDrivers?.length || 0}`);

    if (existingPackages && existingPackages.length > 0) {
      console.log('⚠️ Packages already exist in Supabase. Clearing them first...');
      await supabase.from('packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('✅ Packages cleared');
    }

    if (existingDrivers && existingDrivers.length > 0) {
      console.log('⚠️ Drivers already exist in Supabase. Clearing them first...');
      await supabase.from('drivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('✅ Drivers cleared');
    }

    // Read local data from AsyncStorage (simulated - you'll need to add your actual local data)
    console.log('⚠️ This script needs to read your local AsyncStorage data');
    console.log('ℹ️ For now, please use the app to trigger migration:');
    console.log('   - Import { fullResetForRemigration, performFullSync } from ./src/utils/supabaseSync');
    console.log('   - Call: await fullResetForRemigration()');
    console.log('   - Call: await performFullSync()');
    
    console.log('\n✅ Migration script ready. Use the app to trigger actual migration.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
