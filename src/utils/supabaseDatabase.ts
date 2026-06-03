/**
 * Supabase Database utilities
 * All public-data operations go through SECURITY DEFINER RPCs.
 * Direct .from() access is limited to infrastructure tables only
 * (sync_operations, sync_metadata) which are not user-visible.
 */

import { getDb } from '../supabase/config';
import { executeRpc } from './supabaseRpc';
import { Package, Driver, SyncOperation } from '../types';

/** Build a JSONB-safe plain object from any package payload. */
const toJsonb = (obj: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
};

/**
 * Convert a JS package payload into a DB-ready payload for RPC calls.
 * Maps local-only fields to the real DB audit columns and strips invalid props.
 */
const sanitizePackagePayloadForRpc = (
  obj: Record<string, any>,
  options: { stripLastModified?: boolean } = {}
): Record<string, any> => {
  const out = toJsonb(obj);

  if (out.updated_at !== undefined && out._last_modified === undefined) {
    out._last_modified = out.updated_at;
  }
  if (out.version !== undefined && out._version === undefined) {
    out._version = String(out.version);
  }

  if (out._last_modified !== undefined) {
    if (out._last_modified instanceof Date) {
      out._last_modified = out._last_modified.toISOString();
    } else if (typeof out._last_modified === 'number') {
      out._last_modified = new Date(out._last_modified).toISOString();
    } else if (typeof out._last_modified === 'string') {
      const parsed = Date.parse(out._last_modified);
      if (!isNaN(parsed)) {
        out._last_modified = new Date(parsed).toISOString();
      } else {
        delete out._last_modified;
      }
    } else {
      delete out._last_modified;
    }
  }

  if (options.stripLastModified) {
    delete out._last_modified;
  }

  delete out.updated_at;
  delete out.version;

  return out;
};

// PACKAGES OPERATIONS

/**
 * Get all packages
 */
export const getPackages = async (): Promise<Package[]> => {
  try {
    return await executeRpc<Package[]>('admin_get_packages');
  } catch (error) {
    console.error('Error getting packages:', error);
    throw error;
  }
};

/**
 * Get packages by driver ID (UUID or custom_id).
 * Resolves custom_id -> UUID via admin_get_driver RPC if needed.
 */
export const getPackagesByDriver = async (driverId: string): Promise<Package[]> => {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let assignedToUuid = driverId;

    if (!uuidRegex.test(driverId)) {
      // Resolve custom_id -> UUID via RPC
      const driver = await executeRpc<Driver | null>('admin_get_driver', { p_driver_id: driverId });
      if (!driver?.id) return [];
      assignedToUuid = driver.id;
    }

    return await executeRpc<Package[]>('get_packages_by_driver', { p_target_driver_id: assignedToUuid });
  } catch (error) {
    console.error('Error getting packages by driver:', error);
    throw error;
  }
};

/**
 * Create a new package.
 */
export const createPackage = async (packageData: Omit<Package, 'id' | 'updated_at' | 'version'>): Promise<Package> => {
  try {
    const payload = sanitizePackagePayloadForRpc(packageData as any, { stripLastModified: true });
    return await executeRpc<Package>('upsert_package_by_id', { p_package: payload });
  } catch (error) {
    console.error('Error creating package:', error);
    throw error;
  }
};

/**
 * Update a package.
 */
export const updatePackage = async (id: string, updates: Partial<Package>): Promise<Package> => {
  try {
    const { updated_at: _ua, version: _v, id: _id, ...safeUpdates } = updates as any;
    return await executeRpc<Package>('admin_update_package', {
      p_package_id: id,
      p_updates: toJsonb(safeUpdates),
    });
  } catch (error) {
    console.error('Error updating package:', error);
    throw error;
  }
};

/**
 * Delete a package by ID.
 */
export const deletePackage = async (id: string): Promise<void> => {
  try {
    await executeRpc<void>('admin_delete_package', { p_package_id: id });
  } catch (error) {
    console.error('Error deleting package:', error);
    throw error;
  }
};

/**
 * Get package by ID
 */
export const getPackageById = async (id: string): Promise<Package | null> => {
  try {
    return await executeRpc<Package | null>('get_package_by_id', { p_package_id: id });
  } catch (error) {
    console.error('Error getting package by id:', error);
    throw error;
  }
};

// DRIVERS OPERATIONS

/**
 * Get all drivers (excludes SYSTEM_ADMIN_PIN sentinel row).
 */
export const getDrivers = async (): Promise<Driver[]> => {
  try {
    return await executeRpc<Driver[]>('admin_get_drivers');
  } catch (error) {
    console.error('Error getting drivers:', error);
    throw error;
  }
};

/**
 * Get active drivers only.
 */
export const getActiveDrivers = async (): Promise<Driver[]> => {
  try {
    return await executeRpc<Driver[]>('admin_get_active_drivers');
  } catch (error) {
    console.error('Error getting active drivers:', error);
    throw error;
  }
};

/**
 * Get driver by ID. Supports both UUID and custom_id formats.
 */
export const getDriverById = async (id: string): Promise<Driver | null> => {
  try {
    console.log(`🔍 getDriverById: id=${id}`);
    const driver = await executeRpc<Driver | null>('admin_get_driver', { p_driver_id: id });
    if (driver) console.log(`✅ Driver found:`, driver);
    else console.log(`ℹ️ Driver not found for id=${id}`);
    return driver;
  } catch (error) {
    console.error('Error getting driver by ID:', error);
    throw error;
  }
};

/**
 * Get driver by phone (searches via admin_search_drivers).
 */
export const getDriverByPhone = async (phone: string): Promise<Driver | null> => {
  try {
    const results = await executeRpc<Driver[]>('admin_search_drivers', { p_query: phone });
    return results.find(d => d.phone === phone) ?? null;
  } catch (error) {
    console.error('Error getting driver by phone:', error);
    throw error;
  }
};

/**
 * Get driver by custom_id (e.g., DRV-XXXXXX).
 */
export const getDriverByCustomId = async (customId: string): Promise<Driver | null> => {
  try {
    return await executeRpc<Driver | null>('admin_get_driver', { p_driver_id: customId });
  } catch (error) {
    console.error('Error getting driver by custom_id:', error);
    throw error;
  }
};

/**
 * Create new driver via admin RPC.
 */
export const createDriver = async (driverData: Omit<Driver, 'id' | 'updated_at' | 'version'>): Promise<Driver> => {
  try {
    const raw = driverData as any;
    const generateCustomId = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let result = 'DRV-';
      for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };
    const custom_id = raw.custom_id || raw.id || generateCustomId();
    const version = typeof raw.version === 'number' && !isNaN(raw.version) ? raw.version : 1;
    const { id: _id, updated_at: _ua, version: _v, custom_id: _cid, ...safeData } = raw;

    return await executeRpc<Driver>('admin_create_driver', {
      p_driver: toJsonb({ ...safeData, custom_id, _version: String(version), _last_modified: new Date().toISOString() }),
    });
  } catch (error) {
    console.error('Error creating driver:', error);
    throw error;
  }
};

/**
 * Update driver via admin RPC.
 */
export const updateDriver = async (id: string, updates: Partial<Driver>): Promise<Driver> => {
  try {
    const { updated_at: _ua, version: _v, id: _id, custom_id: _cid, ...safeUpdates } = updates as any;
    return await executeRpc<Driver>('admin_update_driver', {
      p_driver_id: id,
      p_updates: toJsonb({ ...safeUpdates, _last_modified: new Date().toISOString() }),
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    throw error;
  }
};

/**
 * Delete driver via admin RPC.
 */
export const deleteDriver = async (id: string): Promise<void> => {
  try {
    await executeRpc<void>('admin_delete_driver', { p_driver_id: id });
  } catch (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
};

// SYNC OPERATIONS

/**
 * Get sync operations for user
 */
export const getSyncOperations = async (userId: string): Promise<SyncOperation[]> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('sync_operations')
      .select('*')
      .eq('user_id', userId)
      .eq('synced', false)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting sync operations:', error);
    throw error;
  }
};

/**
 * Create sync operation
 */
export const createSyncOperation = async (operation: Omit<SyncOperation, 'id' | 'timestamp'> & { user_id: string }): Promise<SyncOperation> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('sync_operations')
      .insert({
        ...operation,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating sync operation:', error);
    throw error;
  }
};

/**
 * Mark sync operation as synced
 */
export const markSyncOperationAsSynced = async (id: string): Promise<void> => {
  try {
    const db = getDb();
    const { error } = await db
      .from('sync_operations')
      .update({ synced: true })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error marking sync operation as synced:', error);
    throw error;
  }
};

/**
 * Delete sync operation
 */
export const deleteSyncOperation = async (id: string): Promise<void> => {
  try {
    const db = getDb();
    const { error } = await db
      .from('sync_operations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting sync operation:', error);
    throw error;
  }
};

// SYNC METADATA

/**
 * Get sync metadata for user
 */
export const getSyncMetadata = async (userId: string) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('sync_metadata')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error getting sync metadata:', error);
    throw error;
  }
};

/**
 * Update sync metadata
 */
export const updateSyncMetadata = async (userId: string, updates: { last_sync?: string; pending_count?: number }) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('sync_metadata')
      .upsert({
        user_id: userId,
        ...updates,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating sync metadata:', error);
    throw error;
  }
};

// UTILITY FUNCTIONS

/**
 * Get package statistics via admin RPC.
 */
export const getPackageStats = async () => {
  try {
    return await executeRpc<{
      total: number; pending: number; assigned: number;
      inTransit: number; delivered: number; returned: number; archived: number;
    }>('admin_get_package_stats');
  } catch (error) {
    console.error('Error getting package stats:', error);
    throw error;
  }
};

/**
 * Search packages by reference number or customer name.
 */
export const searchPackages = async (query: string): Promise<Package[]> => {
  try {
    return await executeRpc<Package[]>('admin_search_packages', { p_query: query });
  } catch (error) {
    console.error('Error searching packages:', error);
    throw error;
  }
};

/**
 * Search drivers by name or phone.
 */
export const searchDrivers = async (query: string): Promise<Driver[]> => {
  try {
    return await executeRpc<Driver[]>('admin_search_drivers', { p_query: query });
  } catch (error) {
    console.error('Error searching drivers:', error);
    throw error;
  }
};

/** Incremental package pull. */
export const getPackagesSince = async (
  sinceIso: string,
  assignedToUuid?: string
): Promise<Package[]> => {
  try {
    return await executeRpc<Package[]>('get_packages_since', { p_since_iso: sinceIso, p_target_driver_id: assignedToUuid });
  } catch (error) {
    console.error('Error getting packages since timestamp:', error);
    throw error;
  }
};

/** Packages assigned to one driver. */
export const getPackagesForAssignee = async (
  assignedToUuid: string
): Promise<Package[]> => {
  try {
    return await executeRpc<Package[]>('get_packages_by_driver', { p_target_driver_id: assignedToUuid });
  } catch (error) {
    console.error('Error getting assignee packages:', error);
    throw error;
  }
};

export const upsertPackageById = async (
  packageData: any
): Promise<Package> => {
  try {
    // Sanitize the payload (normalises updated_at→_last_modified, version→_version, etc.)
    // We do NOT strip _last_modified here: the upsert_package_by_id Postgres function
    // references it via p_package->>'_last_modified' (returns `text`). When the key is
    // absent that expression evaluates to NULL::text which Postgres type-checks against
    // the `timestamptz` column and raises error 42804. Sending a valid ISO string allows
    // the function to cast it correctly with ::timestamptz.
    const cleanPackage = sanitizePackagePayloadForRpc(packageData, { stripLastModified: false });

    // Guarantee _last_modified is always present so the RPC receives a castable value.
    if (!cleanPackage._last_modified) {
      cleanPackage._last_modified = new Date().toISOString();
    }

    console.log('[upsertPackageById] sending _last_modified to upsert_package_by_id:', cleanPackage._last_modified);
    return await executeRpc<Package>('upsert_package_by_id', { p_package: cleanPackage });
  } catch (error) {
    console.error('Error upserting package by id:', error);
    throw error;
  }
};

export const getDriversSince = async (sinceIso: string): Promise<Driver[]> => {
  try {
    return await executeRpc<Driver[]>('admin_get_drivers_since', { p_since_iso: sinceIso });
  } catch (error) {
    console.error('Error getting drivers since timestamp:', error);
    throw error;
  }
};

/** Delete all packages */
export const deleteAllPackages = async (): Promise<void> => {
  try {
    await executeRpc('admin_delete_all_packages');
  } catch (error) {
    console.error('Error deleting all packages:', error);
    throw error;
  }
};

/** Delete all drivers */
export const deleteAllDrivers = async (): Promise<void> => {
  try {
    await executeRpc('admin_delete_all_drivers');
  } catch (error) {
    console.error('Error deleting all drivers:', error);
    throw error;
  }
};
