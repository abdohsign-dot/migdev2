import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import DelivererTaskScreen from '../screens/DelivererTaskScreen';
import AddPackageScreen from '../screens/AddPackageScreen';
import DriverListScreen from '../screens/DriverListScreen';
import AddDriverScreen from '../screens/AddDriverScreen';
import ModifyDriverScreen from '../screens/ModifyDriverScreen';
import DriverCredentialsScreen from '../screens/DriverCredentialsScreen';
import PackageListScreen from '../screens/PackageListScreen';
import AdminPackageListScreen from '../screens/AdminPackageListScreen';
import ChangeAdminPinScreen from '../screens/ChangeAdminPinScreen';

const Stack = createNativeStackNavigator();

/**
 * Navigation Error Boundary
 * Catches errors during navigation and screen rendering
 */
class NavigationErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Navigation Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Navigation Error</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || 'Something went wrong'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

/**
 * Main App Navigator
 * Wrapped with error boundary for robust error handling
 */
export default function AppNavigator() {
  return (
    <NavigationErrorBoundary>
      <NavigationContainer
        fallback={
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        }
      >
        <Stack.Navigator id="RootStack" initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DriverList" component={DriverListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AddDriver" component={AddDriverScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ModifyDriver" component={ModifyDriverScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DelivererTask" component={DelivererTaskScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AddPackage" component={AddPackageScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DriverCredentials" component={DriverCredentialsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PackageList" component={PackageListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminPackageList" component={AdminPackageListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChangeAdminPin" component={ChangeAdminPinScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#FEF2F2',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
