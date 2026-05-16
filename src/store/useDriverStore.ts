import { create } from 'zustand';
import type { Driver, Package, OperationContext } from '../types';

interface DriverState {
  assignedMissions: Package[];
  driverInfo: Driver | null;
  loading: boolean;
  syncing: boolean;
  lastSync: string | null;
  setAssignedMissions: (missions: Package[]) => void;
  setDriverInfo: (driver: Driver | null) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSync: (timestamp: string | null) => void;
  clearDriverState: () => void;
  updateMissionStatus: (
    id: string,
    changes: Partial<Package>,
    context: OperationContext
  ) => void;
  addMission: (mission: Package) => void;
}

const useDriverStore = create<DriverState>((set) => ({
  assignedMissions: [],
  driverInfo: null,
  loading: false,
  syncing: false,
  lastSync: null,

  setAssignedMissions: (missions) => set({ assignedMissions: missions }),
  setDriverInfo: (driver) => set({ driverInfo: driver }),
  setLoading: (loading) => set({ loading }),
  setSyncing: (syncing) => set({ syncing }),
  setLastSync: (timestamp) => set({ lastSync: timestamp }),

  clearDriverState: () =>
    set({
      assignedMissions: [],
      driverInfo: null,
      loading: false,
      syncing: false,
      lastSync: null,
    }),

  updateMissionStatus: (id, changes, context) =>
    set((state) => ({
      assignedMissions: state.assignedMissions.map((mission) =>
        mission.id === id
          ? { ...mission, ...changes, changedBy: context, updated_at: context.updatedAt }
          : mission
      ),
    })),

  addMission: (mission) =>
    set((state) => ({ assignedMissions: [...state.assignedMissions, mission] })),
}));

export default useDriverStore;
