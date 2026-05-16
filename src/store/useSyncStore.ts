import { create } from 'zustand';
import type { SyncOperation } from '../types';

interface SyncState {
  pendingOps: SyncOperation[];
  currentSync: SyncOperation | null;
  isSyncing: boolean;
  syncErrors: Record<string, string>;
  queueOperation: (operation: SyncOperation) => void;
  markSynced: (operationId: string) => void;
  removeOperation: (operationId: string) => void;
  setSyncError: (operationId: string, error: string) => void;
  clearSyncErrors: () => void;
}

const useSyncStore = create<SyncState>((set) => ({
  pendingOps: [],
  currentSync: null,
  isSyncing: false,
  syncErrors: {},

  queueOperation: (operation) =>
    set((state) => {
      const exists = state.pendingOps.find((op) => op.id === operation.id);
      return {
        pendingOps: exists
          ? state.pendingOps.map((op) => (op.id === operation.id ? operation : op))
          : [...state.pendingOps, operation],
      };
    }),

  markSynced: (operationId) =>
    set((state) => ({
      pendingOps: state.pendingOps.map((op) =>
        op.id === operationId ? { ...op, synced: true } : op
      ),
    })),

  removeOperation: (operationId) =>
    set((state) => ({
      pendingOps: state.pendingOps.filter((op) => op.id !== operationId),
    })),

  setSyncError: (operationId, error) =>
    set((state) => ({
      syncErrors: {
        ...state.syncErrors,
        [operationId]: error,
      },
    })),

  clearSyncErrors: () => set({ syncErrors: {} }),
}));

export default useSyncStore;
