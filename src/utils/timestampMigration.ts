/**
 * Timestamp Migration Utility
 * 
 * Handles migration from old timestamp naming conventions to new standard:
 * - Old: _last_modified (string), _version (string "1.0")
 * - New: updated_at (string ISO 8601), version (number)
 * 
 * This utility ensures backward compatibility during the transition period.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Package, Driver } from '../types';

const MIGRATION_COMPLETED_KEY = '@delivry:timestampMigrationCompleted';

/**
 * Check if timestamp migration has been completed
 */
export const isTimestampMigrationCompleted = async (): Promise<boolean> => {
  try {
    const completed = await AsyncStorage.getItem(MIGRATION_COMPLETED_KEY);
    return completed === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark timestamp migration as completed
 */
export const markTimestampMigrationCompleted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(MIGRATION_COMPLETED_KEY, 'true');
    console.log('✅ Timestamp migration marked as completed');
  } catch (error) {
    console.error('Error marking timestamp migration as completed:', error);
  }
};

/**
 * Reset timestamp migration flag (for testing/retrying)
 */
export const resetTimestampMigrationFlag = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(MIGRATION_COMPLETED_KEY);
    console.log('🔄 Timestamp migration flag reset');
  } catch (error) {
    console.error('Error resetting timestamp migration flag:', error);
  }
};

/**
 * Normalize old timestamp fields to new standard
 */
export const normalizeTimestamps = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  const normalized: any = { ...obj };

  // Handle updated_at field
  if (!normalized.updated_at) {
    if (normalized._lastModified) {
      normalized.updated_at = normalized._lastModified;
    } else if (normalized._last_modified) {
      normalized.updated_at = normalized._last_modified;
    }
  }

  // Handle version field
  if (!normalized.version) {
    if (normalized._version) {
      // Convert string version "1.0" to number 1
      normalized.version = parseInt(normalized._version) || 1;
    }
  }

  // Remove old field names
  delete normalized._lastModified;
  delete normalized._last_modified;
  delete normalized._version;

  return normalized;
};

/**
 * Migrate packages from old timestamp format to new
 */
export const migratePackageTimestamps = async (): Promise<void> => {
  try {
    console.log('🔄 Starting package timestamp migration...');

    // Check if already completed
    const completed = await isTimestampMigrationCompleted();
    if (completed) {
      console.log('⚠️ Timestamp migration already completed, skipping');
      return;
    }

    // Get packages from local storage
    const PACKAGES_KEY = '@delivry:packages';
    const data = await AsyncStorage.getItem(PACKAGES_KEY);
    if (!data) {
      console.log('📭 No packages to migrate');
      await markTimestampMigrationCompleted();
      return;
    }

    const packages: Package[] = JSON.parse(data);
    console.log(`📦 Found ${packages.length} packages to migrate`);

    // Normalize all packages
    const migratedPackages = packages.map(pkg => normalizeTimestamps(pkg));

    // Save back to storage
    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(migratedPackages));
    console.log(`✅ Migrated ${migratedPackages.length} packages`);

    // Mark as completed
    await markTimestampMigrationCompleted();
  } catch (error) {
    console.error('❌ Error during package timestamp migration:', error);
    // Don't throw - allow app to continue
  }
};

/**
 * Migrate drivers from old timestamp format to new
 */
export const migrateDriverTimestamps = async (): Promise<void> => {
  try {
    console.log('🔄 Starting driver timestamp migration...');

    // Check if already completed
    const completed = await isTimestampMigrationCompleted();
    if (completed) {
      console.log('⚠️ Timestamp migration already completed, skipping');
      return;
    }

    // Get drivers from local storage
    const DRIVERS_KEY = '@delivry:drivers';
    const data = await AsyncStorage.getItem(DRIVERS_KEY);
    if (!data) {
      console.log('📭 No drivers to migrate');
      return;
    }

    const drivers: Driver[] = JSON.parse(data);
    console.log(`🚚 Found ${drivers.length} drivers to migrate`);

    // Normalize all drivers
    const migratedDrivers = drivers.map(driver => normalizeTimestamps(driver));

    // Save back to storage
    await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(migratedDrivers));
    console.log(`✅ Migrated ${migratedDrivers.length} drivers`);
  } catch (error) {
    console.error('❌ Error during driver timestamp migration:', error);
    // Don't throw - allow app to continue
  }
};

/**
 * Perform full timestamp migration (packages + drivers)
 */
export const performTimestampMigration = async (): Promise<void> => {
  try {
    console.log('🔄 Starting full timestamp migration...');

    // Check if already completed
    const completed = await isTimestampMigrationCompleted();
    if (completed) {
      console.log('⚠️ Timestamp migration already completed, skipping');
      return;
    }

    // Migrate packages
    await migratePackageTimestamps();

    // Migrate drivers
    await migrateDriverTimestamps();

    // Mark as completed
    await markTimestampMigrationCompleted();

    console.log('✅ Full timestamp migration completed successfully');
  } catch (error) {
    console.error('❌ Error during full timestamp migration:', error);
    // Don't throw - allow app to continue
  }
};

/**
 * Validate timestamp format
 */
export const isValidTimestamp = (timestamp: any): boolean => {
  if (typeof timestamp !== 'string') return false;
  
  // Check if it's a valid ISO 8601 timestamp
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};

/**
 * Validate version format
 */
export const isValidVersion = (version: any): boolean => {
  // Should be a number
  return typeof version === 'number' && version > 0;
};

/**
 * Validate package timestamps
 */
export const validatePackageTimestamps = (pkg: Package): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!isValidTimestamp(pkg.created_at)) {
    errors.push(`Invalid created_at: ${pkg.created_at}`);
  }

  if (!isValidTimestamp(pkg.updated_at)) {
    errors.push(`Invalid updated_at: ${pkg.updated_at}`);
  }

  if (!isValidVersion(pkg.version)) {
    errors.push(`Invalid version: ${pkg.version}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate driver timestamps
 */
export const validateDriverTimestamps = (driver: Driver): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!isValidTimestamp(driver.created_at)) {
    errors.push(`Invalid created_at: ${driver.created_at}`);
  }

  if (!isValidTimestamp(driver.updated_at)) {
    errors.push(`Invalid updated_at: ${driver.updated_at}`);
  }

  if (!isValidVersion(driver.version)) {
    errors.push(`Invalid version: ${driver.version}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get timestamp statistics
 */
export const getTimestampStats = async (): Promise<{
  packages: { total: number; migrated: number; invalid: number };
  drivers: { total: number; migrated: number; invalid: number };
}> => {
  try {
    const PACKAGES_KEY = '@delivry:packages';
    const DRIVERS_KEY = '@delivry:drivers';

    // Get packages
    const packagesData = await AsyncStorage.getItem(PACKAGES_KEY);
    const packages: Package[] = packagesData ? JSON.parse(packagesData) : [];

    let packagesMigrated = 0;
    let packagesInvalid = 0;

    for (const pkg of packages) {
      const validation = validatePackageTimestamps(pkg);
      if (validation.isValid) {
        packagesMigrated++;
      } else {
        packagesInvalid++;
      }
    }

    // Get drivers
    const driversData = await AsyncStorage.getItem(DRIVERS_KEY);
    const drivers: Driver[] = driversData ? JSON.parse(driversData) : [];

    let driversMigrated = 0;
    let driversInvalid = 0;

    for (const driver of drivers) {
      const validation = validateDriverTimestamps(driver);
      if (validation.isValid) {
        driversMigrated++;
      } else {
        driversInvalid++;
      }
    }

    return {
      packages: {
        total: packages.length,
        migrated: packagesMigrated,
        invalid: packagesInvalid
      },
      drivers: {
        total: drivers.length,
        migrated: driversMigrated,
        invalid: driversInvalid
      }
    };
  } catch (error) {
    console.error('Error getting timestamp stats:', error);
    return {
      packages: { total: 0, migrated: 0, invalid: 0 },
      drivers: { total: 0, migrated: 0, invalid: 0 }
    };
  }
};
