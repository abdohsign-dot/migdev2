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
