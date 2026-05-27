import { create } from 'zustand';


interface AuthState {
  userRole: 'deliverer' | 'admin' | null;
  driverId: string | null;
  driverName: string | null;
  driverZone: string | null;
  driverPin: string | null;
  adminPin: string | null;
  supabaseUserId: string | null;
  isAuthenticated: boolean;
  loginAsDriver: (id: string, name?: string, zone?: string, pin?: string, supabaseUserId?: string) => void;
  unlockAdmin: (pin?: string, supabaseUserId?: string) => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  userRole: null,
  driverId: null,
  driverName: null,
  driverZone: null,
  driverPin: null,
  adminPin: null,
  supabaseUserId: null,
  isAuthenticated: false,

  loginAsDriver: (id, name, zone, pin, supabaseUserId) => {
    set({ 
      userRole: 'deliverer', 
      driverId: id,
      driverName: name ?? null,
      driverZone: zone ?? null,
      driverPin: pin ?? null,
      adminPin: null,
      supabaseUserId: supabaseUserId ?? null,
      isAuthenticated: true 
    });
  },

  unlockAdmin: (pin, supabaseUserId) => {
    set({ 
      userRole: 'admin',
      adminPin: pin ?? null,
      driverPin: null, 
      supabaseUserId: supabaseUserId ?? null,
      isAuthenticated: true 
    });
  },

  logout: () => {
    console.log('🔄 Logout initiated');
    
    // Capture current state before clearing
    const currentRole = useAuthStore.getState().userRole;
    const currentDriverId = useAuthStore.getState().driverId;
    
    // Clear auth state first
    set({ 
      userRole: null, 
      driverId: null,
      driverName: null,
      driverZone: null,
      driverPin: null,
      adminPin: null,
      supabaseUserId: null,
      isAuthenticated: false 
    });
    
    console.log('✅ Auth state cleared');
    
    // Then try to clear cache and sign out from Firebase
    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      console.log('🔄 Starting async cleanup...');
      
      // Clear realtime listeners
      try {
        const { cleanupListeners } = require('../utils/supabaseRealtime');
        cleanupListeners('all');
        console.log('✅ Realtime listeners cleared');
      } catch (error) {
        console.log('ℹ️ Could not clear listeners:', error);
      }

      try {
        const { clearRemotePoll } = require('../utils/remotePollSync');
        clearRemotePoll();
        console.log('✅ Remote poll cleared');
      } catch (error) {
        console.log('ℹ️ Could not clear remote poll:', error);
      }

      try {
        const useAdminStore = require('./useAdminStore').default;
        const useDriverStore = require('./useDriverStore').default;
        useAdminStore.getState().clearAdminState();
        useDriverStore.getState().clearDriverState();
        console.log('✅ Role stores cleared');
      } catch (error) {
        console.log('ℹ️ Could not clear role stores:', error);
      }
      
      // Clear in-memory sensitive data cache (prevents data leaking between sessions)
      try {
        const { clearSensitiveDataCache, clearRolePartitions } = require('../utils/localDatabase');
        clearSensitiveDataCache();
        console.log('✅ Sensitive data cache cleared');
        
        // Clear partition data for the logged out user
        clearRolePartitions(currentRole, currentDriverId);
      } catch (error) {
        console.log('ℹ️ Could not clear sensitive data cache or role partitions:', error);
      }

      // Clear secure storage cache
      try {
        const { clearAllCache } = require('../utils/offlineAuth');
        clearAllCache().then(() => {
          console.log('✅ Secure storage cache cleared');
        }).catch((error: any) => {
          console.error('❌ Error clearing cache on logout:', error);
        });
      } catch (error) {
        console.log('ℹ️ Could not load offlineAuth module:', error);
      }
      
      // Sign out from Firebase if available
      try {
        const { signOut } = require('../utils/firebaseAuth');
        signOut().then(() => {
          console.log('✅ Firebase cleanup completed');
        }).catch((error: any) => {
          // signOut function should not throw errors, but just in case
          console.log('ℹ️ Firebase sign out had an issue (non-critical):', error?.message || error);
        });
      } catch (error) {
        console.log('ℹ️ Firebase auth module not available:', error);
      }
      
      // Sign out from Supabase Auth
      try {
        const { getAuth } = require('../supabase/config');
        const auth = getAuth();
        auth.signOut().then(() => {
          console.log('✅ Supabase auth signed out');
        }).catch((error: any) => {
          console.log('ℹ️ Supabase sign out issue:', error?.message || error);
        });
      } catch (error) {
        console.log('ℹ️ Supabase auth module not available:', error);
      }
      
      console.log('✅ Async cleanup initiated');
    }, 0);
  },
}));

export default useAuthStore;
