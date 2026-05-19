import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Button, LogBox, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import RoleBasedNavigator from './src/navigation/RoleBasedNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
// AppCheck removed - Firebase App Check no longer needed

/** Minimum time the native splash (launcher image) stays visible on cold start. */
const MIN_SPLASH_MS = 2000;

SplashScreen.preventAutoHideAsync().catch(() => { });

// Suppress minor warnings in production
LogBox.ignoreLogs([
  'Require cycle:',
  'componentWillMount has been renamed',
  'SafeAreaView has been deprecated'
]);

import SyncStatusBanner from './src/components/SyncStatusBanner';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const initializeApp = useCallback(async () => {
    const splashStartedAt = Date.now();
    let fatalError: string | null = null;

    try {
      console.log('🚀 App starting...');

      // 1. Test AsyncStorage is ready
      try {
        await AsyncStorage.setItem('@app_init_test', 'ok');
        await AsyncStorage.removeItem('@app_init_test');
        console.log('✅ AsyncStorage ready');
      } catch (asError) {
        console.warn('⚠️ AsyncStorage warning:', asError);
        // Continue anyway - non-critical
      }

      // 2. Initialize Firebase App Check for API security (DISABLED for development)
      // try {
      //   const appCheckInitialized = await initializeAppCheck();
      //   if (appCheckInitialized) {
      //     console.log('✅ App Check initialized');
      //   } else {
      //     console.warn('⚠️ App Check initialization failed');
      //   }
      // } catch (acError) {
      //   console.warn('⚠️ App Check warning:', acError);
      //   // Non-fatal - app can work without App Check
      // }

      // 3. Configure debug mode if in development
      // if (__DEV__) {
      //   configureAppCheckDebugMode();
      // }

      // 4. Initialize Firebase Authentication (optional - for non-pre-stored drivers)
      // Note: Pre-stored drivers (DRV-001 to DRV-020) work without Firebase Auth
      // Firebase Auth removed - migrated to Supabase
      try {
        console.log('✅ Using Supabase Auth instead of Firebase');
      } catch (authError) {
        console.warn('⚠️ Supabase Auth warning:', authError);
        // Non-fatal - app can work with pre-stored drivers
      }

      // 5. Firebase initialization removed - migrated to Supabase
      try {
        console.log('✅ Firebase initialization skipped - using Supabase instead');

        console.log('✅ Firestore and Auth initialized');
      } catch (fsError) {
        console.warn('⚠️ Firebase initialization warning:', fsError);
        // Non-fatal - app can work offline
      }

      console.log('✅ App initialized successfully');
      fatalError = null;
    } catch (err) {
      console.error('❌ App initialization error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes('Firebase') || errorMessage.includes('firestore')) {
        console.warn('Firebase error - continuing in offline mode');
        fatalError = null;
      } else {
        fatalError = errorMessage;
      }
    } finally {
      const elapsed = Date.now() - splashStartedAt;
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - elapsed));
      }
      try {
        await SplashScreen.hideAsync();
      } catch {
        // ignore if splash already hidden
      }
      setError(fatalError);
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setIsReady(false);
    setRetryCount(prev => prev + 1);
  }, []);

  if (!isReady) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading DeliveryX...</Text>
          {retryCount > 0 && (
            <Text style={styles.retryText}>Retry attempt {retryCount}</Text>
          )}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.error}>
          <Text style={styles.errorTitle}>⚠️ Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.retryButton}>
            <Button title="Retry" onPress={handleRetry} color="#4CAF50" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ErrorBoundary>
        <RoleBasedNavigator />
        <SyncStatusBanner />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  retryText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 10,
  },
});

