/**
 * Data Migration Script: Firestore to Supabase
 * This script migrates existing data from Firestore to Supabase
 * 
 * Usage: node scripts/migrate-data.js
 */

const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
require('dotenv').config();

// Configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration. Please set environment variables.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Firebase Admin (if you have service account key)
let firebaseApp;
try {
  const serviceAccount = require('../firebase-service-account.json');
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.log('⚠️ Firebase Admin not initialized - you may need to export data manually');
}

// Migration functions
async function migrateDrivers() {
  console.log('🔄 Starting drivers migration...');
  
  try {
    let driversData = [];
    
    if (firebaseApp) {
      // Get drivers from Firestore
      const driversSnapshot = await admin.firestore().collection('drivers').get();
      driversData = driversSnapshot.docs.map(doc => {
        const data = doc.data();
        // If the Firestore doc has an 'id' field that looks like DRV-XXXXXX, use it as custom_id
        // Otherwise, generate one
        const customId = (data.id && data.id.startsWith('DRV-')) ? data.id : generateCustomId();
        return {
          id: doc.id,
          custom_id: customId,
          ...data,
          // Convert Firestore timestamps to ISO strings
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          _last_modified: new Date().toISOString(),
          _version: '1.0'
        };
      });
    } else {
      // If no Firebase, you can load from exported JSON file
      console.log('📁 Loading drivers from JSON file...');
      const fs = require('fs');
      const path = require('path');
      const driversPath = path.join(__dirname, '../exports/drivers.json');
      
      if (fs.existsSync(driversPath)) {
        driversData = JSON.parse(fs.readFileSync(driversPath, 'utf8'));
        // Add custom_id to drivers that don't have it
        driversData = driversData.map(driver => ({
          ...driver,
          custom_id: driver.custom_id || (driver.id && driver.id.startsWith('DRV-') ? driver.id : generateCustomId())
        }));
      } else {
        console.log('⚠️ No drivers data found. Skipping drivers migration.');
        return;
      }
    }

    console.log(`📊 Found ${driversData.length} drivers to migrate`);

    // Migrate to Supabase in batches
    const batchSize = 50;
    for (let i = 0; i < driversData.length; i += batchSize) {
      const batch = driversData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('drivers')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error migrating drivers batch ${i}-${i + batchSize}:`, error);
      } else {
        console.log(`✅ Migrated drivers batch ${i}-${i + batchSize}`);
      }
    }

    console.log('✅ Drivers migration completed');
  } catch (error) {
    console.error('❌ Error migrating drivers:', error);
    throw error;
  }
}

// Helper function to generate custom_id
function generateCustomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'DRV-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function migratePackages() {
  console.log('🔄 Starting packages migration...');
  
  try {
    let packagesData = [];
    
    if (firebaseApp) {
      // Get packages from Firestore
      const packagesSnapshot = await admin.firestore().collection('packages').get();
      packagesData = packagesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to ISO strings
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          assigned_at: data.assigned_at?.toDate?.()?.toISOString() || null,
          accepted_at: data.accepted_at?.toDate?.()?.toISOString() || null,
          delivered_at: data.delivered_at?.toDate?.()?.toISOString() || null,
          archived_at: data.archived_at?.toDate?.()?.toISOString() || null,
          _last_modified: new Date().toISOString(),
          _version: '1.0'
        };
      });
    } else {
      // Load from exported JSON file
      console.log('📁 Loading packages from JSON file...');
      const fs = require('fs');
      const path = require('path');
      const packagesPath = path.join(__dirname, '../exports/packages.json');
      
      if (fs.existsSync(packagesPath)) {
        packagesData = JSON.parse(fs.readFileSync(packagesPath, 'utf8'));
      } else {
        console.log('⚠️ No packages data found. Skipping packages migration.');
        return;
      }
    }

    console.log(`📊 Found ${packagesData.length} packages to migrate`);

    // Migrate to Supabase in batches
    const batchSize = 50;
    for (let i = 0; i < packagesData.length; i += batchSize) {
      const batch = packagesData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('packages')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error migrating packages batch ${i}-${i + batchSize}:`, error);
      } else {
        console.log(`✅ Migrated packages batch ${i}-${i + batchSize}`);
      }
    }

    console.log('✅ Packages migration completed');
  } catch (error) {
    console.error('❌ Error migrating packages:', error);
    throw error;
  }
}

async function migrateUserClaims() {
  console.log('🔄 Starting user claims migration...');
  
  try {
    let userClaimsData = [];
    
    if (firebaseApp) {
      // Get user claims from Firestore
      const claimsSnapshot = await admin.firestore().collection('user_claims').get();
      userClaimsData = claimsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
    } else {
      // Load from exported JSON file
      console.log('📁 Loading user claims from JSON file...');
      const fs = require('fs');
      const path = require('path');
      const claimsPath = path.join(__dirname, '../exports/user_claims.json');
      
      if (fs.existsSync(claimsPath)) {
        userClaimsData = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
      } else {
        console.log('⚠️ No user claims data found. Skipping user claims migration.');
        return;
      }
    }

    console.log(`📊 Found ${userClaimsData.length} user claims to migrate`);

    // Migrate to Supabase profiles table
    const profilesData = userClaimsData.map(claim => ({
      id: claim.id,
      email: claim.email || null,
      admin: claim.admin || false,
      driver: claim.driver || false,
      driver_id: claim.driverId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Migrate in batches
    const batchSize = 50;
    for (let i = 0; i < profilesData.length; i += batchSize) {
      const batch = profilesData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error migrating profiles batch ${i}-${i + batchSize}:`, error);
      } else {
        console.log(`✅ Migrated profiles batch ${i}-${i + batchSize}`);
      }
    }

    console.log('✅ User claims migration completed');
  } catch (error) {
    console.error('❌ Error migrating user claims:', error);
    throw error;
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...');
  
  try {
    // Check drivers count
    const { count: driversCount, error: driversError } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true });

    if (driversError) throw driversError;
    console.log(`📊 Drivers in Supabase: ${driversCount}`);

    // Check packages count
    const { count: packagesCount, error: packagesError } = await supabase
      .from('packages')
      .select('*', { count: 'exact', head: true });

    if (packagesError) throw packagesError;
    console.log(`📊 Packages in Supabase: ${packagesCount}`);

    // Check profiles count
    const { count: profilesCount, error: profilesError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (profilesError) throw profilesError;
    console.log(`📊 Profiles in Supabase: ${profilesCount}`);

    console.log('✅ Migration verification completed');
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    throw error;
  }
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting Firestore to Supabase migration...');
  
  try {
    await migrateDrivers();
    await migratePackages();
    await migrateUserClaims();
    await verifyMigration();
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Export data from Firestore (if you don't have Firebase Admin)
async function exportFromFirestore() {
  console.log('📤 Exporting data from Firestore...');
  
  // This would be a manual process or you'd need to set up Firebase Admin
  console.log('⚠️ Manual export required. Please export your Firestore data to JSON files:');
  console.log('  - exports/drivers.json');
  console.log('  - exports/packages.json');
  console.log('  - exports/user_claims.json');
}

// Run the migration
if (require.main === module) {
  if (process.argv.includes('--export')) {
    exportFromFirestore();
  } else {
    runMigration();
  }
}

module.exports = {
  runMigration,
  migrateDrivers,
  migratePackages,
  migrateUserClaims,
  verifyMigration
};
