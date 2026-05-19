/**
 * Supabase Database utilities
 * Replaces Firestore operations with Supabase queries
 */

import { getDb, getDbServiceRole } from '../supabase/config';
import { Package, Driver, SyncOperation } from '../types';

// PACKAGES OPERATIONS

/**
 * Get all packages
 */
export const getPackages = async (): Promise<Package[]> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting packages:', error);
    throw error;
  }
};

/**
 * Get all packages with service role (bypasses RLS)
 * Used for migration to check actual package count
 */
export const getPackagesServiceRole = async (): Promise<Package[]> => {
  try {
    const db = getDbServiceRole();
    const { data, error } = await db
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting packages with service role:', error);
    throw error;
  }
};

/** Packages assigned to one driver (service role) — avoids downloading the full table. */
export const getPackagesServiceRoleForAssignee = async (
  assignedToUuid: string
): Promise<Package[]> => {
  try {
    const db = getDbServiceRole();
    const { data, error } = await db
      .from('packages')
      .select('*')
      .eq('assigned_to', assignedToUuid)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting assignee packages with service role:', error);
    throw error;
  }
};

/** Incremental package pull (creates/updates only; run periodic full sync for deletes). */
export const getPackagesServiceRoleSince = async (
  sinceIso: string,
  assignedToUuid?: string
): Promise<Package[]> => {
  try {
    const db = getDbServiceRole();
    let query = db
      .from('packages')
      .select('*')
      .gte('_last_modified', sinceIso)
      .order('_last_modified', { ascending: false });

    if (assignedToUuid) {
      query = query.eq('assigned_to', assignedToUuid);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting packages since timestamp:', error);
    throw error;
  }
};

/**
 * Get packages by driver ID
 */
export const getPackagesByDriver = async (driverId: string): Promise<Package[]> => {
  try {
    const db = getDb();

    // Drivers screen may pass `custom_id` (e.g. DRV-XXXX) instead of UUID.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(driverId);

    // If not UUID, resolve custom_id -> UUID id first.
    let assignedToId = driverId;
    if (!isUuid) {
      const { data: driverRow, error: driverErr } = await db
        .from('drivers')
        .select('id, custom_id')
        .eq('custom_id', driverId)
        .maybeSingle();

      if (driverErr) throw driverErr;
      if (!driverRow?.id) return [];

      assignedToId = driverRow.id;
    }

    const { data, error } = await db
      .from('packages')
      .select('*')
      .eq('assigned_to', assignedToId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting packages by driver:', error);
    throw error;
  }
};

/**
 * Get package by ID
 */
export const getPackageById = async (id: string): Promise<Package | null> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting package by ID:', error);
    throw error;
  }
};

/**
 * Get package by reference number
 */
export const getPackageByRefNumber = async (refNumber: string): Promise<Package | null> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('packages')
      .select('*')
      .eq('ref_number', refNumber)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting package by ref number:', error);
    throw error;
  }
};

/**
 * Strip all JS-side fields that do not exist as real database columns in PostgreSQL table `packages`.
 * This prevents PGRST204 schema cache errors.
 */
export const sanitizePackagePayload = (data: any): any => {
  const clean = { ...data };
  
  // JS model fields that do not exist in PostgreSQL schema
  delete clean.version;
  delete clean.updated_at;
  delete clean.statusHistory;
  delete clean.status_history;
  delete clean.changedBy;
  delete clean.changed_by;
  delete clean.auditLog;
  delete clean.audit_log;
  delete clean.source;
  delete clean.completion_notes;
  delete clean.archivedByDriver;
  delete clean.archivedByAdmin;
  delete clean._lastModified;
  delete clean._last_modified;
  delete clean._version;

  return clean;
};

/**
 * Create new package
 */
export const createPackage = async (packageData: Omit<Package, 'id' | 'updated_at' | 'version'>): Promise<Package> => {
  try {
    const db = getDb();
    const cleanPackage = sanitizePackagePayload(packageData);

    const { data, error } = await db
      .from('packages')
      .insert({
        ...cleanPackage,
        _last_modified: new Date().toISOString(),
        _version: '1',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42501') {
        console.log(`ℹ️ [createPackage] RLS select blocked with code 42501, but insert succeeded. returning local model.`);
        return {
          ...packageData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
        } as unknown as Package;
      }
      throw error;
    }
    return data as Package;
  } catch (error: any) {
    if (error && error.code === '42501') {
      console.log(`ℹ️ [createPackage] Caught RLS select block with code 42501, but insert succeeded. returning local model.`);
      return {
        ...packageData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      } as unknown as Package;
    }
    console.error('Error creating package:', error);
    throw error;
  }
};

/**
 * Create new package with service role (bypasses RLS)
 * Used for migration operations
 */
export const createPackageServiceRole = async (packageData: Omit<Package, 'id' | 'updated_at' | 'version'>): Promise<Package> => {
  try {
    const db = getDbServiceRole();
    const cleanPackage = sanitizePackagePayload(packageData);

    const { data, error } = await db
      .from('packages')
      .insert({
        ...cleanPackage,
        _last_modified: new Date().toISOString(),
        _version: '1',
      })
      .select();

    if (error) throw error;
    return data?.[0] as Package;
  } catch (error) {
    console.error('Error creating package with service role:', error);
    throw error;
  }
};

/**
 * Upsert package with service role (bypasses RLS)
 * Used for migration operations to handle duplicates
 */
export const upsertPackageServiceRole = async (packageData: Omit<Package, 'id' | 'updated_at' | 'version'>): Promise<Package> => {
  try {
    const db = getDbServiceRole();
    const cleanPackage = sanitizePackagePayload(packageData);
    const { data, error } = await db
      .from('packages')
      .upsert({
        ...cleanPackage,
        _last_modified: new Date().toISOString(),
        _version: '1',
      }, {
        onConflict: 'ref_number',
      })
      .select()
      .single();

    if (error) throw error;
    return data as Package;
  } catch (error) {
    console.error('Error upserting package with service role:', error);
    throw error;
  }
};

/**
 * Upsert package by UUID primary key (id) with service role.
 * This is used to make local sync queue "create" operations idempotent.
 */
export const upsertPackageServiceRoleById = async (
  packageData: Omit<Package, 'updated_at' | 'version'> // allow incoming `id`
): Promise<Package> => {
  try {
    const db = getDbServiceRole();
    const cleanPackage = sanitizePackagePayload(packageData);

    const { data, error } = await db
      .from('packages')
      .upsert(
        {
          ...cleanPackage,
          _last_modified: new Date().toISOString(),
          _version: '1',
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .single();

    if (error) throw error;
    return data as Package;
  } catch (error) {
    console.error('Error upserting package by id with service role:', error);
    throw error;
  }
};

/**
 * Update package (RLS-protected)
 */
export const updatePackage = async (id: string, updates: Partial<Package>): Promise<Package> => {
  try {
    const db = getDb();
    const cleanUpdates = sanitizePackagePayload(updates);
    const { data, error } = await db
      .from('packages')
      .update({
        ...cleanUpdates,
        _last_modified: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '42501') {
        console.log(`ℹ️ [updatePackage] RLS select blocked with code 42501, but update succeeded.`);
        return { id, ...updates } as Package;
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error && error.code === '42501') {
      console.log(`ℹ️ [updatePackage] Caught RLS select block with code 42501, but update succeeded.`);
      return { id, ...updates } as Package;
    }
    console.error('Error updating package:', error);
    throw error;
  }
};

/**
 * Update package (service role, bypasses RLS)
 */
export const updatePackageServiceRole = async (
  id: string,
  updates: Partial<Package>
): Promise<Package | null> => {
  try {
    const db = getDbServiceRole();
    const cleanUpdates = sanitizePackagePayload(updates);

    // IMPORTANT: do not use `.single()` here.
    // In some cases Supabase returns 0 rows (PGRST116) and `.single()` throws,
    // which breaks the sync queue processing.
    const attemptUpdate = async (column: 'id' | 'ref_number') => {
      const { data, error } = await db
        .from('packages')
        .update({
          ...cleanUpdates,
          _last_modified: new Date().toISOString(),
        })
        .eq(column, id)
        .select();

      if (error) throw error;

      return (data && Array.isArray(data)) ? (data[0] as Package) : null;
    };

    // 1) Try by UUID primary key `id`
    const byId = await attemptUpdate('id');
    console.log('[updatePackageServiceRole] attempt by id result:', {
      id,
      byIdFound: !!byId,
    });
    if (byId) return byId;

    // 2) Fallback: some local queues might store `ref_number` (PKG-xxxxx) as `data.id`
    // so update by `ref_number` too.
    const byRef = await attemptUpdate('ref_number');
    console.log('[updatePackageServiceRole] attempt by ref_number result:', {
      id,
      byRefFound: !!byRef,
    });
    return byRef ?? null;
  } catch (error) {
    console.error('Error updating package (service role):', error);
    // Re-throw so callers can decide whether to stop the queue
    throw error;
  }
};

/**
 * Delete package (RLS-protected)
 */
export const deletePackage = async (id: string): Promise<void> => {
  try {
    const db = getDb();
    const { error } = await db
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting package:', error);
    throw error;
  }
};

/**
 * Delete package with service role (bypasses RLS)
 * Used for offline/no-user sync reconciliation
 */
export const deletePackageServiceRole = async (id: string): Promise<void> => {
  try {
    const db = getDbServiceRole();
    const { error } = await db
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting package (service role):', error);
    throw error;
  }
};

/**
 * Delete all packages with service role (bypasses RLS)
 * Used for migration cleanup
 */
export const deleteAllPackagesServiceRole = async (): Promise<void> => {
  try {
    const db = getDbServiceRole();
    const { error } = await db
      .from('packages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
    console.log('✅ All packages deleted from Supabase');
  } catch (error) {
    console.error('Error deleting all packages with service role:', error);
    throw error;
  }
};

/**
 * Delete all drivers with service role (bypasses RLS)
 * Used for migration cleanup
 */
export const deleteAllDriversServiceRole = async (): Promise<void> => {
  try {
    const db = getDbServiceRole();
    const { error } = await db
      .from('drivers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
    console.log('✅ All drivers deleted from Supabase');
  } catch (error) {
    console.error('Error deleting all drivers with service role:', error);
    throw error;
  }
};

// DRIVERS OPERATIONS

/**
 * Get all drivers
 */
export const getDrivers = async (): Promise<Driver[]> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const parsed = data || [];
    // Filter out SYSTEM_ADMIN_PIN record from active lists
    return parsed.filter(d => d.custom_id !== 'SYSTEM_ADMIN_PIN');
  } catch (error) {
    console.error('Error getting drivers:', error);
    throw error;
  }
};

/**
 * Get all drivers with service role (bypasses RLS)
 * Used for migration to check actual driver count
 */
export const getDriversServiceRole = async (): Promise<Driver[]> => {
  try {
    const db = getDbServiceRole();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting drivers with service role:', error);
    throw error;
  }
};

export const getDriversServiceRoleSince = async (sinceIso: string): Promise<Driver[]> => {
  try {
    const db = getDbServiceRole();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .gte('_last_modified', sinceIso)
      .order('_last_modified', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting drivers since timestamp:', error);
    throw error;
  }
};

/**
 * Get active drivers
 */
export const getActiveDrivers = async (): Promise<Driver[]> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting active drivers:', error);
    throw error;
  }
};

/**
 * Get driver by ID
 * Supports both UUID and custom_id (e.g., DRV-XXXXXX) formats
 */
export const getDriverById = async (id: string): Promise<Driver | null> => {
  try {
    const db = getDb();
    
    // Check if ID is a UUID or custom_id format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);
    
    console.log(`🔍 getDriverById: id=${id}, isUuid=${isUuid}`);
    
    let query;
    if (isUuid) {
      query = db.from('drivers').select('*').eq('id', id);
    } else {
      query = db.from('drivers').select('*').eq('custom_id', id);
    }
    
    const { data, error } = await query.single();

    if (error) {
      // Supabase: PGRST116 => "0 rows" when using .single()
      // Treat this as "not found" to avoid throwing and breaking UX.
      if (error.code === 'PGRST116') {
        // keep it visible in terminal, but not as an "error" that breaks flows
        console.log(`ℹ️ Driver not found for id=${id}`);
        return null;
      }

      console.error(`❌ Query failed:`, error);
      throw error;
    }
    
    console.log(`✅ Driver found:`, data);
    return data;
  } catch (error) {
    console.error('Error getting driver by ID:', error);
    throw error;
  }
};

/**
 * Get driver by phone
 */
export const getDriverByPhone = async (phone: string): Promise<Driver | null> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting driver by phone:', error);
    throw error;
  }
};

/**
 * Get driver by custom_id (e.g., DRV-XXXXXX)
 */
export const getDriverByCustomId = async (customId: string): Promise<Driver | null> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .eq('custom_id', customId)
      .single();

    if (error) {
      // Supabase: PGRST116 => "0 rows" when using .single()
      if (error.code === 'PGRST116') {
        console.log(`ℹ️ Driver not found for custom_id=${customId}`);
        return null;
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error getting driver by custom_id:', error);
    throw error;
  }
};

/**
 * Create new driver
 */
export const createDriver = async (driverData: Omit<Driver, 'id' | 'updated_at' | 'version'>): Promise<Driver> => {
  try {
    const db = getDb();
    
    // Generate custom_id if not provided
    const generateCustomId = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let result = 'DRV-';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Preserve the caller's local id (e.g. DRV-XXXXXX) as custom_id so that
    // the local record and the Supabase UUID row stay linked via custom_id.
    const raw = driverData as any;
    const custom_id = raw.custom_id || raw.id || generateCustomId();
    const version = typeof raw.version === 'number' && !isNaN(raw.version) ? raw.version : 1;

    // Strip local JS fields; Supabase auto-generates UUID 'id'
    const { id: _stripId, updated_at: _stripUa, version: _stripV, custom_id: _stripCid, ...safeData } = raw;
    
    // Use upsert by custom_id to prevent duplicate rows on retry
    const { data, error } = await db
      .from('drivers')
      .upsert(
        {
          ...safeData,
          custom_id,
          _last_modified: new Date().toISOString(),
          _version: String(version),
        },
        { onConflict: 'custom_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating driver:', error);
    throw error;
  }
};

/**
 * Create new driver with service role (bypasses RLS)
 * Used for migration operations and offline sync queue processing
 */
export const createDriverServiceRole = async (driverData: Omit<Driver, 'id' | 'updated_at' | 'version'>): Promise<Driver> => {
  try {
    const db = getDbServiceRole();
    
    // Generate custom_id if not provided
    const generateCustomId = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let result = 'DRV-';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Preserve the caller's local id (e.g. DRV-XXXXXX) as custom_id so that
    // the local record and the Supabase UUID row stay linked via custom_id.
    const raw = driverData as any;
    const custom_id = raw.custom_id || raw.id || generateCustomId();
    const version = typeof raw.version === 'number' && !isNaN(raw.version) ? raw.version : 1;

    // Strip local JS fields; Supabase auto-generates UUID 'id'
    const { id: _stripId, updated_at: _stripUa, version: _stripV, custom_id: _stripCid, ...safeData } = raw;
    
    // Use upsert by custom_id so that retried sync-queue 'create' ops
    // don't insert duplicate rows if the driver was already written.
    const { data, error } = await db
      .from('drivers')
      .upsert(
        {
          ...safeData,
          custom_id,
          _last_modified: new Date().toISOString(),
          _version: String(version),
        },
        { onConflict: 'custom_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating driver with service role:', error);
    throw error;
  }
};

/**
 * Upsert driver with service role (bypasses RLS)
 * Used for migration operations to handle duplicates
 */
export const upsertDriverServiceRole = async (driverData: Omit<Driver, 'id' | 'updated_at' | 'version'>): Promise<Driver> => {
  try {
    const db = getDbServiceRole();
    
    // Generate custom_id if not provided
    const generateCustomId = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let result = 'DRV-';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Preserve caller's local id as custom_id for ID linkage
    const raw = driverData as any;
    const custom_id = raw.custom_id || raw.id || generateCustomId();
    const version = typeof raw.version === 'number' && !isNaN(raw.version) ? raw.version : 1;

    // Strip local JS fields; Supabase auto-generates UUID 'id'
    const { id: _stripId, updated_at: _stripUa, version: _stripV, custom_id: _stripCid, ...safeData } = raw;
    
    const { data, error } = await db
      .from('drivers')
      .upsert(
        {
          ...safeData,
          custom_id,
          _last_modified: new Date().toISOString(),
          _version: String(version),
        },
        { onConflict: 'custom_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data as Driver;
  } catch (error) {
    console.error('Error upserting driver with service role:', error);
    throw error;
  }
};

/**
 * Update driver
 */
export const updateDriver = async (id: string, updates: Partial<Driver>): Promise<Driver> => {
  try {
    const db = getDb();
    const { updated_at: _ua, version: _v, id: _stripId, custom_id: _stripCustomId, ...safeUpdates } = updates as any;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);
    const column = isUuid ? 'id' : 'custom_id';
    
    const { data, error } = await db
      .from('drivers')
      .update({
        ...safeUpdates,
        _last_modified: new Date().toISOString(),
      })
      .eq(column, id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating driver:', error);
    throw error;
  }
};

/**
 * Update driver with service role (bypasses RLS)
 */
export const updateDriverServiceRole = async (id: string, updates: Partial<Driver>): Promise<Driver> => {
  try {
    const db = getDbServiceRole();
    const { updated_at: _ua, version: _v, id: _stripId, custom_id: _stripCustomId, ...safeUpdates } = updates as any;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);
    const column = isUuid ? 'id' : 'custom_id';
    
    // IMPORTANT: don't use .single() directly as it throws PGRST116 if no rows match.
    // We check if data exists first.
    const { data, error } = await db
      .from('drivers')
      .update({
        ...safeUpdates,
        _last_modified: new Date().toISOString(),
      })
      .eq(column, id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log(`ℹ️ updateDriverServiceRole: No driver matched id=${id}`);
      return updates as Driver; // Or handle as needed
    }
    return data[0] as Driver;
  } catch (error) {
    console.error('Error updating driver with service role:', error);
    throw error;
  }
};

/**
 * Delete driver
 */
export const deleteDriver = async (id: string): Promise<void> => {
  try {
    const db = getDb();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);
    const column = isUuid ? 'id' : 'custom_id';
    
    const { error } = await db
      .from('drivers')
      .delete()
      .eq(column, id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
};

/**
 * Delete driver with service role (bypasses RLS)
 */
export const deleteDriverServiceRole = async (id: string): Promise<void> => {
  try {
    const db = getDbServiceRole();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);
    const column = isUuid ? 'id' : 'custom_id';
    
    const { error } = await db
      .from('drivers')
      .delete()
      .eq(column, id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting driver with service role:', error);
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
 * Get package statistics
 */
export const getPackageStats = async () => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('packages')
      .select('status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      pending: data?.filter(p => p.status === 'Pending').length || 0,
      assigned: data?.filter(p => p.status === 'Assigned').length || 0,
      inTransit: data?.filter(p => p.status === 'In Transit').length || 0,
      delivered: data?.filter(p => p.status === 'Delivered').length || 0,
      returned: data?.filter(p => p.status === 'Returned').length || 0,
      archived: data?.filter(p => p.status === 'Archived').length || 0,
    };

    return stats;
  } catch (error) {
    console.error('Error getting package stats:', error);
    throw error;
  }
};

/**
 * Search packages by reference number or customer name
 */
export const searchPackages = async (query: string): Promise<Package[]> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('packages')
      .select('*')
      .or(`ref_number.ilike.%${query}%,customer_name.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching packages:', error);
    throw error;
  }
};

/**
 * Search drivers by name or phone
 */
export const searchDrivers = async (query: string): Promise<Driver[]> => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('drivers')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching drivers:', error);
    throw error;
  }
};
