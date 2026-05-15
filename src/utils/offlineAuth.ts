/**
 * Offline Authentication Strategy
 * 
 * Handles authentication when Firebase is unavailable.
 * Uses encrypted storage to cache credentials securely.
 */

import { secureDriverOperations, secureAdminOperations } from './secureStorage';

interface CachedDriver {
  id: string;
  name: string;
  pin_code: string;
  is_active: boolean;
  cached_at: string;
}

interface CachedAdminPin {
  pin: string;
  cached_at: string;
}

/**
 * Cache driver credentials for offline use (encrypted)
 */
export const cacheDriverCredentials = async (driverId: string, driverData: any): Promise<void> => {
  try {
    await secureDriverOperations.cacheDriverCredentials(driverId, driverData);
  } catch (error) {
    console.error('Error caching driver credentials:', error);
  }
};

/**
 * Get cached driver credentials (encrypted)
 */
export const getCachedDriverCredentials = async (driverId: string): Promise<CachedDriver | null> => {
  try {
    return await secureDriverOperations.getCachedDriverCredentials(driverId);
  } catch (error) {
    console.error('Error getting cached driver credentials:', error);
    return null;
  }
};

/**
 * Verify driver credentials offline
 */
export const verifyDriverOffline = async (driverId: string, pin: string): Promise<boolean> => {
  try {
    const cached = await getCachedDriverCredentials(driverId);
    
    if (!cached) {
      return false;
    }

    if (!cached.is_active) {
      return false;
    }

    return cached.pin_code === pin;
  } catch (error) {
    console.error('Error verifying driver offline:', error);
    return false;
  }
};

/**
 * Cache admin PIN for offline use (encrypted)
 */
export const cacheAdminPin = async (pin: string): Promise<void> => {
  try {
    await secureAdminOperations.cacheAdminPin(pin);
  } catch (error) {
    console.error('Error caching admin PIN:', error);
  }
};

/**
 * Get cached admin PIN (encrypted)
 */
export const getCachedAdminPin = async (): Promise<string | null> => {
  try {
    return await secureAdminOperations.getCachedAdminPin();
  } catch (error) {
    console.error('Error getting cached admin PIN:', error);
    return null;
  }
};

/**
 * Verify admin PIN offline
 */
export const verifyAdminPinOffline = async (enteredPin: string): Promise<boolean> => {
  try {
    const cachedPin = await getCachedAdminPin();
    
    if (!cachedPin) {
      return false;
    }

    return cachedPin === enteredPin;
  } catch (error) {
    console.error('Error verifying admin PIN offline:', error);
    return false;
  }
};

/**
 * Clear all cached credentials (secure)
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    await secureDriverOperations.clearAllDriverCredentials();
    await secureAdminOperations.clearAdminPin();
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Check if device is online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    // Try to reach Firebase
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
};
