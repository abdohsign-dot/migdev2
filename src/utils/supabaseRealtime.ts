/**
 * Supabase Real-time utilities
 * Replaces Firestore real-time listeners with Supabase subscriptions
 * Includes backpressure handling to prevent UI overwhelm
 */

import { getDb } from '../supabase/config';
import { Package, Driver } from '../types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { CombinedBackpressureHandler, BackpressureConfig } from './realtimeBackpressure';

// Subscription management
const activeSubscriptions = new Map<string, RealtimeChannel>();

// Backpressure handlers for each subscription type
const backpressureHandlers = new Map<string, CombinedBackpressureHandler<any>>();

/**
 * Default backpressure configuration
 */
const DEFAULT_BACKPRESSURE_CONFIG: BackpressureConfig = {
  maxUpdatesPerSecond: 10,  // Max 10 updates per second
  batchSize: 5,              // Batch 5 updates together
  debounceMs: 100,           // Wait 100ms for more updates
  queueSize: 100,            // Max 100 items in queue
};

// PACKAGES REAL-TIME LISTENERS

/**
 * Listen to all packages changes with backpressure handling
 */
export const listenToPackages = (
  callback: (payload: RealtimePostgresChangesPayload<Package>) => void,
  backpressureConfig: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): RealtimeChannel => {
  const db = getDb();
  const channelName = 'packages-changes';
  
  // Remove existing subscription if any
  if (activeSubscriptions.has(channelName)) {
    activeSubscriptions.get(channelName)?.unsubscribe();
  }

  // Create backpressure handler
  const handler = new CombinedBackpressureHandler(
    (payloads: RealtimePostgresChangesPayload<Package>[]) => {
      payloads.forEach(payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in packages callback:', error);
        }
      });
    },
    backpressureConfig
  );

  backpressureHandlers.set(channelName, handler);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'packages',
      },
      (payload: RealtimePostgresChangesPayload<Package>) => {
        handler.handle(payload);
      }
    )
    .subscribe();

  activeSubscriptions.set(channelName, channel);
  console.log(`📡 Listening to packages with backpressure (max ${backpressureConfig.maxUpdatesPerSecond}/sec)`);
  return channel;
};

/**
 * Listen to packages for a specific driver with backpressure handling
 */
export const listenToDriverPackages = (
  driverId: string,
  callback: (payload: RealtimePostgresChangesPayload<Package>) => void,
  backpressureConfig: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): RealtimeChannel => {
  const db = getDb();
  const channelName = `driver-packages-${driverId}`;
  
  // Remove existing subscription if any
  if (activeSubscriptions.has(channelName)) {
    activeSubscriptions.get(channelName)?.unsubscribe();
  }

  // Create backpressure handler
  const handler = new CombinedBackpressureHandler(
    (payloads: RealtimePostgresChangesPayload<Package>[]) => {
      payloads.forEach(payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in driver packages callback:', error);
        }
      });
    },
    backpressureConfig
  );

  backpressureHandlers.set(channelName, handler);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'packages',
        filter: `assigned_to=eq.${driverId}`,
      },
      (payload: RealtimePostgresChangesPayload<Package>) => {
        handler.handle(payload);
      }
    )
    .subscribe();

  activeSubscriptions.set(channelName, channel);
  console.log(`📡 Listening to driver ${driverId} packages with backpressure`);
  return channel;
};

/**
 * Listen to package status changes with backpressure handling
 */
export const listenToPackageStatusChanges = (
  callback: (payload: RealtimePostgresChangesPayload<Package>) => void,
  backpressureConfig: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): RealtimeChannel => {
  const db = getDb();
  const channelName = 'package-status-changes';
  
  // Remove existing subscription if any
  if (activeSubscriptions.has(channelName)) {
    activeSubscriptions.get(channelName)?.unsubscribe();
  }

  // Create backpressure handler
  const handler = new CombinedBackpressureHandler(
    (payloads: RealtimePostgresChangesPayload<Package>[]) => {
      payloads.forEach(payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in status changes callback:', error);
        }
      });
    },
    backpressureConfig
  );

  backpressureHandlers.set(channelName, handler);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'packages',
      },
      (payload: RealtimePostgresChangesPayload<Package>) => {
        handler.handle(payload);
      }
    )
    .subscribe();

  activeSubscriptions.set(channelName, channel);
  console.log(`📡 Listening to package status changes with backpressure`);
  return channel;
};

// DRIVERS REAL-TIME LISTENERS

/**
 * Listen to all drivers changes with backpressure handling
 */
export const listenToDrivers = (
  callback: (payload: RealtimePostgresChangesPayload<Driver>) => void,
  backpressureConfig: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): RealtimeChannel => {
  const db = getDb();
  const channelName = 'drivers-changes';
  
  // Remove existing subscription if any
  if (activeSubscriptions.has(channelName)) {
    activeSubscriptions.get(channelName)?.unsubscribe();
  }

  // Create backpressure handler
  const handler = new CombinedBackpressureHandler(
    (payloads: RealtimePostgresChangesPayload<Driver>[]) => {
      payloads.forEach(payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in drivers callback:', error);
        }
      });
    },
    backpressureConfig
  );

  backpressureHandlers.set(channelName, handler);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'drivers',
      },
      (payload: RealtimePostgresChangesPayload<Driver>) => {
        handler.handle(payload);
      }
    )
    .subscribe();

  activeSubscriptions.set(channelName, channel);
  console.log(`📡 Listening to drivers with backpressure`);
  return channel;
};

/**
 * Listen to active drivers changes with backpressure handling
 */
export const listenToActiveDrivers = (
  callback: (payload: RealtimePostgresChangesPayload<Driver>) => void,
  backpressureConfig: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): RealtimeChannel => {
  const db = getDb();
  const channelName = 'active-drivers-changes';
  
  // Remove existing subscription if any
  if (activeSubscriptions.has(channelName)) {
    activeSubscriptions.get(channelName)?.unsubscribe();
  }

  // Create backpressure handler
  const handler = new CombinedBackpressureHandler(
    (payloads: RealtimePostgresChangesPayload<Driver>[]) => {
      payloads.forEach(payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in active drivers callback:', error);
        }
      });
    },
    backpressureConfig
  );

  backpressureHandlers.set(channelName, handler);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'drivers',
        filter: 'is_active=eq.true',
      },
      (payload: RealtimePostgresChangesPayload<Driver>) => {
        handler.handle(payload);
      }
    )
    .subscribe();

  activeSubscriptions.set(channelName, channel);
  console.log(`📡 Listening to active drivers with backpressure`);
  return channel;
};

// SYNC OPERATIONS REAL-TIME LISTENERS

/**
 * Listen to sync operations for a user with backpressure handling
 */
export const listenToSyncOperations = (
  userId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  backpressureConfig: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): RealtimeChannel => {
  const db = getDb();
  const channelName = `sync-operations-${userId}`;
  
  // Remove existing subscription if any
  if (activeSubscriptions.has(channelName)) {
    activeSubscriptions.get(channelName)?.unsubscribe();
  }

  // Create backpressure handler
  const handler = new CombinedBackpressureHandler(
    (payloads: RealtimePostgresChangesPayload<any>[]) => {
      payloads.forEach(payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in sync operations callback:', error);
        }
      });
    },
    backpressureConfig
  );

  backpressureHandlers.set(channelName, handler);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sync_operations',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        handler.handle(payload);
      }
    )
    .subscribe();

  activeSubscriptions.set(channelName, channel);
  console.log(`📡 Listening to sync operations for user ${userId} with backpressure`);
  return channel;
};

// UTILITY FUNCTIONS

/**
 * Unsubscribe from a specific channel
 */
export const unsubscribe = (channel: RealtimeChannel | string): void => {
  const channelToUnsubscribe = typeof channel === 'string' 
    ? activeSubscriptions.get(channel)
    : channel;

  if (channelToUnsubscribe) {
    channelToUnsubscribe.unsubscribe();
    
    // Remove from active subscriptions
    const channelName = typeof channel === 'string' ? channel : channelToUnsubscribe.topic;
    activeSubscriptions.delete(channelName);
    
    // Flush and remove backpressure handler
    const handler = backpressureHandlers.get(channelName);
    if (handler) {
      handler.flush();
      backpressureHandlers.delete(channelName);
    }
  }
};

/**
 * Unsubscribe from all active subscriptions
 */
export const unsubscribeAll = (): void => {
  activeSubscriptions.forEach((channel) => {
    channel.unsubscribe();
  });
  activeSubscriptions.clear();
  
  // Flush all backpressure handlers
  backpressureHandlers.forEach((handler) => {
    handler.flush();
  });
  backpressureHandlers.clear();
};

/**
 * Get active subscription count
 */
export const getActiveSubscriptionCount = (): number => {
  return activeSubscriptions.size;
};

/**
 * Check if a subscription is active
 */
export const isSubscriptionActive = (channelName: string): boolean => {
  return activeSubscriptions.has(channelName);
};

/**
 * Get backpressure statistics for a channel
 */
export const getBackpressureStats = (channelName: string) => {
  const handler = backpressureHandlers.get(channelName);
  if (!handler) {
    return null;
  }
  return handler.getStats();
};

/**
 * Get all backpressure statistics
 */
export const getAllBackpressureStats = () => {
  const stats: Record<string, any> = {};
  backpressureHandlers.forEach((handler, channelName) => {
    stats[channelName] = handler.getStats();
  });
  return stats;
};

/**
 * Flush pending updates for a channel
 */
export const flushBackpressure = (channelName: string): void => {
  const handler = backpressureHandlers.get(channelName);
  if (handler) {
    handler.flush();
    console.log(`✅ Flushed backpressure for ${channelName}`);
  }
};

/**
 * Flush all pending updates
 */
export const flushAllBackpressure = (): void => {
  backpressureHandlers.forEach((handler) => {
    handler.flush();
  });
  console.log(`✅ Flushed all backpressure handlers`);
};

// HELPER FUNCTIONS FOR COMMON PATTERNS

/**
 * Helper to handle package updates in UI
 */
export const createPackageUpdateHandler = (
  onInsert?: (pkg: Package) => void,
  onUpdate?: (pkg: Package) => void,
  onDelete?: (oldPkg: Package) => void
) => {
  return (payload: RealtimePostgresChangesPayload<Package>) => {
    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new && payload.new.id) onInsert?.(payload.new as Package);
        break;
      case 'UPDATE':
        if (payload.new && payload.new.id) onUpdate?.(payload.new as Package);
        break;
      case 'DELETE':
        if (payload.old && payload.old.id) onDelete?.(payload.old as Package);
        break;
    }
  };
};

/**
 * Helper to handle driver updates in UI
 */
export const createDriverUpdateHandler = (
  onInsert?: (driver: Driver) => void,
  onUpdate?: (driver: Driver) => void,
  onDelete?: (oldDriver: Driver) => void
) => {
  return (payload: RealtimePostgresChangesPayload<Driver>) => {
    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new && payload.new.id) onInsert?.(payload.new as Driver);
        break;
      case 'UPDATE':
        if (payload.new && payload.new.id) onUpdate?.(payload.new as Driver);
        break;
      case 'DELETE':
        if (payload.old && payload.old.id) onDelete?.(payload.old as Driver);
        break;
    }
  };
};

/**
 * React hook for real-time packages (to be used with React hooks)
 */
export const useRealtimePackages = (
  callback: (payload: RealtimePostgresChangesPayload<Package>) => void,
  deps: any[] = []
) => {
  // This would typically be used in a React hook
  // The actual React hook implementation would be in a separate hooks file
  return {
    subscribe: () => listenToPackages(callback),
    unsubscribe: () => unsubscribe('packages-changes'),
  };
};

/**
 * React hook for real-time driver packages (to be used with React hooks)
 */
export const useRealtimeDriverPackages = (
  driverId: string,
  callback: (payload: RealtimePostgresChangesPayload<Package>) => void,
  deps: any[] = []
) => {
  // This would typically be used in a React hook
  // The actual React hook implementation would be in a separate hooks file
  return {
    subscribe: () => listenToDriverPackages(driverId, callback),
    unsubscribe: () => unsubscribe(`driver-packages-${driverId}`),
  };
};
