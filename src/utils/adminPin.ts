import CryptoJS from 'crypto-js';

// Hardcoded default admin PIN
let ADMIN_PIN = '90230155';

// Pre-hashed SHA-256 emergency recovery PIN (for '90230155')
// This allows '90230155' to always act as a failsafe emergency recovery backdoor
const EMERGENCY_PIN_HASH = '534dba8c072d495dade060291cf64c6537d95c200fafc03782dbdb10a819a2c2';

/**
 * Verify admin PIN (local first, falling back to Supabase, then Emergency PIN)
 */
export const verifyAdminPin = async (enteredPin: string): Promise<boolean> => {
  try {
    console.log('🔐 Verifying admin PIN...');
    console.log('📝 Entered PIN length:', enteredPin?.length);
    
    // Validate input
    if (!enteredPin || enteredPin.length !== 8 || !/^\d+$/.test(enteredPin)) {
      console.log('❌ PIN validation failed: invalid format');
      return false;
    }

    // 1. Check against the encrypted master Emergency PIN (Failsafe bypass)
    const enteredHash = CryptoJS.SHA256(enteredPin).toString();
    if (enteredHash === EMERGENCY_PIN_HASH) {
      console.log('✅ Admin verified via Emergency Recovery PIN');
      return true;
    }

    // 2. Check against in-memory changed PIN
    let isMatch = enteredPin === ADMIN_PIN;
    console.log('🔍 In-memory PIN match:', isMatch);
    
    // 3. If not matching in memory, check local secure storage
    if (!isMatch) {
      try {
        console.log('🔍 Checking secure storage...');
        const { secureAdminOperations } = require('./secureStorage');
        const cachedPin = await secureAdminOperations.getCachedAdminPin();
        console.log('📦 Cached PIN found:', !!cachedPin);
        
        if (cachedPin && enteredPin === cachedPin) {
          console.log('✅ Admin PIN verified from secure storage');
          // Update in-memory PIN to match cached one
          ADMIN_PIN = cachedPin;
          return true;
        }
      } catch (storageError) {
        console.log('⚠️ Could not check secure storage:', storageError);
      }
    }

    // 4. If still not matched, verify via admin_login RPC (supports fresh device installs)
    if (!isMatch) {
      try {
        const NetInfo = require('@react-native-community/netinfo').default;
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected && netInfo.isInternetReachable !== false) {
          console.log('🔍 Verifying PIN via admin_login RPC...');
          const { getDb } = require('../supabase/config');
          const db = getDb();
          const { error: rpcError } = await db.rpc('admin_login', { p_pin: enteredPin });

          if (!rpcError) {
            console.log('✅ Admin PIN verified via Supabase RPC');
            // Cache locally in SecureStore for offline use
            const { secureAdminOperations } = require('./secureStorage');
            await secureAdminOperations.cacheAdminPin(enteredPin);
            ADMIN_PIN = enteredPin;
            return true;
          }
        }
      } catch (supabaseError) {
        console.log('⚠️ Could not verify admin PIN via RPC:', supabaseError);
      }
    }
    
    return isMatch;
  } catch (error) {
    console.error('❌ Error verifying admin PIN:', error);
    return false;
  }
};

/**
 * Change admin PIN (local secure storage + Supabase sync)
 */
export const changeAdminPin = async (
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔄 Changing admin PIN...');
    
    // Validate inputs
    if (!currentPin || currentPin.length !== 8 || !/^\d+$/.test(currentPin)) {
      return { 
        success: false, 
        error: 'Le PIN actuel doit contenir 8 chiffres' 
      };
    }

    if (!newPin || newPin.length !== 8 || !/^\d+$/.test(newPin)) {
      return { 
        success: false, 
        error: 'Le nouveau PIN doit contenir 8 chiffres' 
      };
    }

    // Verify current PIN using the same logic as login
    const isCurrentPinValid = await verifyAdminPin(currentPin);
    
    if (!isCurrentPinValid) {
      console.log('❌ Current PIN verification failed');
      return { 
        success: false, 
        error: 'Le PIN actuel est incorrect' 
      };
    }

    console.log('✅ Current PIN verified, updating to new PIN');

    // 1. Update the PIN in memory
    ADMIN_PIN = newPin;
    
    // 2. Update secure storage on device
    try {
      const { secureAdminOperations } = require('./secureStorage');
      await secureAdminOperations.cacheAdminPin(newPin);
      console.log('✅ Admin PIN cached in secure storage');
    } catch (storageError) {
      console.log('⚠️ Could not update secure storage:', storageError);
    }
    
    // 3. Update Supabase remotely via admin_update_pin RPC
    try {
      const NetInfo = require('@react-native-community/netinfo').default;
      const netInfo = await NetInfo.fetch();

      if (netInfo.isConnected && netInfo.isInternetReachable !== false) {
        console.log('☁️ Syncing new admin PIN to Supabase via RPC...');
        const { getDb } = require('../supabase/config');
        const db = getDb();
        const { error } = await db.rpc('admin_update_pin', {
          p_current_pin: currentPin,
          p_new_pin: newPin,
        });
        if (error) throw error;
        console.log('✅ Admin PIN updated successfully via Supabase RPC');
      } else {
        console.log('📶 Device offline — PIN change saved locally only. Will retry when online.');
      }
    } catch (syncError) {
      console.log('⚠️ Could not update admin PIN via RPC (will retry later):', syncError);
    }
    
    console.log('✅ Admin PIN changed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error changing admin PIN:', error);
    return { 
      success: false, 
      error: 'Une erreur est survenue. Veuillez réessayer.' 
    };
  }
};

/**
 * Check if admin PIN is initialized (always true in development)
 */
export const isAdminPinInitialized = async (): Promise<boolean> => {
  return true;
};

/**
 * Initialize admin PIN (no-op in development)
 */
export const initializeAdminPin = async (): Promise<{ success: boolean; error?: string }> => {
  return { success: true };
};

/**
 * Clear admin PIN cache
 */
export const clearAdminPinCache = async (): Promise<void> => {
  try {
    const { secureAdminOperations } = require('./secureStorage');
    await secureAdminOperations.clearAdminPin();
  } catch (e) {
    console.warn('Could not clear admin PIN cache:', e);
  }
};