import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from '../store/useAuthStore';

import AdminNavigator from './AdminNavigator';
import DriverNavigator from './DriverNavigator';
import LoginScreen from '../screens/auth/LoginScreen';
import { AuthStackParamList } from '../types/navigation';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

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

export default function RoleBasedNavigator() {
  const { isAuthenticated, userRole } = useAuthStore();

  return (
    <NavigationErrorBoundary>
      <NavigationContainer
        fallback={
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        }
      >
        {!isAuthenticated ? (
          <AuthStack.Navigator id="AuthStack" screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
          </AuthStack.Navigator>
        ) : userRole === 'admin' ? (
          <AdminNavigator />
        ) : userRole === 'deliverer' ? (
          <DriverNavigator />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Unknown Role</Text>
          </View>
        )}
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
