/**
 * Role-isolated foreground polling (one app, separated admin / driver modes).
 * Incremental pull from Supabase — not Realtime listeners (no Auth JWT).
 */

import { AppState, AppStateStatus } from 'react-native';
import { isOnline } from './networkDetection';
import useAuthStore from '../store/useAuthStore';

/** Background poll interval (foreground only). */
export const REMOTE_POLL_INTERVAL_MS = 30_000;

/** Full re-download every N polls to pick up remote deletes. */
const FULL_SYNC_EVERY_N_POLLS = 10;

export type AppRole = 'admin' | 'deliverer';

export type RemotePollSubscriber = {
  id: string;
  role: AppRole;
  driverId?: string;
  onSynced: () => void | Promise<void>;
};

const subscribers = new Map<string, RemotePollSubscriber>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;
let pollCycleCount = 0;
let appState: AppStateStatus = AppState.currentState;

AppState.addEventListener('change', (next) => {
  appState = next;
});

const stopPollTimer = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const startPollTimer = () => {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void runRemotePoll();
  }, REMOTE_POLL_INTERVAL_MS);
};

const pruneStaleSubscribers = (role: AppRole, driverId: string | null) => {
  for (const [id, sub] of subscribers) {
    if (sub.role !== role) {
      subscribers.delete(id);
      continue;
    }
    if (role === 'deliverer' && sub.driverId !== (driverId ?? undefined)) {
      subscribers.delete(id);
    }
  }
};

export const registerRemotePoll = (subscriber: RemotePollSubscriber): (() => void) => {
  const { userRole, driverId, isAuthenticated } = useAuthStore.getState();
  const expectedRole: AppRole | null =
    userRole === 'admin' ? 'admin' : userRole === 'deliverer' ? 'deliverer' : null;

  if (!isAuthenticated || !expectedRole || subscriber.role !== expectedRole) {
    return () => {};
  }

  if (subscriber.role === 'deliverer' && subscriber.driverId !== (driverId ?? undefined)) {
    return () => {};
  }

  subscribers.set(subscriber.id, subscriber);
  pruneStaleSubscribers(expectedRole, driverId);
  startPollTimer();
  void runRemotePoll();

  return () => {
    subscribers.delete(subscriber.id);
    if (subscribers.size === 0) {
      stopPollTimer();
      pollCycleCount = 0;
    }
  };
};

export const clearRemotePoll = (): void => {
  subscribers.clear();
  stopPollTimer();
  pollInFlight = false;
  pollCycleCount = 0;
};

const getMatchingSubscribers = (
  role: AppRole,
  driverId: string | null
): RemotePollSubscriber[] => {
  return [...subscribers.values()].filter((sub) => {
    if (sub.role !== role) return false;
    if (role === 'deliverer') {
      return sub.driverId === (driverId ?? undefined);
    }
    return true;
  });
};

export const runRemotePoll = async (): Promise<void> => {
  if (pollInFlight) return;

  const { userRole, driverId, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !userRole) return;
  if (appState !== 'active') return;

  const role: AppRole = userRole === 'admin' ? 'admin' : 'deliverer';
  if (role === 'deliverer' && !driverId) return;

  const matching = getMatchingSubscribers(role, driverId);
  if (matching.length === 0) return;

  const online = await isOnline();
  if (!online) return;

  pollInFlight = true;
  pollCycleCount += 1;
  const forceFull = pollCycleCount % FULL_SYNC_EVERY_N_POLLS === 0;

  try {
    const { syncPackagesFromSupabase, syncDriversFromSupabase } = require('./supabaseSync');
    const { processSyncQueue, getSyncQueue } = require('./localDatabase');

    pruneStaleSubscribers(role, driverId);

    const queueScope = role === 'admin' ? undefined : driverId!;
    const pending = (await getSyncQueue(queueScope)).length;

    if (pending > 0) {
      await processSyncQueue(queueScope);
    }

    const pullOpts = { forceFull };
    if (role === 'admin') {
      const pkgResult = await syncPackagesFromSupabase(undefined, pullOpts);
      if (forceFull || pkgResult.count > 0) {
        await syncDriversFromSupabase(pullOpts);
      }
    } else {
      await syncPackagesFromSupabase(driverId!, pullOpts);
    }

    const stillMatching = getMatchingSubscribers(role, driverId);
    await Promise.all(
      stillMatching.map(async (sub) => {
        try {
          await sub.onSynced();
        } catch (e) {
          console.warn(`[remotePoll] onSynced failed (${sub.id}):`, e);
        }
      })
    );
  } catch (error) {
    console.warn('[remotePoll] poll cycle failed:', error);
  } finally {
    pollInFlight = false;
  }
};
