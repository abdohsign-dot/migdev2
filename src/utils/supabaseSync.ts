/**
 * Supabase Offline Sync utilities
 * Adapts existing sync logic to work with Supabase
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from './supabaseAuth';
import { 
  getPackages, 
  getPackagesServiceRole,
  getPackageById,
  getDrivers, 
  getDriversServiceRole,
  getDriverById,
  createPackage, 
  createPackageServiceRole,
  upsertPackageServiceRoleById,
  updatePackage, 
  updatePackageServiceRole,
  deletePackage,
  deletePackageServiceRole,
  deleteAllPackagesServiceRole,
  deleteAllDriversServiceRole,
  createDriver,
  createDriverServiceRole,
  updateDriver,
  updateDriverServiceRole,
  deleteDriver,
  deleteDriverServiceRole,
  getSyncOperations,
  createSyncOperation,
  markSyncOperationAsSynced,
  deleteSyncOperation,
  getSyncMetadata,
  updateSyncMetadata
} from './supabaseDatabase';
import { Package, Driver, SyncOperation } from '../types';
import {
  detectPackageConflict,
  detectDriverConflict,
  resolveConflict,
  logConflict,
  isCriticalConflict,
  getConflictSeverity,
  ConflictInfo,
} from './conflictDetection';

// Storage Keys (same as before for compatibility)
const PACKAGES_KEY = '@delivry:packages';
const DRIVERS_KEY = '@delivry:drivers';
const SYNC_QUEUE_KEY = '@delivry:syncQueue';
const LAST_SYNC_KEY = '@delivry:lastSync';
const MIGRATION_COMPLETED_KEY = '@delivry:supabaseMigrationCompleted';

// LOCAL STORAGE OPERATIONS (unchanged for compatibility)

export const getPackagesLocally = async (): Promise<Package[]> => {
  try {
    const data = await AsyncStorage.getItem(PACKAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// MIGRATION FUNCTIONS

/**
 * Check if migration to Supabase has been completed
 */
export const isMigrationCompleted = async (): Promise<boolean> => {
  try {
    const completed = await AsyncStorage.getItem(MIGRATION_COMPLETED_KEY);
    return completed === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark migration as completed
 */
export const markMigrationCompleted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(MIGRATION_COMPLETED_KEY, 'true');
  } catch (error) {
    console.error('Error marking migration as completed:', error);
  }
};

/**
 * Reset migration flag (for testing/retrying migration)
 */
export const resetMigrationFlag = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(MIGRATION_COMPLETED_KEY);
    console.log('🔄 Migration flag reset');
  } catch (error) {
    console.error('Error resetting migration flag:', error);
  }
};

/**
 * Clear all Supabase data (packages and drivers) using service role
 * Use this to reset Supabase before re-migration
 */
export const clearSupabaseData = async (): Promise<void> => {
  try {
    console.log('🧹 Clearing all Supabase data...');
    
    // Delete all packages
    await deleteAllPackagesServiceRole();
    console.log('✅ All packages deleted from Supabase');
    
    // Delete all drivers
    await deleteAllDriversServiceRole();
    console.log('✅ All drivers deleted from Supabase');
    
    console.log('🧹 Supabase data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing Supabase data:', error);
    throw error;
  }
};

/**
 * Full reset: clear Supabase data and reset migration flag
 */
export const fullResetForRemigration = async (): Promise<void> => {
  try {
    console.log('🔄 Starting full reset for re-migration...');
    await clearSupabaseData();
    await resetMigrationFlag();
    console.log('✅ Full reset complete. Ready for re-migration.');
  } catch (error) {
    console.error('❌ Error during full reset:', error);
    throw error;
  }
};

/**
 * Migrate local packages to Supabase
 * This function uploads all local packages to Supabase if Supabase is empty
 */
export const migrateLocalPackagesToSupabase = async (): Promise<void> => {
  try {
    console.log('🔄 Checking if migration to Supabase is needed...');

    // Get local packages first
    const localPackages = await getPackagesLocally();
    console.log(`📦 Found ${localPackages.length} local packages`);

    if (localPackages.length === 0) {
      console.log('📭 No local packages to migrate');
      await markMigrationCompleted();
      return;
    }

    // Check if Supabase already has packages (using service role to bypass RLS)
    const supabasePackages = await getPackagesServiceRole();
    console.log(`☁️ Supabase has ${supabasePackages.length} packages`);

    // If Supabase already has any data, skip migration to avoid overwriting
    if (supabasePackages.length > 0) {
      console.log('⚠️ Supabase already has data; skipping migration to avoid conflicts');
      await markMigrationCompleted();
      return;
    }

    // Check if migration has already been completed
    const migrationCompleted = await isMigrationCompleted();
    if (migrationCompleted) {
      console.log('⚠️ Migration already marked completed; skipping');
      return;
    }

    console.log('🚀 Starting migration of local packages to Supabase (RLS mode)...');
    let migratedCount = 0;
    let failedCount = 0;

    for (const pkg of localPackages) {
      try {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(pkg.id)) {
          console.log(`⚠️ Skipping package with invalid UUID: ${pkg.id}`);
          failedCount++;
          continue;
        }

        // Prepare package data for Supabase
        // Convert UUID ref_number to PKG-xxxxxx format if it's a UUID
        let refNumber = pkg.ref_number;
        if (uuidRegex.test(refNumber)) {
          // Generate PKG-xxxxxx format from UUID (use last 6 chars)
          const shortId = refNumber.split('-').pop()?.slice(-6).toUpperCase() || '000000';
          refNumber = `PKG-${shortId}`;
          console.log(`🔄 Converted UUID ref to PKG format: ${refNumber}`);
        }
        // Keep existing PKG- format as-is (don't shorten)

        const packageData: any = {
          ref_number: refNumber,
          status: pkg.status,
          customer_name: pkg.customer_name || null,
          customer_address: pkg.customer_address || null,
          customer_phone: pkg.customer_phone || null,
          customer_phone_2: pkg.customer_phone_2 || null,
          sender_name: pkg.sender_name || null,
          sender_company: pkg.sender_company || null,
          sender_phone: pkg.sender_phone || null,
          date_of_arrive: pkg.date_of_arrive || null,
          description: pkg.description || null,
          weight: pkg.weight || null,
          price: pkg.price || 0,
          is_paid: pkg.is_paid || false,
          limit_date: pkg.limit_date || null,
          limit_time: pkg.limit_time || null,
          gps_lat: pkg.gps_lat || null,
          gps_lng: pkg.gps_lng || null,
          assigned_to: pkg.assigned_to || null,
          assigned_at: pkg.assigned_at || null,
          accepted_at: pkg.accepted_at || null,
          delivered_at: pkg.delivered_at || null,
          return_reason: pkg.return_reason || null,
          supplement_info: pkg.supplement_info || null,
          is_archived: pkg.is_archived || false,
          archived_at: pkg.archived_at || null,
          created_at: pkg.created_at || new Date().toISOString(),
          updated_at: pkg._last_modified || pkg.updated_at || new Date().toISOString(),
          version: parseInt(pkg._version || pkg.version?.toString() || '1') || 1,
        };

        // Create package in Supabase (using service role to bypass RLS)
        await createPackageServiceRole(packageData);
        migratedCount++;
        console.log(`✅ Migrated package ${pkg.id} (${refNumber})`);
      } catch (error) {
        console.error(`❌ Failed to migrate package ${pkg.id}:`, error);
        failedCount++;
      }
    }

    console.log(`📊 Migration complete: ${migratedCount} succeeded, ${failedCount} failed`);

    // Only mark as completed if at least one package migrated successfully
    // Otherwise, reset flag to allow retry
    if (migratedCount > 0) {
      await markMigrationCompleted();
    } else {
      console.log('⚠️ No packages migrated successfully, resetting flag for retry');
      await resetMigrationFlag();
    }
  } catch (error) {
    console.error('❌ Error during migration to Supabase:', error);
    // Reset flag to allow retry on error
    await resetMigrationFlag();
    // Don't throw error - allow app to continue even if migration fails
  }
};

/**
 * Migrate local drivers to Supabase
 * This function uploads all local drivers to Supabase if Supabase is empty
 */
export const migrateLocalDriversToSupabase = async (): Promise<void> => {
  try {
    console.log('🔄 Checking if driver migration to Supabase is needed...');

    // Get local drivers
    const localDrivers = await getDriversLocally();
    console.log(`🚚 Found ${localDrivers.length} local drivers`);

    if (localDrivers.length === 0) {
      console.log('📭 No local drivers to migrate');
      return;
    }

    // Check if Supabase already has drivers (using service role to bypass RLS)
    const supabaseDrivers = await getDriversServiceRole();
    console.log(`☁️ Supabase has ${supabaseDrivers.length} drivers`);

    // Only migrate if Supabase is empty (to avoid overwriting existing data)
    if (supabaseDrivers.length > 0) {
      console.log('⚠️ Supabase already has driver data, skipping migration to avoid conflicts');
      return;
    }

    // Migrate drivers to Supabase
    console.log('🚀 Starting migration of local drivers to Supabase (service role mode)...');
    let migratedCount = 0;
    let failedCount = 0;

    for (const driver of localDrivers) {
      try {
        console.log(`🔄 Processing driver: ${driver.id} - ${driver.name}`);
        
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(driver.id)) {
          console.log(`⚠️ Driver has non-UUID ID: ${driver.id}, Supabase will auto-generate UUID`);
        }

        // Prepare driver data for Supabase (don't include id, let Supabase auto-generate)
        const driverData: any = {
          // custom_id: driver.id, // Skip custom_id for now - column might not exist
          name: driver.name,
          phone: driver.phone,
          vehicle_type: driver.vehicle_type,
          pin_code: driver.pin_code,
          is_active: driver.is_active !== undefined ? driver.is_active : true,
          created_at: driver.created_at || new Date().toISOString(),
          updated_at: driver._last_modified || driver.updated_at || new Date().toISOString(),
          version: parseInt(driver._version || driver.version?.toString() || '1') || 1,
        };

        console.log(`📦 Driver data prepared:`, JSON.stringify(driverData, null, 2));

        // Create driver in Supabase (using service role to bypass RLS)
        // Supabase will auto-generate the UUID
        const result = await createDriverServiceRole(driverData);
        migratedCount++;
        console.log(`✅ Migrated driver ${driver.id} (${driver.name}) -> Supabase UUID: ${result.id}`);
      } catch (error) {
        console.error(`❌ Failed to migrate driver ${driver.id}:`, error);
        console.error(`Error details:`, JSON.stringify(error, null, 2));
        failedCount++;
      }
    }

    console.log(`📊 Driver migration complete: ${migratedCount} succeeded, ${failedCount} failed`);
  } catch (error) {
    console.error('❌ Error during driver migration to Supabase:', error);
    // Don't throw error - allow app to continue even if migration fails
  }
};

export const storePackageLocally = async (pkg: Package): Promise<void> => {
  try {
    const packages = await getPackagesLocally();
    const existingIndex = packages.findIndex(p => p.id === pkg.id);

    // Normalize old timestamp fields to new standard
    const normalized: any = { ...pkg };
    if (normalized._lastModified && !normalized.updated_at) {
      normalized.updated_at = normalized._lastModified;
    }
    if (normalized._last_modified && !normalized.updated_at) {
      normalized.updated_at = normalized._last_modified;
    }
    if (normalized._version && !normalized.version) {
      normalized.version = parseInt(normalized._version) || 1;
    }
    delete normalized._lastModified;
    delete normalized._last_modified;
    delete normalized._version;

    if (existingIndex >= 0) {
      packages[existingIndex] = {
        ...packages[existingIndex],
        ...normalized,
        updated_at: new Date().toISOString()
      };
    } else {
      packages.push({
        ...normalized,
        created_at: normalized.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: normalized.version || 1
      });
    }

    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
  } catch (error) {
    console.error('Error storing package locally:', error);
    throw error;
  }
};

export const getDriversLocally = async (): Promise<Driver[]> => {
  try {
    const data = await AsyncStorage.getItem(DRIVERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Shared write-queue for storeDriverLocally — prevents concurrent read-write races.
// Both localDatabase.ts and supabaseSync.ts write to the same AsyncStorage key,
// so we import and reuse localDatabase's queue via the shared storeDriverLocally export.
// This version is kept for callers within supabaseSync that need the _last_modified normalization.
let _syncDriverWriteQueue: Promise<void> = Promise.resolve();

export const storeDriverLocally = async (driver: Driver): Promise<void> => {
  _syncDriverWriteQueue = _syncDriverWriteQueue.then(async () => {
    try {
      const drivers = await getDriversLocally();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      const existingIndex = drivers.findIndex(d =>
        d.id === driver.id ||
        (d.custom_id && driver.custom_id && d.custom_id === driver.custom_id) ||
        (d.id && driver.custom_id && d.id === driver.custom_id) ||
        (d.custom_id && driver.id && d.custom_id === driver.id)
      );

      // Normalize old timestamp/version fields from DB column names to JS model names
      const normalized: any = { ...driver };
      if (normalized._lastModified && !normalized.updated_at) {
        normalized.updated_at = normalized._lastModified;
      }
      if (normalized._last_modified && !normalized.updated_at) {
        normalized.updated_at = normalized._last_modified;
      }
      if (normalized._version && !normalized.version) {
        normalized.version = parseInt(normalized._version) || 1;
      }
      delete normalized._lastModified;
      delete normalized._last_modified;
      delete normalized._version;

      if (existingIndex >= 0) {
        const existingId = drivers[existingIndex].id;
        const incomingId = normalized.id;
        const shouldUpgradeId = incomingId && uuidRegex.test(incomingId) && !uuidRegex.test(existingId);

        drivers[existingIndex] = {
          ...drivers[existingIndex],
          ...normalized,
          id: shouldUpgradeId ? incomingId : (existingId || incomingId),
          updated_at: new Date().toISOString(),
        };
      } else {
        drivers.push({
          ...normalized,
          created_at: normalized.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: normalized.version || 1,
        });
      }

      // Safety net: collapse any residual duplicates by custom_id before writing
      const seen = new Set<string>();
      const deduped = drivers.filter(d => {
        const key = d.custom_id || d.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(deduped));
    } catch (error) {
      console.error('Error storing driver locally:', error);
      throw error;
    }
  });
  return _syncDriverWriteQueue;
};

// SYNC OPERATIONS

// Debounce handle for auto-flush — batches rapid back-to-back enqueues into one flush
let _autoFlushTimer: ReturnType<typeof setTimeout> | null = null;

const _scheduleAutoFlush = () => {
  if (_autoFlushTimer) clearTimeout(_autoFlushTimer);
  _autoFlushTimer = setTimeout(() => {
    _autoFlushTimer = null;
    // Fire-and-forget: flush the queue to Supabase immediately after any write
    processSyncQueue().catch((e) =>
      console.warn('[autoFlush] processSyncQueue error:', e)
    );
  }, 300); // 300 ms debounce — batches rapid bulk writes
};

/**
 * Add operation to sync queue
 */
export const addToSyncQueue = async (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'synced'>): Promise<void> => {
  try {
    // Always enqueue locally for offline support.
    // Even if user/session is missing, drivers/admin can still process the local queue.
    const queue = await getSyncQueue();
    const newOperation: SyncOperation = {
      ...operation,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      synced: false,
    };
    queue.push(newOperation);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

    // If we have a user, also enqueue into Supabase sync operations table.
    const user = await getCurrentUser();
    if (user) {
      await createSyncOperation({
        ...operation,
        synced: false,
        user_id: user.id,
      });
    } else {
      console.warn('No user logged in, sync operations will be processed from local queue only');
    }

    // Auto-flush: immediately push this change to Supabase (debounced to batch bulk writes)
    _scheduleAutoFlush();
  } catch (error) {
    console.error('Error adding to sync queue:', error);
    // Don't throw error - sync queue should be resilient
  }
};

/**
 * Get sync queue from local storage
 */
export const getSyncQueue = async (): Promise<SyncOperation[]> => {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

/**
 * Get last sync time
 */
export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    const data = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return data;
  } catch {
    return null;
  }
};

/**
 * Update last sync time
 */
export const updateLastSyncTime = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error updating last sync time:', error);
  }
};

// SYNC FROM SUPABASE TO LOCAL

/**
 * Sync packages from Supabase to local storage
 */
export const syncPackagesFromSupabase = async (driverId?: string): Promise<void> => {
  try {
    const packages = driverId 
      ? await getPackagesByDriver(driverId)
      : await getPackages();

    // Store all packages locally
    for (const pkg of packages) {
      await storePackageLocally(pkg);
    }

    console.log(`✅ Synced ${packages.length} packages from Supabase`);
  } catch (error) {
    console.error('Error syncing packages from Supabase:', error);
    throw error;
  }
};

/**
 * Get packages by driver (helper function)
 */
export const getPackagesByDriver = async (driverId: string): Promise<Package[]> => {
  try {
    const db = require('./supabaseDatabase');
    return await db.getPackagesByDriver(driverId);
  } catch (error) {
    console.error('Error getting packages by driver:', error);
    throw error;
  }
};

/**
 * Sync drivers from Supabase to local storage
 */
export const syncDriversFromSupabase = async (): Promise<void> => {
  try {
    const drivers = await getDrivers();

    // Store all drivers locally
    for (const driver of drivers) {
      // Use the Supabase UUID as the local id
      await storeDriverLocally(driver);
    }

    console.log(`✅ Synced ${drivers.length} drivers from Supabase`);
  } catch (error) {
    console.error('Error syncing drivers from Supabase:', error);
    throw error;
  }
};

// PROCESS SYNC QUEUE

/**
 * Process sync queue (upload local changes to Supabase)
 */
export const processSyncQueue = async (): Promise<void> => {
  try {
    // Prefer processing from Supabase sync_operations when user exists,
    // but also support processing the local @delivry:syncQueue when user is missing.
    const user = await getCurrentUser();

    if (user) {
      // Get operations from Supabase sync operations table
      const operations = await getSyncOperations(user.id);

      if (operations.length === 0) {
        console.log('No pending sync operations');
      } else {
        console.log(`Processing ${operations.length} sync operations`);
        for (const operation of operations) {
          try {
            await processSyncOperation(operation);
            await markSyncOperationAsSynced(operation.id);
          } catch (error) {
            console.error(`Error processing sync operation ${operation.id}:`, error);
            // Continue with other operations
          }
        }

        // Update sync metadata
        await updateSyncMetadata(user.id, {
          last_sync: new Date().toISOString(),
          pending_count: 0,
        });
      }

      // Update local last sync time
      await updateLastSyncTime();
      console.log('✅ Sync queue processed successfully (Supabase mode)');
      return;
    }

    // No user: process local queue only.
    const localQueue = await getSyncQueue();
    if (localQueue.length === 0) {
      console.log('No local sync queue operations to process');
      return;
    }

    console.log(`Processing ${localQueue.length} local sync operations (no user mode)`);

    // Apply operations using service-role package update/create/delete.
    // Track failures so we can re-queue them instead of silently discarding.
    const failedOps: typeof localQueue = [];

    for (const operation of localQueue) {
      const { type, collection, data } = operation;

      try {
        // DEBUG: inspect which package identifier + updates we are applying in no-user mode
        console.log('[syncQueue:no-user][op]', {
          operationId: operation?.id,
          type,
          collection,
          dataId: data?.id,
          updates: data?.updates,
        });

        if (collection === 'packages') {
          /**
           * Strip JS-model-only fields that the DB schema doesn't have
           * (updated_at, version) and remap them to the real DB columns
           * (_last_modified, _version). Any remaining unknown keys are left
           * for updatePackageServiceRole to handle.
           */
          const normalizeAuditKeys = (obj: any) => {
            if (!obj || typeof obj !== 'object') return obj;
            const out: any = { ...obj };

            // _last_modified is the real DB column; remap from any alias
            if (out._lastModified && !out._last_modified) {
              out._last_modified = out._lastModified;
            }
            // updated_at is a JS-model field — do NOT pass to Supabase
            delete out._lastModified;
            delete out.updated_at;

            // _version is the real DB column (TEXT); remap from numeric `version`
            if (out.version !== undefined && out._version === undefined) {
              out._version = String(out.version);
            }
            delete out.version;

            return out;
          };

          if (type === 'update') {
            // Payloads can be either { id, updates: {...} } or { id, ...fields }
            const rawUpdates = data?.updates ?? (() => {
              const { id: _id, ...rest } = data || {};
              return rest;
            })();

            const updates = normalizeAuditKeys(rawUpdates);

            // We are the originator of this local change — push it straight to
            // Supabase. No pre-write conflict check needed; the purpose of this
            // code path is to apply pending local writes, not to merge remote
            // state on top of them.
            try {
              const result = await updatePackageServiceRole(data.id, updates);
              if (!result) {
                console.warn(`[syncQueue] updatePackageServiceRole returned null for id=${data.id} — package may not exist in Supabase yet`);
              } else {
                console.log(`[syncQueue] ✅ Updated package ${data.id} in Supabase`);
              }
            } catch (updateError: any) {
              console.error(`[syncQueue] ❌ Failed to update package ${data.id}:`, JSON.stringify(updateError));
              throw updateError; // bubble to outer catch to re-queue
            }
          } else if (type === 'create') {
            const pkgData = normalizeAuditKeys(data);
            await upsertPackageServiceRoleById(pkgData);
          } else if (type === 'delete') {
            // delete is RLS-protected; use service role so admin deletion works even in no-user mode.
            await deletePackageServiceRole(data.id);
          } else {
            console.warn(`Unknown package operation type (local): ${type}`);
          }
        } else if (collection === 'drivers') {
          // Drivers updates are not needed for the immediate task,
          // but keep existing behavior using normal helpers.
          await processSyncOperation(operation, true); // pass true for service role in no-user mode
        } else {
          console.warn(`Unknown collection in local sync operation: ${collection}`);
        }
      } catch (error: any) {
        console.error(`[syncQueue] ❌ Error processing op ${operation.id}:`, JSON.stringify(error));
        // Keep failed ops so they are retried on the next processSyncQueue call.
        failedOps.push(operation);
      }
    }

    // Only keep failed ops in the queue; successfully processed ones are dropped.
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(failedOps));
    if (failedOps.length > 0) {
      console.warn(`[syncQueue] ⚠️ ${failedOps.length}/${localQueue.length} ops failed and remain in queue for retry`);
    }

    const [freshPackages, freshDrivers] = await Promise.all([
      (async () => {
        const pkgs = await getPackagesServiceRole();
        for (const pkg of pkgs) {
          await storePackageLocally(pkg);
        }
        console.log(`✅ Synced ${pkgs.length} packages from Supabase (service role)`);
        return pkgs.length;
      })(),
      (async () => {
        const drs = await getDriversServiceRole();
        for (const driver of drs) {
          await storeDriverLocally(driver);
        }
        console.log(`✅ Synced ${drs.length} drivers from Supabase (service role)`);
        return drs.length;
      })(),
    ]);

    await updateLastSyncTime();
    console.log('✅ Local sync queue processed successfully (cleared)');
  } catch (error) {
    console.error('Error processing sync queue:', error);
    throw error;
  }
};

/**
 * Process individual sync operation with conflict detection
 */
const processSyncOperation = async (operation: SyncOperation, useServiceRole: boolean = false): Promise<void> => {
  const { type, collection, data } = operation;

  switch (collection) {
    case 'packages':
      await processPackageOperation(type, data);
      break;
    case 'drivers':
      await processDriverOperation(type, data, useServiceRole);
      break;
    default:
      console.warn(`Unknown collection in sync operation: ${collection}`);
  }
};

/**
 * Process package sync operation with conflict detection
 */
const processPackageOperation = async (type: string, data: any): Promise<void> => {
  switch (type) {
    case 'create':
      await createPackage(data);
      break;
    case 'update':
      // Detect conflicts before updating
      await updatePackageWithConflictDetection(data.id, data);
      break;
    case 'delete':
      await deletePackage(data.id);
      break;
    default:
      console.warn(`Unknown package operation type: ${type}`);
  }
};

/**
 * Update package with conflict detection
 * Checks for conflicts between local and remote versions before applying update
 */
const updatePackageWithConflictDetection = async (
  id: string,
  updates: Partial<Package>
): Promise<void> => {
  try {
    // Get the remote version
    const remotePackage = await getPackageById(id);
    
    if (!remotePackage) {
      // Package doesn't exist remotely - just create it
      console.log(`📦 Package ${id} not found remotely, creating...`);
      await createPackage(updates as any);
      return;
    }

    // Create a local version object for conflict detection
    const localPackage: Package = {
      ...remotePackage,
      ...updates,
      version: (updates.version || remotePackage.version) + 1,
      updated_at: new Date().toISOString(),
    };

    // Detect conflicts
    const conflict = detectPackageConflict(localPackage, remotePackage);

    if (conflict.hasConflict) {
      logConflict(conflict, 'sync-update');
      const severity = getConflictSeverity(conflict);
      console.log(`⚠️ Conflict severity: ${severity}/100`);

      // Check if it's a critical conflict
      if (isCriticalConflict(conflict)) {
        console.warn(`🚨 Critical conflict detected for package ${id}. Manual resolution needed.`);
        // Log for manual review but don't block sync
        // In a real app, you'd queue this for manual review UI
        return;
      }

      // Auto-resolve using recommended strategy
      const resolution = resolveConflict(localPackage, remotePackage, conflict.recommendation);
      console.log(`✅ Auto-resolved conflict using strategy: ${resolution.strategy}`);
      console.log(`   Conflicting fields: ${resolution.conflictingFields.join(', ')}`);

      // Apply the resolved data
      await updatePackage(id, resolution.mergedData);
    } else {
      // No conflict - apply update normally
      await updatePackage(id, updates);
    }
  } catch (error) {
    console.error(`Error updating package with conflict detection: ${id}`, error);
    throw error;
  }
};

/**
 * Process driver sync operation
 */
const processDriverOperation = async (type: string, data: any, useServiceRole: boolean = false): Promise<void> => {
  switch (type) {
    case 'create':
      if (useServiceRole) {
        await createDriverServiceRole(data);
      } else {
        await createDriver(data);
      }
      break;
    case 'update':
      // Payloads can be either { id, updates: {...} } or { id, ...fields }
      const updates = data.updates || (() => {
        const { id, ...rest } = data;
        return rest;
      })();
      // Detect conflicts before updating
      await updateDriverWithConflictDetection(data.id, updates, useServiceRole);
      break;
    case 'delete':
      if (useServiceRole) {
        await deleteDriverServiceRole(data.id);
      } else {
        await deleteDriver(data.id);
      }
      break;
    default:
      console.warn(`Unknown driver operation type: ${type}`);
  }
};

/**
 * Update driver with conflict detection
 * Checks for conflicts between local and remote versions before applying update
 */
const updateDriverWithConflictDetection = async (
  id: string,
  updates: Partial<Driver>,
  useServiceRole: boolean = false
): Promise<void> => {
  try {
    // Get the remote version
    const remoteDriver = await getDriverById(id);
    
    if (!remoteDriver) {
      // Driver doesn't exist remotely - just create it
      console.log(`🚚 Driver ${id} not found remotely, creating...`);
      if (useServiceRole) {
        await createDriverServiceRole(updates as any);
      } else {
        await createDriver(updates as any);
      }
      return;
    }

    // Fix NaN versions
    const updateV = typeof updates.version === 'number' && !isNaN(updates.version) ? updates.version : 
                   (typeof (updates as any)._version !== 'undefined' ? Number((updates as any)._version) || 1 : 1);
    
    const remoteV = typeof remoteDriver.version === 'number' && !isNaN(remoteDriver.version) ? remoteDriver.version : 
                   (typeof (remoteDriver as any)._version !== 'undefined' ? Number((remoteDriver as any)._version) || 1 : 1);

    // Create a local version object for conflict detection
    const localDriver: Driver = {
      ...remoteDriver,
      ...updates,
      version: Math.max(updateV, remoteV) + 1,
      updated_at: new Date().toISOString(),
    };

    // Detect conflicts
    const conflict = detectDriverConflict(localDriver, remoteDriver);

    if (conflict.hasConflict) {
      logConflict(conflict, 'sync-update');
      const severity = getConflictSeverity(conflict);
      console.log(`⚠️ Conflict severity: ${severity}/100`);

      // Check if it's a critical conflict
      if (isCriticalConflict(conflict)) {
        console.warn(`🚨 Critical conflict detected for driver ${id}. Manual resolution needed.`);
        // Log for manual review but don't block sync
        return;
      }

      // Auto-resolve using recommended strategy
      const resolution = resolveConflict(localDriver, remoteDriver, conflict.recommendation);
      console.log(`✅ Auto-resolved conflict using strategy: ${resolution.strategy}`);
      console.log(`   Conflicting fields: ${resolution.conflictingFields.join(', ')}`);

      // Apply the resolved data
      if (useServiceRole) {
        await updateDriverServiceRole(id, resolution.mergedData);
      } else {
        await updateDriver(id, resolution.mergedData);
      }
    } else {
      // No conflict - apply update normally
      if (useServiceRole) {
        await updateDriverServiceRole(id, updates);
      } else {
        await updateDriver(id, updates);
      }
    }
  } catch (error) {
    console.error(`Error updating driver with conflict detection: ${id}`, error);
    throw error;
  }
};

// FULL SYNC

/**
 * Perform full sync (download from Supabase, upload to Supabase)
 */
export const performFullSync = async (driverId?: string): Promise<void> => {
  try {
    console.log('🔄 Starting full sync...');

    // Step 0: Migrate local data to Supabase if needed (only runs once)
    await migrateLocalPackagesToSupabase();
    await migrateLocalDriversToSupabase();

    // Step 1: Download latest data from Supabase
    await Promise.all([
      syncPackagesFromSupabase(driverId),
      syncDriversFromSupabase(),
    ]);

    // Step 2: Upload local changes to Supabase
    await processSyncQueue();

    console.log('✅ Full sync completed successfully');
  } catch (error) {
    console.error('Error during full sync:', error);
    throw error;
  }
};

// CONFLICT RESOLUTION

/**
 * Resolve conflicts between local and remote data
 */
export const resolveConflicts = async (localData: any[], remoteData: any[]): Promise<any[]> => {
  // Simple conflict resolution: remote data takes precedence
  // In a real implementation, you might want more sophisticated conflict resolution
  const mergedData = [...remoteData];

  // Add local-only items (items that don't exist remotely)
  for (const localItem of localData) {
    const existsRemotely = remoteData.some(remote => remote.id === localItem.id);
    if (!existsRemotely) {
      mergedData.push(localItem);
    }
  }

  return mergedData;
};

// UTILITY FUNCTIONS

/**
 * Check if device is online
 * Uses real network detection instead of hardcoded true
 */
export const isOnline = async (): Promise<boolean> => {
  const { isOnline: checkOnline } = await import('./networkDetection');
  return checkOnline();
};

/**
 * Get sync status
 */
export const getSyncStatus = async () => {
  try {
    const user = await getCurrentUser();
    const online = await isOnline();
    
    if (!user) {
      return { status: 'offline', lastSync: null, pendingCount: 0, isOnline: online };
    }

    const metadata = await getSyncMetadata(user.id);
    const operations = await getSyncOperations(user.id);

    return {
      status: online ? 'online' : 'offline',
      lastSync: metadata?.last_sync || null,
      pendingCount: operations.length,
      isOnline: online,
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return { status: 'error', lastSync: null, pendingCount: 0, isOnline: false };
  }
};

/**
 * Force sync (manual sync trigger)
 */
export const forceSync = async (driverId?: string): Promise<void> => {
  try {
    const online = await isOnline();
    if (!online) {
      throw new Error('Device is offline. Cannot sync.');
    }

    await performFullSync(driverId);
  } catch (error) {
    console.error('Error during force sync:', error);
    throw error;
  }
};
