/**
 * Simple Local Admin PIN Management
 * 
 * Uses hardcoded PIN for development without Firebase dependencies
 */

// Hardcoded admin PIN for development
let ADMIN_PIN = '90230155';

/**
 * Verify admin PIN (simple local implementation)
 */
export const verifyAdminPin = async (enteredPin: string): Promise<boolean> => {
  try {
    console.log('🔐 Verifying admin PIN...');
    console.log('📝 Entered PIN length:', enteredPin?.length);
    console.log('📝 Expected PIN:', ADMIN_PIN);
    
    // Validate input
    if (!enteredPin || enteredPin.length !== 8 || !/^\d+$/.test(enteredPin)) {
      console.log('❌ PIN validation failed: invalid format');
      return false;
    }

    // First check against in-memory PIN
    const isMatch = enteredPin === ADMIN_PIN;
    console.log('🔍 In-memory PIN match:', isMatch);
    
    // If not matching in memory, check secure storage
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
        // Continue with in-memory check only
      }
    } else {
      console.log('✅ Admin PIN verified successfully');
    }
    
    return isMatch;
  } catch (error) {
    console.error('❌ Error verifying admin PIN:', error);
    return false;
  }
};

/**
 * Change admin PIN (simple local implementation)
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

    // Update the PIN in memory
    ADMIN_PIN = newPin;
    
    // Update secure storage
    try {
      const { secureAdminOperations } = require('./secureStorage');
      await secureAdminOperations.cacheAdminPin(newPin);
      console.log('✅ Admin PIN cached in secure storage');
    } catch (storageError) {
      console.log('⚠️ Could not update secure storage:', storageError);
      // Continue anyway - at least the in-memory PIN is updated
    }
    
    // Firestore disabled (RNFirebase module not required / RLS-only Supabase approach)
    // PIN is persisted via secureStorage only.
    
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
 * Clear admin PIN cache (no-op in development)
 */
export const clearAdminPinCache = async (): Promise<void> => {
  // No cache to clear in development
};