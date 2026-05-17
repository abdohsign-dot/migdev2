import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useLocalDatabase } from '../../hooks/useLocalDatabase';
import useAdminStore from '../../store/useAdminStore';
import useAuthStore from '../../store/useAuthStore';
import type { AdminDashboardScreenProps } from '../../types/navigation';
import type { Package, Driver } from '../../types';
import { 
  Responsive, 
  deviceType, 
  orientation, 
  SPACING, 
  FONTS, 
  DIMENSIONS, 
  LAYOUT, 
  RESPONSIVE_SHADOWS, 
  BORDER_RADIUS,
  responsiveFontSize,
  responsivePadding,
  responsiveSize 
} from '../../utils/responsive';

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigation }) => {
  const { userRole, logout } = useAuthStore();
  const { packages: localPackages, drivers: localDrivers, loading: localLoading, refresh, packageStats } = useLocalDatabase({ isAdmin: true });
  const adminPackages = useAdminStore((state) => state.packages);
  const adminDrivers = useAdminStore((state) => state.drivers);
  const adminLoading = useAdminStore((state) => state.loading);
  const setAdminPackages = useAdminStore((state) => state.setPackages);
  const setAdminDrivers = useAdminStore((state) => state.setDrivers);
  const setAdminLoading = useAdminStore((state) => state.setLoading);

  useEffect(() => {
    setAdminPackages(localPackages);
    setAdminDrivers(localDrivers);
    setAdminLoading(localLoading);
  }, [localPackages, localDrivers, localLoading, setAdminPackages, setAdminDrivers, setAdminLoading]);
  
  const isFocused = useIsFocused();
  // Sync in background on focus so that local dashboard data loads instantly without blocking the UI
  useEffect(() => {
    if (!isFocused) return;
    refresh();
  }, [isFocused, refresh]);

  // Use real-time stats from hook
  const totalPackages = packageStats?.total || adminPackages.length || 0;
  const totalDrivers = adminDrivers.length;
  const pendingPackages = packageStats?.pending || 0;
  const inTransitPackages = packageStats?.inTransit || 0;
  const deliveredPackages = packageStats?.delivered || 0;
  const returnedPackages = packageStats?.returned || 0;

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tableau de Bord Admin</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => {
            console.log('🔄 Admin logout button clicked');
            try {
              logout();
              console.log('✅ Logout function called');
              // Stack will automatically unmount because isAuthenticated becomes false
            } catch (error) {
              console.error('❌ Error during admin logout:', error);
              // Try to navigate anyway
              try {
                // Stack will automatically unmount, nothing else needed
              } catch (navError) {
                console.error('❌ Navigation also failed:', navError);
              }
            }
          }}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards - Admin view */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalPackages}</Text>
            <Text style={styles.statLabel}>Total Paquets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pendingPackages}</Text>
            <Text style={styles.statLabel}>En Attente</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{inTransitPackages}</Text>
            <Text style={styles.statLabel}>En Transit</Text>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{deliveredPackages}</Text>
            <Text style={styles.statLabel}>Livrés</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{returnedPackages}</Text>
            <Text style={styles.statLabel}>Retournés</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalDrivers}</Text>
            <Text style={styles.statLabel}>Chauffeurs</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions Rapides</Text>
          


          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
            onPress={() => navigation.navigate('AdminPackageList')}
          >
            <Text style={styles.actionBtnText}>📦 Liste Paquets Admin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('AdminPackageList', { archivedOnly: true })}
          >
            <Text style={styles.actionBtnText}>📦 Colis archiveés</Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => navigation.navigate('AddPackage')}
          >
            <Text style={styles.actionBtnText}>➕ Ajouter Colis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#6B7280' }]}
            onPress={() => navigation.navigate('PackageList')}
          >
            <Text style={styles.actionBtnText}>📋 Tous les Paquets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
            onPress={() => navigation.navigate('DriverList')}
          >
            <Text style={styles.actionBtnText}>👨‍💼 Gérer Chauffeurs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('ChangeAdminPin')}
          >
            <Text style={styles.actionBtnText}>🔐 Changer PIN Admin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Increased for safe area and button visibility
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    flexShrink: 1,
    flex: 1,
  },
  logoutBtn: {
    paddingHorizontal: deviceType.isSmallPhone ? 10 : 16,
    paddingVertical: deviceType.isSmallPhone ? 6 : 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    flexShrink: 0,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: deviceType.isSmallPhone ? 12 : 14,
  },
  pinSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
  },
  pinSubmitBtn: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
  },
  pinSubmitText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSize(16, 20),
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: responsiveSize(10, 14),
    borderRadius: responsiveSize(10, 14),
    alignItems: 'center',
    flex: 1,
    minWidth: deviceType.isSmallPhone ? 70 : 90,
    maxWidth: '33%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statNumber: {
    fontSize: deviceType.isSmallPhone ? 18 : 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: deviceType.isSmallPhone ? 11 : 13,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  actionsSection: {
    backgroundColor: '#FFFFFF',
    padding: responsiveSize(16, 20),
    borderRadius: responsiveSize(12, 14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: FONTS.compact.subtitle,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: responsiveSize(12, 16),
  },
  actionBtn: {
    paddingVertical: responsiveSize(14, 16),
    paddingHorizontal: responsiveSize(16, 20),
    borderRadius: BORDER_RADIUS.md,
    marginBottom: responsiveSize(10, 12),
    alignItems: 'center',
    minHeight: 48, // Ensure touch target
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: deviceType.isSmallPhone ? 13 : FONTS.compact.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONTS.compact.body,
    color: '#64748B',
  },
});

export default AdminDashboardScreen;

