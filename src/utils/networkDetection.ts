/**
 * Network Detection Utility
 * 
 * Provides real-time network connectivity detection for the app.
 * Enables proper offline-first behavior and sync queue management.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Network state cache
let cachedNetworkState: NetInfoState | null = null;
let networkStateListeners: Set<(isOnline: boolean) => void> = new Set();

/**
 * Initialize network detection
 * Call this once during app startup
 */
export const initializeNetworkDetection = (): (() => void) => {
  try {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      cachedNetworkState = state;
      const isOnline = state.isConnected ?? false;
      
      console.log(`📡 Network state changed: ${isOnline ? '🟢 Online' : '🔴 Offline'}`);
      console.log(`   Type: ${state.type}, Details:`, state.details);
      
      // Notify all listeners
      networkStateListeners.forEach(listener => {
        try {
          listener(isOnline);
        } catch (error) {
          console.error('Error in network state listener:', error);
        }
      });
    });

    console.log('✅ Network detection initialized');

    // Return unsubscribe function for cleanup
    return unsubscribe;
  } catch (error) {
    console.error('❌ Error initializing network detection:', error);
    // Fallback: return noop unsubscribe to satisfy return type
    return () => {};
  }
};

/**
 * Check if device is currently online
 * Uses cached state for performance
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    // Use cached state if available (faster)
    if (cachedNetworkState !== null) {
      return cachedNetworkState.isConnected ?? false;
    }

    // Otherwise fetch current state
    const state = await NetInfo.fetch();
    cachedNetworkState = state;
    return state.isConnected ?? false;
  } catch (error) {
    console.error('❌ Error checking network status:', error);
    // Assume offline on error (safer for sync)
    return false;
  }
};

/**
 * Check if device is online (synchronous version using cached state)
 * Note: May return stale data if network state hasn't been checked yet
 */
export const isOnlineSync = (): boolean => {
  if (cachedNetworkState === null) {
    console.warn('⚠️ Network state not initialized, assuming offline');
    return false;
  }
  return cachedNetworkState.isConnected ?? false;
};

/**
 * Get detailed network information
 */
export const getNetworkInfo = async () => {
  try {
    const state = await NetInfo.fetch();
    cachedNetworkState = state;
    
    return {
      isConnected: state.isConnected ?? false,
      type: state.type,
      isInternetReachable: state.isInternetReachable ?? false,
      details: state.details,
    };
  } catch (error) {
    console.error('❌ Error getting network info:', error);
    return {
      isConnected: false,
      type: 'unknown',
      isInternetReachable: false,
      details: null,
    };
  }
};

/**
 * Subscribe to network state changes
 * Returns unsubscribe function
 */
export const onNetworkStateChange = (callback: (isOnline: boolean) => void): (() => void) => {
  networkStateListeners.add(callback);

  // Return unsubscribe function
  return () => {
    networkStateListeners.delete(callback);
  };
};

/**
 * Wait for network to come online
 * Useful for retrying operations when network is restored
 */
export const waitForNetwork = (timeoutMs: number = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if already online
    if (isOnlineSync()) {
      resolve(true);
      return;
    }

    // Set timeout
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    // Subscribe to changes
    const unsubscribe = onNetworkStateChange((isOnline) => {
      if (isOnline) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
      }
    });
  });
};

/**
 * Network quality check
 * Determines if connection is suitable for syncing
 */
export const getNetworkQuality = async (): Promise<'excellent' | 'good' | 'poor' | 'offline'> => {
  try {
    const info = await getNetworkInfo();

    if (!info.isConnected) {
      return 'offline';
    }

    // Check internet reachability
    if (!info.isInternetReachable) {
      return 'poor';
    }

    // Check connection type
    switch (info.type) {
      case 'wifi':
        return 'excellent';
      case 'cellular':
        return 'good';
      case 'bluetooth':
      case 'ethernet':
        return 'excellent';
      default:
        return 'poor';
    }
  } catch (error) {
    console.error('❌ Error checking network quality:', error);
    return 'offline';
  }
};

/**
 * Check if connection is suitable for large operations
 */
export const canPerformLargeSync = async (): Promise<boolean> => {
  const quality = await getNetworkQuality();
  return quality === 'excellent' || quality === 'good';
};

/**
 * Format network status for display
 */
export const formatNetworkStatus = async (): Promise<string> => {
  const info = await getNetworkInfo();

  if (!info.isConnected) {
    return '🔴 Offline';
  }

  if (!info.isInternetReachable) {
    return '🟡 No Internet';
  }

  const typeLabel = {
    wifi: '📶 WiFi',
    cellular: '📱 Cellular',
    bluetooth: '🔵 Bluetooth',
    ethernet: '🔌 Ethernet',
    unknown: '❓ Unknown',
  }[info.type] || '❓ Unknown';

  return `🟢 ${typeLabel}`;
};

/**
 * Log network status (for debugging)
 */
export const logNetworkStatus = async (): Promise<void> => {
  const info = await getNetworkInfo();
  const status = await formatNetworkStatus();

  console.log('📡 Network Status:');
  console.log(`   Status: ${status}`);
  console.log(`   Connected: ${info.isConnected}`);
  console.log(`   Internet Reachable: ${info.isInternetReachable}`);
  console.log(`   Type: ${info.type}`);
  if (info.details) {
    console.log(`   Details:`, info.details);
  }
};
