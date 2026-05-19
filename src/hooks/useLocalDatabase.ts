/**
 * useLocalDatabase Hook
 * 
 * React hook for managing local database with Firestore sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Package, Driver } from '../types';
import useAdminStore from '../store/useAdminStore';
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
  LOCAL_PACKAGES_UI_LIMIT,
} from '../utils/localDatabase';
import { registerRemotePoll } from '../utils/remotePollSync';
import { listenToPackages, listenToDriverPackages, listenToDrivers, createPackageUpdateHandler, createDriverUpdateHandler } from '../utils/supabaseRealtime';
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

  const setAdminPackages = useAdminStore((state) => state.setPackages);
  const setAdminDrivers = useAdminStore((state) => state.setDrivers);
  const setAdminLoading = useAdminStore((state) => state.setLoading);
  const setAdminSyncing = useAdminStore((state) => state.setSyncing);
  const setAdminLastSync = useAdminStore((state) => state.setLastSync);

  // Load data from local storage on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadLocalData();
      await checkSyncQueue();
      setLoading(false);

      // Trigger automatic background synchronization on mount to fetch assigned packages
      try {
        console.log('🔄 Triggering auto-sync on mount for driver:', driverId);
        const { performFullSync } = require('../utils/supabaseSync');
        await performFullSync(driverId);
        // Reload local data once sync is completed successfully
        await loadLocalData();
      } catch (syncError) {
        console.log('ℹ️ Auto-sync on mount skipped or failed (likely offline):', syncError);
      }
    };
    init();
  }, [driverId, isAdmin]);

  /**
   * Check sync queue status
   */
  const checkSyncQueue = useCallback(async () => {
    try {
      const queue = await getSyncQueue(driverId);
      setPendingSyncCount(queue.length);
    } catch (error) {
      console.error('Error checking sync queue:', error);
    }
  }, [driverId]);

  // Foreground polling: role-scoped pull (admin partition vs driver partition).
  const reloadPackagesFromLocal = useCallback(async () => {
    try {
      const updatedPackages = shouldScopeToDriver
        ? await getPackagesLocally(driverId, false, LOCAL_PACKAGES_UI_LIMIT)
        : await getPackagesLocally(isAdmin ? undefined : driverId, isAdmin, LOCAL_PACKAGES_UI_LIMIT);

      setPackages(updatedPackages);
      if (isAdmin) {
        setDrivers(await getDriversLocally());
      }
      setLastSync(await getLastSyncTime(driverId));
      const stats = await getPackageStats(driverId);
      setPackageStats(stats);
      setLastUpdate(new Date().toISOString());
      await checkSyncQueue();
    } catch (error) {
      console.error('Error reloading packages after remote poll:', error);
    }
  }, [driverId, isAdmin, shouldScopeToDriver, checkSyncQueue]);

  const pollSubscriberIdRef = useRef(
    `${isAdmin ? 'admin' : 'deliverer'}:${driverId ?? 'none'}:${Math.random().toString(36).slice(2, 9)}`
  );

  useEffect(() => {
    if (!isAdmin && !driverId) return;

    const role = isAdmin ? 'admin' : 'deliverer';
    return registerRemotePoll({
      id: pollSubscriberIdRef.current,
      role,
      driverId: isAdmin ? undefined : driverId,
      onSynced: reloadPackagesFromLocal,
    });
  }, [driverId, isAdmin, reloadPackagesFromLocal]);

  // Realtime subscriptions for instant updates (bypassing the 30s poll interval)
  useEffect(() => {
    if (!isAdmin && !driverId) return;

    const handlePackageChange = async (pkg: Package, isDelete = false) => {
      try {
        if (isDelete) {
          await deletePackageLocally(pkg.id);
        } else {
          await upsertPackageLocally(pkg);
        }
        await reloadPackagesFromLocal();
      } catch (e) {
        console.error('Realtime package handling error:', e);
      }
    };

    const packageHandler = createPackageUpdateHandler(
      (newPkg) => handlePackageChange(newPkg),
      (updatedPkg) => handlePackageChange(updatedPkg),
      (oldPkg) => handlePackageChange(oldPkg, true)
    );

    const driverHandler = createDriverUpdateHandler(
      () => reloadPackagesFromLocal(),
      () => reloadPackagesFromLocal(),
      () => reloadPackagesFromLocal()
    );

    let pkgChannel: any;
    let driverChannel: any;

    if (isAdmin) {
      pkgChannel = listenToPackages(packageHandler);
      driverChannel = listenToDrivers(driverHandler);
    } else {
      pkgChannel = listenToDriverPackages(driverId, packageHandler);
    }

    return () => {
      if (pkgChannel) pkgChannel.unsubscribe();
      if (driverChannel) driverChannel.unsubscribe();
    };
  }, [driverId, isAdmin, reloadPackagesFromLocal]);

  useEffect(() => {
    if (!isAdmin) return;
    setAdminPackages(packages);
  }, [packages, isAdmin, setAdminPackages]);

  useEffect(() => {
    if (!isAdmin) return;
    setAdminDrivers(drivers);
  }, [drivers, isAdmin, setAdminDrivers]);

  useEffect(() => {
    if (!isAdmin) return;
    setAdminLoading(loading);
  }, [loading, isAdmin, setAdminLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    setAdminSyncing(syncing);
  }, [syncing, isAdmin, setAdminSyncing]);

  useEffect(() => {
    if (!isAdmin) return;
    setAdminLastSync(lastSync);
  }, [lastSync, isAdmin, setAdminLastSync]);

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
        const localPackages = await getPackagesLocally(undefined, true, LOCAL_PACKAGES_UI_LIMIT);
        setPackages(localPackages);
        setDrivers(await getDriversLocally());
        setLastSync(await getLastSyncTime(driverId));
        return;
      }

      const [localPackages, localDrivers, syncTime] = await Promise.all([
        getPackagesLocally(driverId, isAdmin, LOCAL_PACKAGES_UI_LIMIT),
        getDriversLocally(),
        getLastSyncTime(driverId),
      ]);

      // Hard gate: if non-admin and driverId exists, never keep unscoped packages in state.
      // This prevents old cached/offline packages from "leaking" into the driver screen.
      const scopedPackages = shouldScopeToDriver
        ? await getPackagesLocally(driverId, false, LOCAL_PACKAGES_UI_LIMIT)
        : localPackages;

      setPackages(scopedPackages);
      if (isAdmin) {
        setDrivers(localDrivers);
      }
      setLastSync(syncTime);
    } catch (error) {
      console.error('Error loading local data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sync with Supabase using performFullSync utility
   */
  const syncWithSupabase = async () => {
    try {
      const { performFullSync } = require('../utils/supabaseSync');
      setSyncing(true);
      await performFullSync(driverId);
      setSyncing(false);
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
      setSyncing(false);
      throw error;
    }
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

      // Update locally first (always works).
      // Use in-memory `packages` state to avoid deserializing ALL packages
      // from AsyncStorage on every status update (avoids heavy IO + races).
      const existingPkg = packages.find(p => p.id === packageId);

      if (existingPkg) {
        const updatedPkg: Package = {
          ...existingPkg,
          ...updates,
          _last_modified: new Date().toISOString(),
        } as Package;

        // Persist the single-package change using the targeted upsert helper
        await upsertPackageLocally(updatedPkg);

        // Update local state for instant UI update
        setPackages(prev => prev.map(pkg => pkg.id === packageId ? updatedPkg : pkg));
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
        }, driverId);
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
      
      // Read all packages ONCE before the loop (not once per package)
      const localPkgs = await getPackagesLocally(undefined, true);

      // Update all packages locally first
      for (const pkgId of packageIds) {
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        
        if (pkgIndex >= 0) {
          const updates = {
            status: 'Assigned' as const,
            assigned_to: targetDriverId,
            assigned_at: timestamp,
            hidden_by_driver: false,
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
        }, driverId);
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
        }, driverId);
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
   * Manual refresh data (pull from Supabase) - only when explicitly requested
   */
  const refresh = useCallback(async () => {
    console.log('🔄 Manual refresh requested');
    await syncWithSupabase();
    // Reload local data after sync to get updated drivers/packages
    await loadLocalData();
  }, [driverId, isAdmin]);

  /**
   * Reload local data without syncing with Supabase
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
        }, driverId);
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
        }, driverId);
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
          }, driverId);
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
