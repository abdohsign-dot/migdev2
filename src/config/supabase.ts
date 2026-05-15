/**
 * Supabase Configuration Constants
 * Centralized configuration for Supabase migration
 */

export const SUPABASE_CONFIG = {
  // Table names
  TABLES: {
    PACKAGES: 'packages',
    DRIVERS: 'drivers',
    PROFILES: 'profiles',
    SYNC_OPERATIONS: 'sync_operations',
    SYNC_METADATA: 'sync_metadata',
  },

  // Package statuses
  PACKAGE_STATUSES: {
    PENDING: 'Pending',
    ASSIGNED: 'Assigned',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    RETURNED: 'Returned',
    ARCHIVED: 'Archived',
  },

  // User roles
  USER_ROLES: {
    ADMIN: 'admin',
    DRIVER: 'driver',
  },

  // Sync operation types
  SYNC_TYPES: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
  },

  // Real-time channel names
  CHANNELS: {
    PACKAGES: 'packages-changes',
    DRIVERS: 'drivers-changes',
    DRIVER_PACKAGES: (driverId: string) => `driver-packages-${driverId}`,
    SYNC_OPERATIONS: (userId: string) => `sync-operations-${userId}`,
    ACTIVE_DRIVERS: 'active-drivers-changes',
    PACKAGE_STATUS: 'package-status-changes',
  },

  // Storage keys (for backward compatibility)
  STORAGE_KEYS: {
    PACKAGES: '@delivry:packages',
    DRIVERS: '@delivry:drivers',
    SYNC_QUEUE: '@delivry:syncQueue',
    LAST_SYNC: '@delivry:lastSync',
  },

  // Default pagination
  PAGINATION: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
  },
};

// Migration status tracking
export const MIGRATION_STATUS = {
  FIRESTORE_ONLY: 'firestore_only',
  SUPABASE_ONLY: 'supabase_only',
  HYBRID: 'hybrid', // Both active during migration
};

// Feature flags for gradual migration
export const FEATURE_FLAGS = {
  USE_SUPABASE_AUTH: process.env.EXPO_PUBLIC_USE_SUPABASE_AUTH === 'true',
  USE_SUPABASE_DATABASE: process.env.EXPO_PUBLIC_USE_SUPABASE_DATABASE === 'true',
  USE_SUPABASE_REALTIME: process.env.EXPO_PUBLIC_USE_SUPABASE_REALTIME === 'true',
  USE_SUPABASE_SYNC: process.env.EXPO_PUBLIC_USE_SUPABASE_SYNC === 'true',
};
