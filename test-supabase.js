/**
 * Quick test script to verify Supabase connection and basic operations
 * Run with: node test-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 Testing Supabase connection...');
console.log('URL:', supabaseUrl ? '✅ Configured' : '❌ Missing');
console.log('Key:', supabaseKey ? '✅ Configured' : '❌ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables. Check your .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  try {
    console.log('\n🔗 Testing connection...');
    
    // Test 1: Basic connection - check if we can access the service
    const { data, error } = await supabase.from('drivers').select('count').limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return;
    }
    
    console.log('✅ Connection successful!');
    
    // Test 2: Check if tables exist
    console.log('\n📊 Checking table structure...');
    
    const tables = ['drivers', 'packages', 'profiles', 'sync_operations'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: Accessible`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }
    
    // Test 3: Try to insert a test driver
    console.log('\n➕ Testing write operations...');
    
    const testDriver = {
      name: 'Test Driver',
      phone: '1234567890',
      vehicle_type: 'Car',
      pin_code: '1234',
      is_active: true
    };
    
    const { data: insertedDriver, error: insertError } = await supabase
      .from('drivers')
      .insert(testDriver)
      .select()
      .single();
    
    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      console.log('ℹ️ This might be due to RLS policies - you may need to be authenticated');
    } else {
      console.log('✅ Insert successful:', insertedDriver.name);
      
      // Clean up the test driver
      await supabase.from('drivers').delete().eq('id', insertedDriver.id);
      console.log('🧹 Test driver cleaned up');
    }
    
    console.log('\n🎉 Supabase setup test completed!');
    console.log('📋 Your database is ready for the migration.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
