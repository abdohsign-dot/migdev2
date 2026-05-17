/**
 * Secure Encrypted Storage Utility
 * 
 * Provides encrypted storage for sensitive data like credentials,
 * authentication tokens, and personal information.
 * 
 * Uses expo-secure-store for native, hardware-backed AES-256 encryption.
 */

import * as SecureStore from 'expo-secure-store';

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

const KEYS_INDEX_KEY = '_delivry_secure_keys_index';

/**
 * Sanitizes keys to contain only characters permitted by expo-secure-store.
 * Allowed characters: alphanumeric, '.', '-', and '_'
 */
const sanitizeKey = (key: string): string => {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Get the list of all keys tracked in SecureStore
 */
const getTrackedKeys = async (): Promise<string[]> => {
  try {
    const data = await SecureStore.getItemAsync(KEYS_INDEX_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

/**
 * Add a key to the tracking index
 */
const trackKey = async (key: string): Promise<void> => {
  const safeKey = sanitizeKey(key);
  if (safeKey === KEYS_INDEX_KEY) return;
  try {
    const keys = await getTrackedKeys();
    if (!keys.includes(safeKey)) {
      keys.push(safeKey);
      await SecureStore.setItemAsync(KEYS_INDEX_KEY, JSON.stringify(keys));
    }
  } catch (e) {
    console.error('Error tracking key in SecureStore:', e);
  }
};

/**
 * Remove a key from the tracking index
 */
const untrackKey = async (key: string): Promise<void> => {
  const safeKey = sanitizeKey(key);
  try {
    const keys = await getTrackedKeys();
    const filtered = keys.filter(k => k !== safeKey);
    await SecureStore.setItemAsync(KEYS_INDEX_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error untracking key in SecureStore:', e);
  }
};

/**
 * Store sensitive data securely with encryption
 */
export const setSecureItem = async (key: string, value: any): Promise<void> => {
  try {
    const safeKey = sanitizeKey(key);
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await SecureStore.setItemAsync(safeKey, stringValue);
    await trackKey(safeKey);
    console.log(`✅ Secure item stored: ${safeKey}`);
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
    const safeKey = sanitizeKey(key);
    const value = await SecureStore.getItemAsync(safeKey);
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
    const safeKey = sanitizeKey(key);
    await SecureStore.deleteItemAsync(safeKey);
    await untrackKey(safeKey);
    console.log(`🗑️ Secure item removed: ${safeKey}`);
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
    const keys = await getTrackedKeys();
    for (const key of keys) {
      await SecureStore.deleteItemAsync(key);
    }
    await SecureStore.deleteItemAsync(KEYS_INDEX_KEY);
    console.log('🗑️ All secure storage cleared');
  } catch (error) {
    console.error('❌ Error clearing secure storage:', error);
    throw new Error(`Failed to clear secure storage: ${error}`);
  }
};

/**
 * Remove multiple secure items by key pattern
 */
export const removeSecureItemsByPattern = async (pattern: string): Promise<void> => {
  try {
    const safePattern = sanitizeKey(pattern);
    const keys = await getTrackedKeys();
    const matchingKeys = keys.filter(key => key.includes(safePattern));
    
    for (const key of matchingKeys) {
      await SecureStore.deleteItemAsync(key);
      await untrackKey(key);
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
    const testKey = 'delivry_secure_test';
    const safeKey = sanitizeKey(testKey);
    await SecureStore.setItemAsync(safeKey, 'test');
    await SecureStore.deleteItemAsync(safeKey);
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
