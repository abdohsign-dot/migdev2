/**
 * Local Database Utility - Complete Smart Sync
 * Uses encrypted storage for sensitive data, regular AsyncStorage for non-sensitive data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Package, Driver, SyncOperation } from '../types';
import { isPreStoredDriverId } from '../config/credentials';
import { setSecureItem, getSecureItem, removeSecureItem } from './secureStorage';

// Storage Keys
const PACKAGES_KEY = '@delivry:packages';
const DRIVERS_KEY = '@delivry:drivers';
const SYNC_QUEUE_KEY = '@delivry:syncQueue';
const LAST_SYNC_KEY = '@delivry:lastSync';

// Sensitive fields that should be encrypted
const SENSITIVE_FIELDS = [
  'customer_name',
  'customer_phone',
  'customer_phone_2',
  'customer_address',
  'gps_lat',
  'gps_lng',
  'sender_name',
  'sender_phone',
  'sender_company',
  'price'
];

/**
 * Extract sensitive data from package for encryption
 */
const extractSensitiveData = (pkg: Package): Record<string, any> => {
  const sensitive: Record<string, any> = {};
  for (const field of SENSITIVE_FIELDS) {
    if (field in pkg) {
      sensitive[field] = (pkg as any)[field];
    }
  }
  return sensitive;
};

/**
 * Remove sensitive data from package (for storage)
 */
const removeSensitiveData = (pkg: Package): Partial<Package> => {
  const sanitized = { ...pkg };
  for (const field of SENSITIVE_FIELDS) {
    delete (sanitized as any)[field];
  }
  return sanitized;
};

/**
 * Restore sensitive data to package
 */
const restoreSensitiveData = (pkg: Partial<Package>, sensitive: Record<string, any>): Package => {
  return {
    ...pkg,
    ...sensitive
  } as Package;
};

/**
 * In-memory L1 cache for sensitive package data.
 *
 * Motivation: `getPackagesLocally` is called on every render, every screen focus,
 * and every realtime event — it previously fired one EncryptedStorage.getItem
 * (encrypted disk read) per package per call. With 50 packages that's 50 reads
 * on the JS thread every time the list is displayed.
 *
 * Strategy: read-through on first access, write-through on save, evict on delete.
 * The disk (EncryptedStorage) remains the source of truth and is always written to;
 * the cache only short-circuits the reads.
 */
const _sensitiveCache = new Map<string, Record<string, any>>();

/**
 * Store sensitive data securely (write-through: updates cache AND EncryptedStorage)
 */
const storeSensitiveData = async (packageId: string, sensitive: Record<string, any>): Promise<void> => {
  if (Object.keys(sensitive).length === 0) return;
  
  // Update cache immediately so next read is instant
  _sensitiveCache.set(packageId, sensitive);

  try {
    await setSecureItem(`@delivry:pkg_sensitive:${packageId}`, sensitive);
  } catch (error) {
    console.warn(`⚠️ Could not store sensitive data for package ${packageId}:`, error);
    // Don't throw — local cache still has the data for this session
  }
};

/**
 * Retrieve sensitive data securely (read-through: cache hit avoids EncryptedStorage)
 */
const getSensitiveData = async (packageId: string): Promise<Record<string, any>> => {
  // L1 cache hit — no disk read needed
  if (_sensitiveCache.has(packageId)) {
    return _sensitiveCache.get(packageId)!;
  }

  // Cache miss — read from EncryptedStorage and populate cache
  try {
    const sensitive = await getSecureItem(`@delivry:pkg_sensitive:${packageId}`);
    const result = sensitive || {};
    _sensitiveCache.set(packageId, result); // populate for next call
    return result;
  } catch (error) {
    console.warn(`⚠️ Could not retrieve sensitive data for package ${packageId}:`, error);
    return {};
  }
};

/**
 * Remove sensitive data securely (evicts from cache AND EncryptedStorage)
 */
const removeSensitiveDataSecurely = async (packageId: string): Promise<void> => {
  // Evict from cache first
  _sensitiveCache.delete(packageId);

  try {
    await removeSecureItem(`@delivry:pkg_sensitive:${packageId}`);
  } catch (error) {
    console.warn(`⚠️ Could not remove sensitive data for package ${packageId}:`, error);
  }
};

/**
 * Clear the entire sensitive data cache (call on logout or full data reset)
 */
export const clearSensitiveDataCache = (): void => {
  _sensitiveCache.clear();
};



// Basic package retrieval (overridden below with driver filtering)

export const getDriversLocally = async (): Promise<Driver[]> => {
  try {
    const data = await AsyncStorage.getItem(DRIVERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Serializes all storeDriverLocally writes to prevent concurrent read-write races.
// Without this, two callers (e.g. useFocusEffect sync + auto-flush processSyncQueue)
// can both read the old array, both fail to find the other's pending write, and
// both push a new entry — resulting in duplicate drivers.
let _driverWriteQueue: Promise<void> = Promise.resolve();

export const storeDriverLocally = async (driver: Driver): Promise<void> => {
  _driverWriteQueue = _driverWriteQueue.then(async () => {
    try {
      const drivers = await getDriversLocally();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      // Match by id, custom_id cross-match (handles DRV-XXXXXX ↔ UUID bridge)
      const existingIndex = drivers.findIndex(d =>
        d.id === driver.id ||
        (d.custom_id && driver.custom_id && d.custom_id === driver.custom_id) ||
        (d.id && driver.custom_id && d.id === driver.custom_id) ||
        (d.custom_id && driver.id && d.custom_id === driver.id)
      );

      // When the incoming record has a SB UUID, prefer it as the canonical id
      const existingId = existingIndex >= 0 ? drivers[existingIndex].id : null;
      const shouldUpgradeId =
        driver.id &&
        uuidRegex.test(driver.id) &&
        existingId != null &&
        !uuidRegex.test(existingId);

      if (existingIndex >= 0) {
        drivers[existingIndex] = {
          ...drivers[existingIndex],
          ...driver,
          id: shouldUpgradeId ? driver.id : (existingId || driver.id),
          updated_at: new Date().toISOString(),
          version: (driver.version ?? 1) + 1,
        };
      } else {
        drivers.push({
          ...driver,
          created_at: driver.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
        });
      }

      // Safety net: deduplicate entire array by custom_id before writing
      // (collapses any residual duplicates from previous runs)
      const seen = new Set<string>();
      const deduped = drivers.filter(d => {
        const key = d.custom_id || d.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(deduped));
      if (__DEV__) console.log(`💾 Driver ${driver.id} stored locally`);
    } catch (error) {
      console.error('Error storing driver locally:', error);
      throw error;
    }
  });
  return _driverWriteQueue;
};


export const removeDriverLocally = async (driverId: string): Promise<void> => {
  try {
    const drivers = await getDriversLocally();
    const filteredDrivers = drivers.filter(d => d.id !== driverId);
    await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(filteredDrivers));
    console.log(`🗑️ Driver ${driverId} removed from local storage`);
  } catch (error) {
    console.error('Error removing driver locally:', error);
    throw error;
  }
};

export const syncPackagesFromFirestore = async (driverId?: string, isAdmin = false): Promise<void> => {
  try {
    console.log(`🔄 Starting Supabase sync: driverId=${driverId}, isAdmin=${isAdmin}`);
    
    // Run migration before sync (only runs once)
    const { migrateLocalPackagesToSupabase } = require('./supabaseSync');
    await migrateLocalPackagesToSupabase();
    
    // Use Supabase sync instead of Firebase
    const { syncPackagesFromSupabase } = require('./supabaseSync');
    await syncPackagesFromSupabase(driverId);
    console.log('✅ Synced packages from Supabase');
  } catch (error) {
    console.error('Error syncing packages from Supabase:', error);
  }
};

export const syncDriversFromFirestore = async (): Promise<void> => {
  try {
    console.log('🔄 Starting Supabase driver sync');
    
    // Run migration before sync (only runs once)
    const { migrateLocalDriversToSupabase } = require('./supabaseSync');
    await migrateLocalDriversToSupabase();
    
    // Use Supabase sync instead of Firebase
    const { syncDriversFromSupabase } = require('./supabaseSync');
    await syncDriversFromSupabase();
    console.log('✅ Synced drivers from Supabase');
  } catch (error) {
    console.error('Error syncing drivers from Supabase:', error);
  }
};

// updatePackage implementation moved below with enhanced functionality

export const upsertPackageLocally = async (pkg: Package): Promise<void> => {
  const packages = await getPackagesLocally(undefined, true);
  const index = packages.findIndex(p => p.id === pkg.id);
  if (index > -1) {
    packages[index] = {
      ...pkg,
      updated_at: new Date().toISOString(),
      version: (pkg.version ?? 1) + 1
    };
  } else {
    packages.push({
      ...pkg,
      created_at: pkg.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1
    });
  }
  await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
};

export const deletePackageLocally = async (packageId: string): Promise<void> => {
  try {
    const packages = await getPackagesLocally(undefined, true);
    const filteredPackages = packages.filter(p => p.id !== packageId);
    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(filteredPackages));
    console.log(`🗑️ Package ${packageId} deleted from local storage`);
  } catch (error) {
    console.error('Error deleting package locally:', error);
    throw error;
  }
};

export const getLastSyncTime = async (): Promise<string> => {
  try {
    const time = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return time || '';
  } catch {
    return '';
  }
};

/**
 * Enhanced package filtering for drivers
 * Internal logic uses UUIDs:
 * - packages.assigned_to = driver UUID
 * - drivers.id = driver UUID
 *
 * UI may pass driverId as custom_id (DRV-xxxx). In that case we resolve to UUID using locally stored drivers.
 * 
 * Supports pagination to avoid loading all packages into memory.
 * Sensitive data is stored encrypted and restored on retrieval.
 */
export const getPackagesLocally = async (
  driverId?: string,
  includeArchived: boolean = false,
  limit: number = 50,
  offset: number = 0
): Promise<Package[]> => {
  try {
    const data = await AsyncStorage.getItem(PACKAGES_KEY);
    let allPackages: Package[] = data ? JSON.parse(data) : [];

    console.log(`📦 getPackagesLocally: driverId=${driverId}, includeArchived=${includeArchived}, limit=${limit}, offset=${offset}, totalPackages=${allPackages.length}`);

    // Restore sensitive data for all packages
    allPackages = await Promise.all(
      allPackages.map(async (pkg) => {
        const sensitive = await getSensitiveData(pkg.id);
        return restoreSensitiveData(pkg, sensitive);
      })
    );

    // If driverId provided, filter packages assigned to this driver
    if (driverId) {
      // Resolve custom_id (DRV-xxxx) -> UUID (drivers.id) if needed
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(driverId);

      let assignedToUuid = driverId;

      if (!isUuid) {
        const localDrivers = await getDriversLocally();
        const matched = localDrivers.find(d => d.custom_id === driverId || d.id === driverId);
        if (!matched?.id) {
          console.log(`🚚 Driver ${driverId} not found locally; returning 0 packages`);
          return [];
        }
        assignedToUuid = matched.id;
      }

      const filtered = allPackages.filter(
        pkg =>
          pkg.assigned_to === assignedToUuid &&
          (includeArchived || !pkg.is_archived || pkg.status === 'Archived')
      );

      console.log(
        `🚚 Driver ${driverId} (assigned_to UUID: ${assignedToUuid}) packages: ${filtered.length} (filtered from ${allPackages.length})`
      );

      // Apply pagination
      const paginatedPackages = filtered.slice(offset, offset + limit);
      console.log(`📄 Returning ${paginatedPackages.length} packages (${offset}-${offset + limit})`);

      return paginatedPackages;
    }

    // Filter out packages with invalid UUIDs first
    const validPackages = await filterValidUUIDPackages(allPackages);

    // Admin/normal retrieval: hide archived by default unless requested
    const filtered = validPackages.filter(pkg => includeArchived || !pkg.is_archived);
    console.log(`👑 Admin packages: ${filtered.length} (filtered from ${validPackages.length})`);

    // Apply pagination
    const paginatedPackages = filtered.slice(offset, offset + limit);
    console.log(`📄 Returning ${paginatedPackages.length} packages (${offset}-${offset + limit})`);

    return paginatedPackages;
  } catch (error) {
    console.error('Error in getPackagesLocally:', error);
    return [];
  }
};

// Helper function to validate UUID format
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Get total count of packages (for pagination)
 */
export const getPackageCountLocally = async (
  driverId?: string,
  includeArchived: boolean = false
): Promise<number> => {
  try {
    const data = await AsyncStorage.getItem(PACKAGES_KEY);
    const allPackages: Package[] = data ? JSON.parse(data) : [];

    // If driverId provided, count packages assigned to this driver
    if (driverId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(driverId);

      let assignedToUuid = driverId;

      if (!isUuid) {
        const localDrivers = await getDriversLocally();
        const matched = localDrivers.find(d => d.custom_id === driverId || d.id === driverId);
        if (!matched?.id) {
          return 0;
        }
        assignedToUuid = matched.id;
      }

      const count = allPackages.filter(
        pkg =>
          pkg.assigned_to === assignedToUuid &&
          (includeArchived || !pkg.is_archived || pkg.status === 'Archived')
      ).length;

      return count;
    }

    // Admin/normal retrieval
    const validPackages = await filterValidUUIDPackages(allPackages);
    const count = validPackages.filter(pkg => includeArchived || !pkg.is_archived).length;
    return count;
  } catch (error) {
    console.error('Error getting package count:', error);
    return 0;
  }
};

// Function to filter out packages with invalid UUIDs
const filterValidUUIDPackages = async (packages: Package[]): Promise<Package[]> => {
  const validPackages = packages.filter(pkg => isValidUUID(pkg.id));
  const invalidPackages = packages.filter(pkg => !isValidUUID(pkg.id));
  
  if (invalidPackages.length > 0) {
    console.log(`🗑️ Filtering out ${invalidPackages.length} packages with invalid UUIDs:`, 
      invalidPackages.map(p => p.id));
    
    // Update local storage to remove invalid packages
    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(validPackages));
  }
  
  return validPackages;
};

/**
 * Get paginated packages with metadata
 */
export const getPackagesLocallyPaginated = async (
  driverId?: string,
  includeArchived: boolean = false,
  limit: number = 50,
  offset: number = 0
): Promise<{
  items: Package[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}> => {
  try {
    const total = await getPackageCountLocally(driverId, includeArchived);
    const items = await getPackagesLocally(driverId, includeArchived, limit, offset);
    
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    console.log(`📄 Paginated result: ${items.length} items, page ${page}/${totalPages}`);

    return {
      items,
      total,
      limit,
      offset,
      page,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    };
  } catch (error) {
    console.error('Error getting paginated packages:', error);
    return {
      items: [],
      total: 0,
      limit,
      offset,
      page: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
};

// Simple UUID v4 generator for React Native (no crypto module needed)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Local-first package creation with immediate sync of new package only
export const createPackage = async (packageData: Omit<Package, 'id' | 'updated_at' | 'version'>): Promise<void> => {
  try {
    const packages = await getPackagesLocally(undefined, true);
    // Generate proper UUID for Supabase compatibility
    const newPackage: Package = {
      ...packageData,
      id: generateUUID(),
      updated_at: new Date().toISOString(),
      version: 1
    };

    // Extract and encrypt sensitive data
    const sensitive = extractSensitiveData(newPackage);
    const sanitized = removeSensitiveData(newPackage);

    // Save locally first (guaranteed to work) - store without sensitive data
    packages.push(sanitized as Package);
    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
    console.log(`💾 Package ${newPackage.id} saved locally (sensitive data encrypted)`);

    // Store sensitive data securely
    await storeSensitiveData(newPackage.id, sensitive);

    // Try immediate sync of this specific package only
    try {
      // Use Supabase sync
      const { createPackage: supabaseCreatePackage } = require('./supabaseDatabase');
      const { addToSyncQueue } = require('./supabaseSync');

      await supabaseCreatePackage(newPackage);
      console.log(`✅ Package ${newPackage.id} synced to Supabase`);

      // Mark as synced in queue
      await addToSyncQueue({
        type: 'create',
        collection: 'packages',
        data: newPackage,
        timestamp: new Date().toISOString(),
        synced: true // Mark as already synced
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⏳ Package ${newPackage.id} created locally, will sync when online:`, errorMessage);
      // Add to sync queue for later
      await addToSyncQueue({
        id: `sync_${Date.now()}`,
        type: 'create',
        collection: 'packages',
        data: newPackage,
        timestamp: new Date().toISOString(),
        synced: false
      });
    }
  } catch (error) {
    console.error('Error creating package:', error);
    throw error;
  }
};

// Sync queue management
export const getSyncQueue = async (): Promise<SyncOperation[]> => {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addToSyncQueue = async (operation: SyncOperation): Promise<void> => {
  try {
    // Use Supabase sync queue
    const { addToSyncQueue: supabaseAddToQueue } = require('./supabaseSync');
    await supabaseAddToQueue(operation);
    console.log('📝 Added to Supabase sync queue');
  } catch (error) {
    console.error('Error adding to sync queue:', error);
  }
};

export const markSyncItemAsSynced = async (operationId: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const updatedQueue = queue.map(op =>
      op.id === operationId ? { ...op, synced: true } : op
    );
    // Remove synced items older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const filteredQueue = updatedQueue.filter(op =>
      !op.synced || op.timestamp > oneHourAgo
    );
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
  } catch (error) {
    console.error('Error marking sync item:', error);
  }
};

export const processSyncQueue = async (): Promise<void> => {
  try {
    // Use Supabase sync queue processing
    const { processSyncQueue: supabaseProcessQueue } = require('./supabaseSync');
    await supabaseProcessQueue();
    console.log('✅ Supabase sync queue processed');
  } catch (error) {
    console.error('Error processing Supabase sync queue:', error);
  }
};

// Real-time package filtering for admin dashboard
// Local-first package update (used by hook for immediate updates)
export const updatePackage = async (packageId: string, updates: Partial<Package>): Promise<void> => {
  try {
    // Update locally first
    const packages = await getPackagesLocally(undefined, true);
    const pkgIndex = packages.findIndex(p => p.id === packageId);

    if (pkgIndex >= 0) {
      const updatedPackage = {
        ...packages[pkgIndex],
        ...updates,
        _last_modified: new Date().toISOString(),
      };

      // Extract and encrypt sensitive data
      const sensitive = extractSensitiveData(updatedPackage);
      const sanitized = removeSensitiveData(updatedPackage);

      packages[pkgIndex] = sanitized as Package;
      await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
      console.log(`💾 Package ${packageId} updated locally (sensitive data encrypted)`);

      // Store sensitive data securely
      await storeSensitiveData(packageId, sensitive);

      // Route ALL Supabase writes through the sync queue.
      // The queue processor (supabaseSync.processSyncQueue) is the only place
      // that correctly strips JS-model-only fields (updated_at, version) before
      // sending to Supabase, so we must not call supabaseUpdatePackage directly here.
      const { addToSyncQueue } = require('./supabaseSync');
      await addToSyncQueue({
        id: `sync_${Date.now()}`,
        type: 'update',
        collection: 'packages',
        data: {
          id: packageId,
          updates: {
            ...updates,
            _last_modified: new Date().toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
        synced: false,
      });
      console.log(`📝 Package ${packageId} queued for Supabase sync`);
    }
  } catch (error) {
    console.error('Error updating package:', error);
    throw error;
  }
};

// Real-time package filtering for admin dashboard
export const getPackageStats = async (driverId?: string): Promise<{
  total: number;
  pending: number;
  assigned: number;
  inTransit: number;
  delivered: number;
  returned: number;
}> => {
  try {
    const packages = await getPackagesLocally(driverId);

    return {
      total: packages.length,
      pending: packages.filter(p => p.status === 'Pending').length,
      assigned: packages.filter(p => p.status === 'Assigned').length,
      inTransit: packages.filter(p => p.status === 'In Transit').length,
      delivered: packages.filter(p => p.status === 'Delivered').length,
      returned: packages.filter(p => p.status === 'Returned').length,
    };
  } catch (error) {
    console.error('Error getting package stats:', error);
    return {
      total: 0, pending: 0, assigned: 0,
      inTransit: 0, delivered: 0, returned: 0
    };
  }
};
