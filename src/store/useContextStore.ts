import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { OperationContext } from '../types';

interface ContextState {
  currentOperation: OperationContext | null;
  operationHistory: OperationContext[];
  createContext: (
    actorId: string,
    actorRole: 'admin' | 'driver',
    source?: OperationContext['source']
  ) => OperationContext;
  setCurrentOperation: (context: OperationContext | null) => void;
  clearContext: () => void;
}

const useContextStore = create<ContextState>((set) => ({
  currentOperation: null,
  operationHistory: [],

  createContext: (actorId, actorRole, source = 'app') => {
    const context: OperationContext = {
      actorId,
      actorRole,
      operationId: uuidv4(),
      deviceId: 'unknown-device',
      updatedAt: new Date().toISOString(),
      source,
    };

    set((state) => ({
      currentOperation: context,
      operationHistory: [...state.operationHistory, context],
    }));

    return context;
  },

  setCurrentOperation: (context) => set({ currentOperation: context }),

  clearContext: () => set({ currentOperation: null }),
}));

export default useContextStore;
