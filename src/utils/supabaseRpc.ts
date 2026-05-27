import { getDb } from '../supabase/config';
import useAuthStore from '../store/useAuthStore';

/**
 * Execute a Supabase RPC securely by injecting the current role's PIN and ID.
 * This function extracts the active driverId/driverPin or adminPin from useAuthStore
 * and passes them into the RPC payload.
 */
export const executeRpc = async <T = any>(
  functionName: string,
  payload: Record<string, any> = {}
): Promise<T> => {
  const db = getDb();
  const state = useAuthStore.getState();

  let finalPayload = { ...payload };

  if (state.userRole === 'admin') {
    if (!state.adminPin) {
      throw new Error('Admin PIN is missing from state');
    }
    finalPayload.p_admin_pin = state.adminPin;
  } else if (state.userRole === 'deliverer') {
    if (!state.driverId || !state.driverPin) {
      throw new Error('Driver ID or PIN is missing from state');
    }
    finalPayload.p_driver_id = state.driverId;
    finalPayload.p_pin = state.driverPin;
  }

  const { data, error } = await db.rpc(functionName, finalPayload);

  if (error) {
    console.error(`RPC Error (${functionName}):`, error);
    throw error;
  }

  return data as T;
};
