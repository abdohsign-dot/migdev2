import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Dimensions } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import useAuthStore from '../store/useAuthStore';
import { getSyncQueue } from '../utils/localDatabase';

const { width } = Dimensions.get('window');

type SyncStatus = 'online_synced' | 'offline_clean' | 'offline_pending' | 'syncing';

export default function SyncStatusBanner() {
  const { userRole, driverId, isAuthenticated } = useAuthStore();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [status, setStatus] = useState<SyncStatus>('online_synced');
  const [isActivelySyncing, setIsActivelySyncing] = useState<boolean>(false);

  const slideAnim = useRef(new Animated.Value(-120)).current; // Start hidden above screen
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Poll local queue size periodically
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingCount(0);
      return;
    }

    const checkQueue = async () => {
      try {
        const queryDriverId = userRole === 'deliverer' ? (driverId || undefined) : undefined;
        const queue = await getSyncQueue(queryDriverId);
        setPendingCount(queue.length);
      } catch (e) {
        // Silent catch to prevent UI loops
      }
    };

    checkQueue();
    const interval = setInterval(checkQueue, 3500);
    return () => clearInterval(interval);
  }, [isAuthenticated, userRole, driverId]);

  // Subscribe to NetInfo network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  // Update overall status state
  useEffect(() => {
    if (isOnline === null) return;

    if (isOnline) {
      if (pendingCount > 0) {
        // If online but we have pending items, let's show syncing or trigger sync
        setStatus('syncing');
      } else {
        setStatus('online_synced');
      }
    } else {
      if (pendingCount > 0) {
        setStatus('offline_pending');
      } else {
        setStatus('offline_clean');
      }
    }
  }, [isOnline, pendingCount]);

  // Handle banner entrance/exit animations based on status transitions
  useEffect(() => {
    // We only show the banner if:
    // 1. We are offline (offline_clean or offline_pending)
    // 2. We are actively syncing
    // 3. We just transitioned back online (show success green, then auto-slide up)
    
    if (status === 'online_synced') {
      // If we were previously showing offline/syncing, we transitioned to online_synced.
      // Let's slide up after a pleasant 3 second delay so the user feels "wowed" by the success banner.
      Animated.sequence([
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0, // Keep visible
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(3000), // Hold success banner
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -120, // Slide back up
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Slide down immediately for notice states
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status]);

  if (!isAuthenticated) return null;

  // Render variables based on status
  let backgroundColor = '#10B981'; // Green (Online synced)
  let text = '✓ Données Synchronisées';
  let icon = '⚡';
  let showSpinner = false;

  if (status === 'offline_clean') {
    backgroundColor = '#F59E0B'; // Amber
    text = 'Mode Hors-ligne (Données Locales)';
    icon = '📶';
  } else if (status === 'offline_pending') {
    backgroundColor = '#EF4444'; // Red
    text = `${pendingCount} modification${pendingCount > 1 ? 's' : ''} en attente de sync`;
    icon = '⚠️';
  } else if (status === 'syncing') {
    backgroundColor = '#3B82F6'; // Blue
    text = 'Synchronisation avec Supabase...';
    icon = '🔄';
    showSpinner = true;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        {showSpinner ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
        ) : (
          <Text style={styles.icon}>{icon}</Text>
        )}
        <Text style={styles.text} numberOfLines={1}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 50, // Floating below safe area header top margin
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
