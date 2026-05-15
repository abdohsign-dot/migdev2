/**
 * useLocalDatabase Hook
 * 
 * React hook for managing local database with Firestore sync
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Package, Driver } from '../types';
import {
  getPackagesLocally,
  getDriversLocally,
  updatePackage,
  processSyncQueue,
  getSyncQueue,
  getLastSyncTime,
  getPackageStats,
  upsertPackageLocally,
  deletePackageLocally,
  addToSyncQueue,
} from '../utils/localDatabase';
import { isPreStoredDriverId } from '../config/credentials';


interface UseLocalDatabaseOptions {
  driverId?: string;
  isAdmin?: boolean;
}

export const useLocalDatabase = (options: UseLocalDatabaseOptions = {}) => {
  const { driverId, isAdmin = false } = options;

  // NOTE: keep hook return object always defined.
  // Non-admin screens must be scoped to a driver; if driverId is missing, return no driver packages.
  // (Variable kept for readability; gating uses `!isAdmin && !driverId` checks below.)
  const shouldScopeToDriver = !isAdmin && !!driverId;

  const [packages, setPackages] = useState<Package[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Load data from local storage and sync from Firestore on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadLocalData();
      await checkSyncQueue();
      // Initial sync now handled by Supabase-only sync flows (RLS)
      setLoading(false);
    };
    init();
  }, []);

  // Real-time listener for package changes using Supabase
  useEffect(() => {
    try {
      const { listenToPackages, listenToDriverPackages, unsubscribe } = require('../utils/supabaseRealtime');
      
      let channel: any = null;

      const handleRealtimeUpdate = async (payload: any) => {
        try {
          console.log('🔄 Supabase real-time update:', payload.eventType, payload.new?.id || payload.old?.id);
          
          // Refresh packages:
          // 1) Pull latest from Supabase (RLS filters rows for drivers/admin)
          // 2) Re-scope and reload local cache so UI updates immediately (no need to toggle screens)
          const { syncPackagesFromSupabase } = require('../utils/supabaseSync');
          await syncPackagesFromSupabase(driverId || undefined);

          // Hard scope for non-admin drivers to avoid showing cached/unassigned packages.
          const updatedPackages = shouldScopeToDriver
            ? await getPackagesLocally(driverId, false)
            : await getPackagesLocally(driverId, true);

          setPackages(updatedPackages);
          
          // Update stats
          const stats = await getPackageStats(driverId);
          setPackageStats(stats);
          setLastUpdate(new Date().toISOString());
        } catch (error) {
          console.error('Error handling real-time update:', error);
        }
      };

      if (isAdmin) {
        // Admin listens to all packages
        channel = listenToPackages(handleRealtimeUpdate);
      } else if (driverId) {
        // Driver listens only to their assigned packages
        channel = listenToDriverPackages(driverId, handleRealtimeUpdate);
      } else {
        return; // No valid driverId or isAdmin
      }

      return () => {
        if (channel) {
          unsubscribe(channel);
        }
      };
    } catch (error) {
      console.error('Error setting up Supabase real-time listener:', error);
    }
  }, [driverId, isAdmin]);

  // Event-driven sync - no more periodic refreshes
  const [packageStats, setPackageStats] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  // Update stats when packages change (event-driven)
  useEffect(() => {
    (async () => {
      try {
        const stats = await getPackageStats(driverId);
        setPackageStats(stats);
        setLastUpdate(new Date().toISOString());
      } catch (error) {
        console.error('Error updating stats:', error);
      }
    })();
  }, [packages, driverId]); // Only update when packages actually change

  /**
   * Load data from local storage
   */
  const loadLocalData = async () => {
    try {
      setLoading(true);

      // Hard gate (Firestore only): non-admin without driverId should NOT sync "all packages".
      // But we still load local packages so QR-created drafts are visible for "Accepter Mission".
      // (Do NOT clear packages to preserve locally stored QR drafts.)
      if (!isAdmin && !driverId) {
        const localPackages = await getPackagesLocally(undefined, true); // includeArchived=true
        setPackages(localPackages);
        setDrivers(await getDriversLocally());
        setLastSync(await getLastSyncTime());
        return;
      }

      const [localPackages, localDrivers, syncTime] = await Promise.all([
        getPackagesLocally(driverId, isAdmin), // Admin gets all packages including archived
        getDriversLocally(),
        getLastSyncTime(),
      ]);

      // Hard gate: if non-admin and driverId exists, never keep unscoped packages in state.
      // This prevents old cached/offline packages from "leaking" into the driver screen.
      const scopedPackages = shouldScopeToDriver
        ? await getPackagesLocally(driverId, false)
        : localPackages;

      setPackages(scopedPackages);
      setDrivers(localDrivers);
      setLastSync(syncTime);
    } catch (error) {
      console.error('Error loading local data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check sync queue status
   */
  const checkSyncQueue = async () => {
    try {
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
    } catch (error) {
      console.error('Error checking sync queue:', error);
    }
  };

  /**
   * Supabase sync is handled by supabaseSync utilities (processSyncQueue / performFullSync).
   * Keeping this hook Firestore-free to avoid crashing when @react-native-firebase isn't installed.
   */
  const syncWithFirestore = async () => {
    // no-op (Firestore removed)
    return;
  };

  /**
   * Local-first package status update with immediate sync of changes only
   */
  const updatePackageStatus = async (
    packageId: string,
    status: Package['status'],
    additionalData?: Partial<Package>
  ) => {
    try {
      const updates: Partial<Package> = {
        status,
        ...additionalData,
        _last_modified: new Date().toISOString(),
      };

      // Add timestamp for status changes
      if (status === 'In Transit' && !additionalData?.accepted_at) {
        updates.accepted_at = new Date().toISOString();
      } else if (status === 'Delivered' && !additionalData?.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }

      // Update locally first (always works)
      const localPkgs = await getPackagesLocally(undefined, true);
      const pkgIndex = localPkgs.findIndex(p => p.id === packageId);
      
      if (pkgIndex >= 0) {
        const updatedPkg = { 
          ...localPkgs[pkgIndex], 
          ...updates,
          _last_modified: new Date().toISOString(),
        };
        
        // Save to local storage immediately
        await upsertPackageLocally(updatedPkg);
        
        // Update local state for instant UI update
        setPackages(prev => prev.map(pkg => 
          pkg.id === packageId ? updatedPkg : pkg
        ));
      }

      // Skip Firebase sync for pre-stored driver IDs
      const isPreStored = driverId ? isPreStoredDriverId(driverId) : false;
      
      // Supabase-only: queue the change; sync will be processed by processSyncQueue/performFullSync.
      if (!isPreStored) {
        await addToSyncQueue({
          id: `sync_${Date.now()}`,
          type: 'update',
          collection: 'packages',
          data: { id: packageId, updates },
          timestamp: new Date().toISOString(),
          synced: false
        });
        console.log(`📝 Package ${packageId} queued for Supabase sync`);
      } else {
        console.log(`🔒 Package ${packageId} updated locally only (pre-stored driver: ${driverId})`);
      }

    } catch (error) {
      console.error('Error updating package status:', error);
      throw error;
    }
  };

  /**
   * Local-first package assignment with immediate sync of assignments only
   */
  const assignPackageToDriver = async (packageIds: string[], targetDriverId: string) => {
    try {
      const timestamp = new Date().toISOString();
      
      // Update all packages locally first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        
        if (pkgIndex >= 0) {
          const updates = {
            status: 'Assigned' as const,
            assigned_to: targetDriverId,
            assigned_at: timestamp,
            _last_modified: new Date().toISOString(),
          };
          
          const updatedPkg = { ...localPkgs[pkgIndex], ...updates };
          await upsertPackageLocally(updatedPkg);
          
          // Update local state
          setPackages(prev => prev.map(pkg => 
            pkg.id === pkgId ? updatedPkg : pkg
          ));
        }
      }

      // Supabase-only: queue all assignments; sync will be processed by queue processor.
      console.log(`📝 ${packageIds.length} packages assigned locally; queued for Supabase sync`);
      for (const pkgId of packageIds) {
        await addToSyncQueue({
          id: `sync_${Date.now()}_${pkgId}`,
          type: 'update',
          collection: 'packages',
          data: {
            id: pkgId,
            updates: {
              status: 'Assigned',
              assigned_to: targetDriverId,
              assigned_at: timestamp,
              _last_modified: timestamp
            }
          },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
    } catch (error) {
      console.error('Error assigning packages:', error);
      throw error;
    }
  };

  /**
   * Local-first deassign: move packages back to Pending and clear assignment fields.
   */
  const deassignPackages = async (packageIds: string[]) => {
    try {
      const timestamp = new Date().toISOString();

      // Update all packages locally first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);

        if (pkgIndex >= 0) {
          const updates = {
            status: 'Pending' as const,
            // Package type expects string | undefined (not null)
            assigned_to: undefined,
            assigned_at: undefined,
            _last_modified: new Date().toISOString(),
          };

          const updatedPkg = { ...localPkgs[pkgIndex], ...updates };
          await upsertPackageLocally(updatedPkg);

          setPackages(prev => prev.map(pkg =>
            pkg.id === pkgId ? updatedPkg : pkg
          ));
        }
      }

      // Queue deassign updates for Supabase sync
      console.log(`📝 ${packageIds.length} packages deassigned locally; queued for Supabase sync`);
      for (const pkgId of packageIds) {
        await addToSyncQueue({
          id: `sync_deassign_${Date.now()}_${pkgId}`,
          type: 'update',
          collection: 'packages',
          data: {
            id: pkgId,
            updates: {
              status: 'Pending',
              // DB column can be null, but TS Package type may not allow null
              assigned_to: null as any,
              assigned_at: null as any,
              _last_modified: timestamp
            }
          },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
    } catch (error) {
      console.error('Error deassigning packages:', error);
      throw error;
    }
  };

  /**
   * Get filtered packages for admin dashboard
   */
  const getFilteredPackages = useCallback((filters: {
    status?: string;
    driverId?: string;
    dateRange?: 'today' | 'week' | 'month' | 'all';
    searchQuery?: string;
  }) => {
    let filtered = [...packages];

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(pkg => pkg.status === filters.status);
    }

    // Driver filter
    if (filters.driverId && filters.driverId !== 'all') {
      filtered = filtered.filter(pkg => pkg.assigned_to === filters.driverId);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(pkg => {
        if (!pkg.limit_date) return false;
        const pkgDate = new Date(pkg.limit_date);
        
        switch (filters.dateRange) {
          case 'today':
            return pkgDate.toDateString() === today.toDateString();
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return pkgDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return pkgDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(pkg => 
        pkg.ref_number?.toLowerCase().includes(query) ||
        pkg.customer_name?.toLowerCase().includes(query) ||
        pkg.customer_address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [packages]);

  /**
   * Manual refresh data (pull from Firestore) - only when explicitly requested
   */
  const refresh = useCallback(async () => {
    console.log('🔄 Manual refresh requested');
    await syncWithFirestore();
    // Reload local data after sync to get updated drivers/packages
    await loadLocalData();
  }, [driverId, isAdmin]);

  /**
   * Reload local data without syncing with Firestore
   */
  const reloadLocalData = useCallback(async () => {
    console.log('🔄 Reloading local data only');
    await loadLocalData();
  }, [driverId, isAdmin]);

  /**
   * Update a package in local state immediately (for instant UI updates)
   */
  const updatePackageInState = useCallback((updatedPkg: Package) => {
    setPackages(prev => prev.map(pkg => 
      pkg.id === updatedPkg.id ? updatedPkg : pkg
    ));
  }, []);

  /**
   * Add a new package to local state immediately
   */
  const addPackageToState = useCallback((newPkg: Package) => {
    setPackages(prev => [...prev, newPkg]);
  }, []);

  /**
   * Process sync queue periodically (every 2 minutes) for failed operations
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await processSyncQueue();
        console.log('🔄 Sync queue processed');
      } catch (error) {
        console.error('Error in periodic sync queue processing:', error);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, []);

  const archivePackages = async (packageIds: string[]) => {
    try {
      const timestamp = new Date().toISOString();

      // Local update first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        if (pkgIndex >= 0) {
          const updatedPkg = {
            ...localPkgs[pkgIndex],
            is_archived: true,
            status: 'Archived' as const,
            archived_at: timestamp,
            _last_modified: new Date().toISOString(),
          };
          await upsertPackageLocally(updatedPkg);
          setPackages(prev => prev.map(p => (p.id === pkgId ? updatedPkg : p)));
        }
      }

      // Supabase-only: queue archive updates
      for (const pkgId of packageIds) {
        await addToSyncQueue({
          id: `sync_${Date.now()}_${pkgId}`,
          type: 'update',
          collection: 'packages',
          data: {
            id: pkgId,
            updates: {
              is_archived: true,
              status: 'Archived',
              archived_at: timestamp,
              _last_modified: new Date().toISOString(),
            }
          },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
    } catch (error) {
      console.error('Error archiving packages:', error);
      throw error;
    }
  };

  const unarchivePackages = async (packageIds: string[]) => {
    try {
      const timestamp = new Date().toISOString();

      // Local update first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        if (pkgIndex >= 0) {
          const updatedPkg = {
            ...localPkgs[pkgIndex],
            is_archived: false,
            status: 'Pending' as const,
            archived_at: undefined,
            _last_modified: new Date().toISOString(),
          };
          await upsertPackageLocally(updatedPkg);
          setPackages(prev => prev.map(p => (p.id === pkgId ? updatedPkg : p)));
        }
      }

      // Supabase-only: queue unarchive updates
      for (const pkgId of packageIds) {
        await addToSyncQueue({
          id: `sync_${Date.now()}_${pkgId}`,
          type: 'update',
          collection: 'packages',
          data: {
            id: pkgId,
            updates: {
              is_archived: false,
              status: 'Pending',
              archived_at: null,
              _last_modified: new Date().toISOString(),
            }
          },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
    } catch (error) {
      console.error('Error unarchiving packages:', error);
      throw error;
    }
  };

  const deletePackages = async (packageIds: string[]) => {
    try {
      // Check if all packages are archived
      const packagesToDelete = packages.filter(p => packageIds.includes(p.id));
      const unarchivedPackages = packagesToDelete.filter(p => !p.is_archived && !p.archived_at);
      
      if (unarchivedPackages.length > 0) {
        const names = unarchivedPackages.map(p => p.ref_number).join(', ');
        throw new Error(`Les colis suivants ne sont pas archivés et ne peuvent pas être supprimés: ${names}. Veuillez d'abord les archiver.`);
      }

      // Delete locally first
      for (const pkgId of packageIds) {
        await deletePackageLocally(pkgId);
        setPackages(prev => prev.filter(p => p.id !== pkgId));
      }

      // Try immediate Supabase deletion
      try {
        const { deletePackage: supabaseDeletePackage } = require('./supabaseDatabase');
        
        for (const pkgId of packageIds) {
          await supabaseDeletePackage(pkgId);
        }
        console.log(`🗑️ Deleted ${packageIds.length} packages from Supabase`);
      } catch (syncError) {
        // Queue offline deletion
        for (const pkgId of packageIds) {
          await addToSyncQueue({
            id: `delete_${Date.now()}_${pkgId}`,
            type: 'delete',
            collection: 'packages',
            data: {
              id: pkgId,
            },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
        console.log(`⚠️ Queued ${packageIds.length} packages for deletion`);
      }
    } catch (error) {
      console.error('Error deleting packages:', error);
      throw error;
    }
  };

  return {
    packages,
    drivers,
    loading,
    syncing,
    lastSync,
    pendingSyncCount,
    isOnline,
    connectionError,
    refresh,
    reloadLocalData,
    updatePackageInState,
    addPackageToState,
    updatePackageStatus,
    assignPackageToDriver,
    archivePackages,
    unarchivePackages,
    deletePackages,
    getFilteredPackages,
    packageStats,
  };
};
