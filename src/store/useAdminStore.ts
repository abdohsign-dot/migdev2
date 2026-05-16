import { create } from 'zustand';
import type { Driver, Package, OperationContext } from '../types';

interface AdminState {
  drivers: Driver[];
  packages: Package[];
  zones: string[];
  loading: boolean;
  syncing: boolean;
  lastSync: string | null;
  setDrivers: (drivers: Driver[]) => void;
  setPackages: (packages: Package[]) => void;
  setZones: (zones: string[]) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSync: (timestamp: string | null) => void;
  clearAdminState: () => void;
  updateDriver: (id: string, changes: Partial<Driver>, context: OperationContext) => void;
  addPackage: (pkg: Package) => void;
  updatePackage: (id: string, changes: Partial<Package>, context: OperationContext) => void;
}

const useAdminStore = create<AdminState>((set) => ({
  drivers: [],
  packages: [],
  zones: [],
  loading: false,
  syncing: false,
  lastSync: null,

  setDrivers: (drivers) => set({ drivers }),
  setPackages: (packages) => set({ packages }),
  setZones: (zones) => set({ zones }),
  setLoading: (loading) => set({ loading }),
  setSyncing: (syncing) => set({ syncing }),
  setLastSync: (timestamp) => set({ lastSync: timestamp }),

  clearAdminState: () =>
    set({
      drivers: [],
      packages: [],
      zones: [],
      loading: false,
      syncing: false,
      lastSync: null,
    }),

  updateDriver: (id, changes, context) =>
    set((state) => ({
      drivers: state.drivers.map((driver) =>
        driver.id === id ? { ...driver, ...changes, changedBy: context, updated_at: context.updatedAt } : driver
      ),
    })),

  addPackage: (pkg) =>
    set((state) => ({ packages: [...state.packages, pkg] })),

  updatePackage: (id, changes, context) =>
    set((state) => ({
      packages: state.packages.map((pkg) =>
        pkg.id === id ? { ...pkg, ...changes, changedBy: context, updated_at: context.updatedAt } : pkg
      ),
    })),
}));

export default useAdminStore;
