/**
 * Secure Encrypted Storage Utility
 * 
 * Provides encrypted storage for sensitive data like credentials,
 * authentication tokens, and personal information.
 * 
 * Uses react-native-encrypted-storage for AES-256 encryption.
 */

import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * Secure storage keys - sensitive data only
 */
export const SECURE_KEYS = {
  // Authentication credentials
  ADMIN_PIN: '@delivry_secure_admin_pin',
  DRIVER_CREDENTIALS_PREFIX: '@delivry_secure_driver_',
  
  // Personal data
  DRIVER_ASSIGNMENTS: '@delivry_secure_driver_assignments',
  
  // Session tokens
  AUTH_TOKENS: '@delivry_secure_auth_tokens',
  USER_SESSION: '@delivry_secure_user_session',
} as const;

/**
 * Store sensitive data securely with encryption
 */
export const setSecureItem = async (key: string, value: any): Promise<void> => {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await EncryptedStorage.setItem(key, stringValue);
    console.log(`✅ Secure item stored: ${key}`);
  } catch (error) {
    console.error(`❌ Error storing secure item ${key}:`, error);
    throw new Error(`Failed to store secure data: ${error}`);
  }
};

/**
 * Retrieve sensitive data securely with decryption
 */
export const getSecureItem = async <T = any>(key: string): Promise<T | null> => {
  try {
    const value = await EncryptedStorage.getItem(key);
    if (value === null) {
      return null;
    }

    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  } catch (error) {
    console.error(`❌ Error retrieving secure item ${key}:`, error);
    return null;
  }
};

/**
 * Remove sensitive data from secure storage
 */
export const removeSecureItem = async (key: string): Promise<void> => {
  try {
    await EncryptedStorage.removeItem(key);
    console.log(`🗑️ Secure item removed: ${key}`);
  } catch (error) {
    console.error(`❌ Error removing secure item ${key}:`, error);
    throw new Error(`Failed to remove secure data: ${error}`);
  }
};

/**
 * Clear all secure storage data
 */
export const clearSecureStorage = async (): Promise<void> => {
  try {
    await EncryptedStorage.clear();
    console.log('🗑️ All secure storage cleared');
  } catch (error) {
    console.error('❌ Error clearing secure storage:', error);
    throw new Error(`Failed to clear secure storage: ${error}`);
  }
};

/**
 * Remove multiple secure items by key pattern
 * Note: Since EncryptedStorage doesn't have getAllKeys/multiRemove, 
 * we'll use known keys pattern matching
 */
export const removeSecureItemsByPattern = async (pattern: string): Promise<void> => {
  try {
    // Since we can't get all keys, we'll use known patterns
    const knownKeys = Object.values(SECURE_KEYS);
    const matchingKeys = knownKeys.filter(key => key.includes(pattern));
    
    // Also check for driver credentials pattern
    if (pattern.includes('driver')) {
      // For driver credentials, we need to handle differently
      // This is a limitation of the current EncryptedStorage API
      console.log(`⚠️ Cannot automatically remove all driver credentials due to API limitations`);
      console.log(`📝 Manual removal may be required for dynamic keys`);
    }
    
    // Remove matching static keys
    for (const key of matchingKeys) {
      await EncryptedStorage.removeItem(key);
    }
    
    if (matchingKeys.length > 0) {
      console.log(`🗑️ Removed ${matchingKeys.length} secure items matching pattern: ${pattern}`);
    }
  } catch (error) {
    console.error(`❌ Error removing secure items by pattern ${pattern}:`, error);
    throw new Error(`Failed to remove secure items: ${error}`);
  }
};

/**
 * Check if secure storage is available
 */
export const isSecureStorageAvailable = async (): Promise<boolean> => {
  try {
    // Test with a simple operation
    const testKey = '@delivry_secure_test';
    await EncryptedStorage.setItem(testKey, 'test');
    await EncryptedStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.error('❌ Secure storage not available:', error);
    return false;
  }
};

/**
 * Migrate data from regular AsyncStorage to secure storage
 */
export const migrateToSecureStorage = async (
  oldKey: string,
  newKey: string,
  removeOld: boolean = true
): Promise<boolean> => {
  try {
    // Import AsyncStorage dynamically to avoid circular dependencies
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    // Get data from old AsyncStorage
    const oldValue = await AsyncStorage.getItem(oldKey);
    if (oldValue === null) {
      console.log(`ℹ️ No data found to migrate from ${oldKey}`);
      return false;
    }

    // Store in secure storage
    await setSecureItem(newKey, oldValue);

    // Remove old data if requested
    if (removeOld) {
      await AsyncStorage.removeItem(oldKey);
      console.log(`🔄 Migrated and removed: ${oldKey} → ${newKey}`);
    } else {
      console.log(`🔄 Migrated (kept old): ${oldKey} → ${newKey}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error migrating ${oldKey} to secure storage:`, error);
    return false;
  }
};

/**
 * Driver-specific secure operations
 */
export const secureDriverOperations = {
  /**
   * Cache driver credentials securely
   */
  cacheDriverCredentials: async (driverId: string, credentials: any): Promise<void> => {
    const key = `${SECURE_KEYS.DRIVER_CREDENTIALS_PREFIX}${driverId}`;
    await setSecureItem(key, {
      ...credentials,
      cached_at: new Date().toISOString(),
    });
  },

  /**
   * Get cached driver credentials securely
   */
  getCachedDriverCredentials: async (driverId: string): Promise<any | null> => {
    const key = `${SECURE_KEYS.DRIVER_CREDENTIALS_PREFIX}${driverId}`;
    const cached = await getSecureItem(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired (7 days)
    const cachedDate = new Date(cached.cached_at);
    const now = new Date();
    const daysDiff = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      await removeSecureItem(key);
      return null;
    }

    return cached;
  },

  /**
   * Clear all driver credentials
   */
  clearAllDriverCredentials: async (): Promise<void> => {
    await removeSecureItemsByPattern(SECURE_KEYS.DRIVER_CREDENTIALS_PREFIX);
  },
};

/**
 * Admin-specific secure operations
 */
export const secureAdminOperations = {
  /**
   * Cache admin PIN securely
   */
  cacheAdminPin: async (pin: string): Promise<void> => {
    await setSecureItem(SECURE_KEYS.ADMIN_PIN, {
      pin,
      cached_at: new Date().toISOString(),
    });
  },

  /**
   * Get cached admin PIN securely
   */
  getCachedAdminPin: async (): Promise<string | null> => {
    const cached = await getSecureItem(SECURE_KEYS.ADMIN_PIN);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired (7 days)
    const cachedDate = new Date(cached.cached_at);
    const now = new Date();
    const daysDiff = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      await removeSecureItem(SECURE_KEYS.ADMIN_PIN);
      return null;
    }

    return cached.pin;
  },

  /**
   * Clear admin PIN cache
   */
  clearAdminPin: async (): Promise<void> => {
    await removeSecureItem(SECURE_KEYS.ADMIN_PIN);
  },
};
