import { create } from 'zustand';


interface AuthState {
  userRole: 'deliverer' | 'admin' | null;
  driverId: string | null;
  isAuthenticated: boolean;
  loginAsDriver: (id: string) => void;
  unlockAdmin: () => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  userRole: null,
  driverId: null,
  isAuthenticated: false,

  loginAsDriver: (id) => {
    set({ 
      userRole: 'deliverer', 
      driverId: id, 
      isAuthenticated: true 
    });
  },

  unlockAdmin: () => {
    set({ 
      userRole: 'admin', 
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
      
      console.log('✅ Async cleanup initiated');
    }, 0);
  },
}));

export default useAuthStore;
