import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
  ScrollView,
  Linking,
} from 'react-native';
import Share from 'react-native-share';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalDatabase } from '../../hooks/useLocalDatabase';
import useAdminStore from '../../store/useAdminStore';
import { AdminPackageListScreenProps } from '../../types/navigation';
import ScannerModal from '../../components/ScannerModal';
import { formatDateTime as formatDateTimeUtil } from '../../utils/dateFormatter';
import { useResponsiveDimensions } from '../../utils/responsive';

export default function AdminPackageListScreen({ navigation, route }: AdminPackageListScreenProps) {
  const { isLandscape } = useResponsiveDimensions();
  
  const { packages: localPackages, drivers: localDrivers, loading: localLoading, refresh, archivePackages, unarchivePackages, assignPackageToDriver, deletePackages } = useLocalDatabase({ isAdmin: true });
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

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const showArchived = !!route?.params?.archivedOnly;
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'today', 'week'

  // Chauffeurs (drivers) filter
  const [filterDriverId, setFilterDriverId] = useState<string>('all');
  const [driverPickerVisible, setDriverPickerVisible] = useState(false);

  const archivedStatusOptions = ['archived'] as const;

  // Selection
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [bulkAssignModalVisible, setBulkAssignModalVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Bulk deassign modal state (local-only)
  const [bulkDeassignModalVisible, setBulkDeassignModalVisible] = useState(false);
  const [bulkDeassigning, setBulkDeassigning] = useState(false);
  const [selectedIdsToDeassign, setSelectedIdsToDeassign] = useState<Set<string>>(new Set());
  
  // Package Details modal state (real-time)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedPackageForDetailsId, setSelectedPackageForDetailsId] = useState<string | null>(null);
  const [selectedPackageForDetails, setSelectedPackageForDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Edit/Delete states
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<any>(null);

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);

  // Package Details modal state (real-time)

  // Edit package form states - all fields from create screen
  const [editSenderName, setEditSenderName] = useState('');
  const [editSenderCompany, setEditSenderCompany] = useState('');
  const [editSenderPhone, setEditSenderPhone] = useState('');
  const [editDateOfArrive, setEditDateOfArrive] = useState('');
  const [editSupplementInfo, setEditSupplementInfo] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerPhone2, setEditCustomerPhone2] = useState('');
  const [editGpsLat, setEditGpsLat] = useState('');
  const [editGpsLng, setEditGpsLng] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editLimitDate, setEditLimitDate] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editIsPaid, setEditIsPaid] = useState(false);

  // Use the centralized date formatter utility
  const formatDateTime = (value?: string): string => {
    return formatDateTimeUtil(value);
  };

  // Translate status to French for display
  const translateStatus = (status: string): string => {
    const statusTranslations: Record<string, string> = {
      'Pending': 'En attente',
      'Assigned': 'Assigné',
      'In Transit': 'En cours',
      'Delivered': 'Livré',
      'Returned': 'Retourné',
      'Archived': 'Archivé'
    };
    return statusTranslations[status] || status;
  };

  const statusOptions = ['all', 'Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned'];
  
  // French labels for status filter
  const statusLabels: Record<string, string> = {
    'all': 'Tous',
    'Pending': 'En attente',
    'Assigned': 'Assigné',
    'In Transit': 'En cours',
    'Delivered': 'Livré',
    'Returned': 'Retourné'
  };

  // Filter packages
  const filteredPackages = adminPackages.filter((pkg: any) => {
    const isArchived = !!(pkg.is_archived || pkg.archived_at);

    // Archive mode first: only archived packages
    if (showArchived) {
      if (!isArchived) return false;
    } else {
      // Normal mode: hide archived packages
      if (isArchived) return false;
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!pkg.ref_number?.toLowerCase().includes(query) &&
          !pkg.customer_name?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== 'all' && pkg.status !== filterStatus) {
      return false;
    }

    // Chauffeurs filter (assigned_to)
    if (filterDriverId !== 'all' && pkg.assigned_to !== filterDriverId) {
      return false;
    }

    // Date/Time filter (limit_date + optional limit_time)
    // - When limit_time is missing, we treat deadline as end-of-day (23:59) for deterministic filtering.
    const buildDeadline = (): Date | null => {
      if (!pkg?.limit_date) return null;

      const limitDateStr = String(pkg.limit_date);
      const timeStr = pkg.limit_time ? String(pkg.limit_time) : '23:59';

      const [yyyy, mm, dd] = limitDateStr.includes('T')
        ? limitDateStr.split('T')[0].split('-').map(Number)
        : limitDateStr.split('/').length === 3
          ? (() => {
              const [d, m, y] = limitDateStr.split('/').map(Number);
              return [y, m, d];
            })()
          : limitDateStr.split('-').map(Number);

      const [HH, MM] = timeStr.split(':').map((n: string) => Number(n));

      const deadline = new Date(yyyy, (mm || 1) - 1, dd || 1, HH || 0, MM || 0, 0, 0);
      return Number.isNaN(deadline.getTime()) ? null : deadline;
    };

    const deadline = buildDeadline();

    if (filterDate === 'today') {
      if (!deadline) return false;
      const today = new Date();
      const sameLocalDate =
        deadline.getFullYear() === today.getFullYear() &&
        deadline.getMonth() === today.getMonth() &&
        deadline.getDate() === today.getDate();

      if (!sameLocalDate) return false;
    }

    if (filterDate === 'week') {
      if (!deadline) return false;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (deadline.getTime() < oneWeekAgo.getTime()) return false;
    }

    return true;
  });

  // Sort filtered packages by next delivery deadline (limit_date + optional limit_time)
  const getDeadlineMillis = (pkg: any): number | null => {
    if (!pkg?.limit_date) return null;
    const limitDateStr = String(pkg.limit_date);
    const timeStr = pkg.limit_time ? String(pkg.limit_time) : '23:59';

    const [yyyy, mm, dd] = limitDateStr.includes('T')
      ? limitDateStr.split('T')[0].split('-').map(Number)
      : limitDateStr.split('/').length === 3
        ? (() => {
            const [d, m, y] = limitDateStr.split('/').map(Number);
            return [y, m, d];
          })()
        : limitDateStr.split('-').map(Number);

    const [HH, MM] = timeStr.split(':').map((n: string) => Number(n));
    const deadline = new Date(yyyy, (mm || 1) - 1, dd || 1, HH || 0, MM || 0, 0, 0);
    return Number.isNaN(deadline.getTime()) ? null : deadline.getTime();
  };

  const sortedPackages = React.useMemo(() => {
    return [...filteredPackages].sort((a: any, b: any) => {
      const aIsActive = ['Pending', 'Assigned', 'In Transit'].includes(a.status);
      const bIsActive = ['Pending', 'Assigned', 'In Transit'].includes(b.status);

      // 1. Prioritize active packages over completed/final ones (Delivered, Returned, Archived)
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      const aMs = getDeadlineMillis(a);
      const bMs = getDeadlineMillis(b);

      // 2. Tie-breaker and deadline availability sorting within groups
      if (aMs === null && bMs === null) {
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aCreated - bCreated;
      }
      if (aMs === null) return 1;
      if (bMs === null) return -1;

      // 3. Sort by deadline asc (earliest/most upcoming deadline first)
      return aMs - bMs;
    });
  }, [filteredPackages]);

  // Sum of prices of all filtered packages
  const filteredTotalPrice = React.useMemo(() => {
    return filteredPackages.reduce((sum, pkg: any) => sum + (pkg.price || 0), 0);
  }, [filteredPackages]);

  // Sum of prices of delivered packages in the filtered list
  const filteredDeliveredPrice = React.useMemo(() => {
    return filteredPackages
      .filter((p: any) => p.status === 'Delivered')
      .reduce((sum, pkg: any) => sum + (pkg.price || 0), 0);
  }, [filteredPackages]);

  const toggleSelection = (pkgId: string) => {
    setSelectedPackageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pkgId)) newSet.delete(pkgId);
      else newSet.add(pkgId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const allSelected = sortedPackages.every(pkg => selectedPackageIds.has(pkg.id));
    if (allSelected) {
      // Deselect all
      setSelectedPackageIds(new Set());
    } else {
      // Select all filtered packages (sorted view)
      const allIds = new Set(sortedPackages.map(pkg => pkg.id));
      setSelectedPackageIds(allIds);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedDriverId || selectedPackageIds.size === 0) {
      Alert.alert('Erreur', 'Sélectionnez un livreur et des colis.');
      return;
    }

    setBulkAssigning(true);
    try {
      const packageIds = Array.from(selectedPackageIds);

      // ── Step 1: local write (fast, always succeeds) ───────────────────────
      await assignPackageToDriver(packageIds, selectedDriverId);

      // ── Step 2: close modal & show success immediately ────────────────────
      setBulkAssignModalVisible(false);
      setSelectedPackageIds(new Set());
      setSelectedDriverId('');
      Alert.alert('Succès', `${packageIds.length} colis assignés!`);

      // ── Step 3: sync to Supabase in background (fire-and-forget) ─────────
      const { processSyncQueue } = require('../../utils/localDatabase');
      processSyncQueue().catch((e: any) =>
        console.warn('Background assign sync failed (will retry):', e)
      );
    } catch (error: any) {
      console.error('Bulk assign error:', error);
      Alert.alert('Erreur', error?.message || 'Échec de l\'assignation.');
    } finally {
      setBulkAssigning(false);
    }
  };

  const selectedHasAssigned = useMemo(() => {
    const ids = Array.from(selectedPackageIds);
    if (ids.length === 0) return false;
    return ids.some(id => adminPackages.find((p: any) => p.id === id)?.status === 'Assigned');
  }, [selectedPackageIds, adminPackages]);

  const openBulkDeassignModal = () => {
    setSelectedIdsToDeassign(new Set(selectedPackageIds));
    setBulkDeassignModalVisible(true);
  };

  const toggleDeassignSelection = (pkgId: string) => {
    setSelectedIdsToDeassign(prev => {
      const next = new Set(prev);
      if (next.has(pkgId)) next.delete(pkgId);
      else next.add(pkgId);
      return next;
    });
  };

  const handleBulkDeassign = async () => {
    if (selectedIdsToDeassign.size === 0) {
      Alert.alert('Erreur', 'Sélectionnez au moins un colis à désassigner.');
      return;
    }

    setBulkDeassigning(true);
    try {
      const { getPackagesLocally, upsertPackageLocally, addToSyncQueue, processSyncQueue } = require('../../utils/localDatabase');

      const ids = Array.from(selectedIdsToDeassign);
      const timestamp = new Date().toISOString();

      // ── Step 1: local writes (fast, always succeed) ──────────────────────
      for (const pkgId of ids) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex((p: any) => p.id === pkgId);

        if (pkgIndex < 0) continue;

        const updatedPkg = {
          ...localPkgs[pkgIndex],
          status: 'Pending' as const,
          assigned_to: null,
          assigned_at: null,
          hidden_by_driver: false,
          _last_modified: timestamp,
        };

        await upsertPackageLocally(updatedPkg);

        await addToSyncQueue({
          id: `sync_deassign_${Date.now()}_${pkgId}`,
          type: 'update',
          collection: 'packages',
          data: {
            id: pkgId,
            updates: {
              status: 'Pending',
              assigned_to: null,
              assigned_at: null,
              hidden_by_driver: false,
              _last_modified: timestamp,
            }
          },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }

      // ── Step 2: close modal & show success immediately ───────────────────
      // Local state is already correct — UI is consistent right now.
      setBulkDeassignModalVisible(false);
      setSelectedPackageIds(new Set());
      setSelectedIdsToDeassign(new Set());
      Alert.alert('Succès', `${ids.length} colis désassignés!`);

      // ── Step 3: sync to Supabase in background (fire-and-forget) ─────────
      // Do NOT await these — a slow/first-init Supabase connection would block
      // the UI indefinitely if awaited here.
      processSyncQueue().catch((e: any) =>
        console.warn('Background deassign sync failed (will retry):', e)
      );
      refresh().catch((e: any) =>
        console.warn('Background refresh after deassign failed:', e)
      );
    } catch (error: any) {
      console.error('Bulk deassign error:', error);
      Alert.alert('Erreur', error?.message || 'Échec de la désassignation.');
    } finally {
      setBulkDeassigning(false);
    }
  };

  const handleEditPackage = (pkg: any) => {
    setEditingPackage(pkg);
    // Populate all edit form fields
    setEditSenderName(pkg.sender_name || '');
    setEditSenderCompany(pkg.sender_company || '');
    setEditSenderPhone(pkg.sender_phone || '');
    setEditDateOfArrive(pkg.date_of_arrive || '');
    setEditSupplementInfo(pkg.supplement_info || '');
    setEditCustomerName(pkg.customer_name || '');
    setEditCustomerAddress(pkg.customer_address || '');
    setEditCustomerPhone(pkg.customer_phone || '');
    setEditCustomerPhone2(pkg.customer_phone_2 || '');
    setEditGpsLat(pkg.gps_lat?.toString() || '');
    setEditGpsLng(pkg.gps_lng?.toString() || '');
    setEditDescription(pkg.description || '');
    setEditWeight(pkg.weight || '');
    setEditLimitDate(pkg.limit_date || '');
    setEditPrice(pkg.price?.toString() || '');
    setEditIsPaid(pkg.is_paid || false);
    setEditModalVisible(true);
  };

  const handleDeletePackage = (pkg: any) => {
    setPackageToDelete(pkg);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!packageToDelete) return;
    
    try {
      const { getApp } = require('@react-native-firebase/app');
      const { getFirestore, doc, deleteDoc } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'packages', packageToDelete.id));
      await refresh();
      Alert.alert('Succès', 'Colis supprimé avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de supprimer le colis');
    } finally {
      setDeleteModalVisible(false);
      setPackageToDelete(null);
    }
  };

  const saveEditedPackage = async () => {
    if (!editingPackage) return;

    try {
      // Prepare all updated fields
      const updates: any = {
        sender_name: editSenderName || undefined,
        sender_company: editSenderCompany || undefined,
        sender_phone: editSenderPhone || undefined,
        date_of_arrive: editDateOfArrive || undefined,
        supplement_info: editSupplementInfo || undefined,
        customer_name: editCustomerName || undefined,
        customer_address: editCustomerAddress || undefined,
        customer_phone: editCustomerPhone || undefined,
        customer_phone_2: editCustomerPhone2 || undefined,
        gps_lat: editGpsLat ? parseFloat(editGpsLat) : undefined,
        gps_lng: editGpsLng ? parseFloat(editGpsLng) : undefined,
        description: editDescription || undefined,
        weight: editWeight || undefined,
        limit_date: editLimitDate || undefined,
        price: editIsPaid ? 0 : (parseFloat(editPrice) || 0),
        is_paid: editIsPaid,
        _lastModified: new Date().toISOString()
      };

      // Update Firestore immediately for real-time sync to drivers
      const { getApp } = require('@react-native-firebase/app');
      const { getFirestore, doc, updateDoc } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirestore(app);
      await updateDoc(doc(db, 'packages', editingPackage.id), updates);

      // Update local state immediately
      await refresh();

      Alert.alert('Succès', 'Colis modifié avec succès');
      setEditModalVisible(false);
      setEditingPackage(null);
    } catch (error) {
      console.error('Error updating package:', error);
      Alert.alert('Erreur', 'Impossible de modifier le colis');
    }
  };

  const renderTableHeader = () => {
    const allSelected = sortedPackages.length > 0 && sortedPackages.every(pkg => selectedPackageIds.has(pkg.id));
    const someSelected = sortedPackages.some(pkg => selectedPackageIds.has(pkg.id));

    return (
      <View style={styles.tableHeader}>
        <TouchableOpacity onPress={toggleSelectAll} style={styles.checkbox}>
          <View style={[
            styles.checkboxInner,
            allSelected && styles.checkboxChecked,
            someSelected && !allSelected && styles.checkboxIndeterminate
          ]}>
            {allSelected && <Text style={styles.checkmark}>✓</Text>}
            {someSelected && !allSelected && <Text style={styles.checkmark}>−</Text>}
          </View>
        </TouchableOpacity>
        <Text style={[styles.headerText, styles.headerPkg]}>Colis</Text>
        <Text style={[styles.headerText, styles.headerCustomer]}>Client</Text>
        <Text style={[styles.headerText, styles.headerPrice]}>Prix</Text>
        <Text style={[styles.headerText, styles.headerStatus]}>Statut</Text>
      </View>
    );
  };

  const openPackageDetails = (pkg: any) => {
    setSelectedPackageForDetailsId(pkg.id);
    setSelectedPackageForDetails(pkg);
    // Use locally-synced package data (no remote fetch for the modal)
    setDetailsLoading(false);
    setDetailsModalVisible(true);
  };

  const handleScan = (data: string) => {
    setScannerVisible(false);
    
    // Validate QR code data - reject URLs and invalid formats
    if (!data || data.trim().length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Format invalide', 'Le QR code scanné est vide.');
      return;
    }
    
    // Reject URLs and web links
    if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('www.')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Format invalide', 'Les liens web ne sont pas supportés.');
      return;
    }
    
    let searchRef = data.trim();
    let packageData: any = null;
    
    // Try to parse as JSON (in case QR is a full package JSON)
    try {
      const parsed = JSON.parse(data);
      if (parsed.ref_number || parsed.ref) {
        searchRef = String(parsed.ref_number || parsed.ref);
        packageData = parsed;
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert('Format invalide', 'Le QR code scanné n\'est pas un colis valide.');
        return;
      }
    } catch (e) {
      // Not JSON - check if it's formatted text with RÉFÉRENCE line
      const refMatch = searchRef.match(/RÉFÉRENCE\s*:\s*(PKG-\d+|\d+)/i);
      if (refMatch) {
        searchRef = refMatch[1];
      }
      
      // Validate reference number format (basic validation)
      if (!/^PKG-\d+$/.test(searchRef) && !/^\d+$/.test(searchRef)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert('Format invalide', 'Le QR code doit contenir un numéro de référence valide (ex: PKG-123456).');
        return;
      }
    }
    
    // First, check if package exists
    const foundPkg = adminPackages.find(
      (p: any) => p.id === searchRef || p.ref_number.toLowerCase() === searchRef.toLowerCase()
    );
    
    if (foundPkg) {
      // Package exists - show details
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      openPackageDetails(foundPkg);
    } else if (packageData) {
      // Package doesn't exist but we have JSON data - navigate to AddPackageScreen with pre-filled data
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Nouveau Colis Détecté',
        'Ce colis n\'existe pas dans la base de données. Voulez-vous le créer avec les données scannées ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Créer', 
            onPress: () => {
              // Navigate to AddPackageScreen with pre-filled data
              navigation.navigate('AddPackage', { 
                scannedData: packageData 
              });
            }
          }
        ]
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Introuvable', 'Ce colis n\'existe pas.');
    }
  };

  // NOTE:
  // Admin package details modal should rely on locally-synced package data.
  // Supabase realtime/remote fetch can temporarily set `selectedPackageForDetails` to null,
  // causing the modal to show "Aucun colis sélectionné".
  //
  // Therefore, no Supabase listener/fetch is used for this modal.

  const renderTableRow = ({ item }: { item: any }) => (
    <View style={styles.tableRow}>
      <TouchableOpacity onPress={() => toggleSelection(item.id)} style={styles.checkbox}>
        <View style={[
          styles.checkboxInner,
          selectedPackageIds.has(item.id) && styles.checkboxChecked
        ]}>
          {selectedPackageIds.has(item.id) && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => openPackageDetails(item)}
        style={[styles.cellPkg, styles.pkgCellContainer]}
        accessibilityRole="button"
      >
        <View style={styles.pkgInfo}>
          <Text style={styles.pkgNumber} numberOfLines={1} ellipsizeMode="clip">{item.ref_number}</Text>
          <Text style={styles.pkgSubtitle} numberOfLines={1}>{item.description || 'Pas de description'}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.cellCustomer} numberOfLines={1}>{item.customer_name}</Text>
      <Text style={styles.cellPrice}>
        {item.is_paid ? 'payé' : (item.price || 0).toString()}
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}> 
        <Text
          style={styles.statusText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {translateStatus(item.status)}
        </Text>
      </View>
    </View>
  );

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      Pending: '#FCD34D',
      Assigned: '#3B82F6',
      'In Transit': '#10B981',
      Delivered: '#059669',
      Returned: '#EF4444',
      Archived: '#8B5CF6',
    };
    return colors[status] || '#6B7280';
  };

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liste des Colis</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.list}
        data={sortedPackages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ ...styles.tableContent, flexGrow: 1 }}
        ListHeaderComponent={
          <>
            {/* Filters */}
            <View style={styles.filtersContainer}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher colis/client..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <TouchableOpacity onPress={() => setScannerVisible(true)} style={styles.adminScanBtn}>
                  <Text style={styles.adminScanText}>📷</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Statut</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setStatusPickerVisible(true)}
                  >
                    <Text style={styles.pickerText}>
                      {statusLabels[filterStatus] || filterStatus}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Date</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setDatePickerVisible(true)}
                  >
                    <Text style={styles.pickerText}>
                      {filterDate === 'all' ? 'Toutes' : filterDate === 'today' ? "Aujourd'hui" : 'Cette semaine'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Chauffeurs</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setDriverPickerVisible(true)}
                  >
                    <Text style={styles.pickerText}>
                      {filterDriverId === 'all'
                        ? 'Tous'
                        : (() => {
                            const driver = adminDrivers.find((d: any) => d.id === filterDriverId);
                            return driver ? driver.name : '—';
                          })()}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Summary & Bulk Controls */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryText}>
                  Total: <Text style={styles.summaryBold}>{sortedPackages.length}</Text> colis
                  {selectedPackageIds.size > 0 && (
                    <Text> · Sélection: <Text style={styles.summaryBold}>{selectedPackageIds.size}</Text></Text>
                  )}
                </Text>
              </View>

              <View style={styles.financeStatsRow}>
                <View style={styles.financeStatBox}>
                  <Text style={styles.financeStatLabel}>Valeur Totale (Filtres)</Text>
                  <Text style={styles.financeStatValue}>{filteredTotalPrice.toFixed(2)} DH</Text>
                </View>
                <View style={styles.financeStatDivider} />
                <View style={[styles.financeStatBox, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.financeStatLabel, { color: '#047857' }]}>Montant Livré (Encaissé)</Text>
                  <Text style={[styles.financeStatValue, { color: '#059669' }]}>{filteredDeliveredPrice.toFixed(2)} DH</Text>
                </View>
              </View>

              <View style={styles.bulkControls}>
                {selectedPackageIds.size > 0 && (
                  <>
                    {!showArchived ? (
                      <>
                        {selectedHasAssigned ? (
                          <TouchableOpacity
                            style={[styles.bulkAssignBtn, { backgroundColor: '#EF4444' }]}
                            onPress={openBulkDeassignModal}
                            disabled={bulkDeassigning}
                          >
                            <Text style={[styles.bulkAssignText, { color: '#fff' }]}>Désassigner</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.bulkAssignBtn}
                            onPress={() => { setBulkAssigning(false); setBulkAssignModalVisible(true); }}
                            disabled={!adminDrivers.length}
                          >
                            <Text style={styles.bulkAssignText}>Assigner</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[styles.bulkAssignBtn, { backgroundColor: '#8B5CF6' }]}
                          onPress={() => {
                            const ids = Array.from(selectedPackageIds);
                            void archivePackages(ids);
                            setSelectedPackageIds(new Set());
                          }}
                          disabled={selectedPackageIds.size === 0}
                        >
                          <Text style={styles.bulkAssignText}>Archiver</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.bulkAssignBtn, { backgroundColor: '#10B981' }]}
                          onPress={() => {
                            const ids = Array.from(selectedPackageIds);
                            void unarchivePackages(ids);
                            setSelectedPackageIds(new Set());
                          }}
                          disabled={selectedPackageIds.size === 0}
                        >
                          <Text style={styles.bulkAssignText}>Restaurer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.bulkAssignBtn, { backgroundColor: '#EF4444' }]}
                          onPress={() => {
                            Alert.alert(
                              'Confirmer la suppression',
                              `Êtes-vous sûr de vouloir supprimer ${selectedPackageIds.size} colis archivé(s) de manière permanente?\n\nCette action ne peut pas être annulée.`,
                              [
                                { text: 'Annuler', style: 'cancel' },
                                {
                                  text: 'Supprimer',
                                  style: 'destructive',
                                  onPress: async () => {
                                    try {
                                      const ids = Array.from(selectedPackageIds);
                                      await deletePackages(ids);
                                      setSelectedPackageIds(new Set());
                                      Alert.alert('Succès', `${ids.length} colis supprimé(s) avec succès`);
                                    } catch (error: any) {
                                      Alert.alert('Erreur', error?.message || 'Impossible de supprimer les colis');
                                    }
                                  }
                                }
                              ]
                            );
                          }}
                          disabled={selectedPackageIds.size === 0}
                        >
                          <Text style={styles.bulkAssignText}>Supprimer</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Table Header */}
            {renderTableHeader()}
          </>
        }
        renderItem={renderTableRow}
        removeClippedSubviews={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun colis trouvé</Text>
          </View>
        }
      />

      {/* Status Picker Modal */}
      <Modal visible={statusPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner un statut</Text>
            <ScrollView>
              {statusOptions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.driverOption,
                    filterStatus === s && styles.driverOptionActive
                  ]}
                  onPress={() => {
                    setFilterStatus(s);
                    setStatusPickerVisible(false);
                  }}
                >
                  <Text style={styles.driverName}>
                    {statusLabels[s] || s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setStatusPickerVisible(false)}
            >
              <Text style={styles.modalBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={datePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner une date</Text>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDate === 'all' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDate('all');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Toutes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDate === 'today' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDate('today');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Aujourd'hui</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDate === 'week' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDate('week');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Cette semaine</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setDatePickerVisible(false)}
            >
              <Text style={styles.modalBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Driver Picker Modal (Chauffeurs filter) */}
      <Modal visible={driverPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner un chauffeur</Text>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDriverId === 'all' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDriverId('all');
                  setDriverPickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Tous</Text>
              </TouchableOpacity>

              {adminDrivers.map((driver: any) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverOption,
                    filterDriverId === driver.id && styles.driverOptionActive
                  ]}
                  onPress={() => {
                    setFilterDriverId(driver.id);
                    setDriverPickerVisible(false);
                  }}
                >
                  <Text style={styles.driverName}>
                    {driver.name}
                    {driver.zone ? ` (${driver.zone})` : ''}
                  </Text>
                  <Text
                    style={styles.driverVehicle}
                    numberOfLines={1}
                    ellipsizeMode="clip"
                  >
                    {driver.custom_id || driver.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setDriverPickerVisible(false)}
            >
              <Text style={styles.modalBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal visible={bulkAssignModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assigner {selectedPackageIds.size} colis</Text>
            <ScrollView style={styles.driverList}>
{adminDrivers.map((driver: any) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverOption,
                    selectedDriverId === driver.id && styles.driverOptionActive
                  ]}
                  onPress={() => setSelectedDriverId(driver.id)}
                >
                  <Text style={styles.driverName}>
                    {driver.name}
                    {driver.zone ? ` (${driver.zone})` : ''}
                  </Text>
                  <Text style={styles.driverVehicle}>{driver.custom_id || driver.id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setBulkAssignModalVisible(false);
                  setSelectedDriverId('');
                }}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.assignBtn, (!selectedDriverId || bulkAssigning) && styles.assignBtnDisabled]}
                onPress={handleBulkAssign}
                disabled={!selectedDriverId || bulkAssigning}
              >
                {bulkAssigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.assignText}>Assigner</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Deassign Modal */}
      <Modal visible={bulkDeassignModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Désassigner {selectedPackageIds.size} colis</Text>

            <ScrollView style={styles.driverList}>
              {Array.from(selectedPackageIds).map((pkgId: string) => {
                const pkg = adminPackages.find((p: any) => p.id === pkgId);
                const checked = selectedIdsToDeassign.has(pkgId);

                return (
                  <TouchableOpacity
                    key={pkgId}
                    style={[
                      styles.driverOption,
                      checked && styles.driverOptionActive,
                    ]}
                    onPress={() => toggleDeassignSelection(pkgId)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={styles.driverName}>{pkg?.ref_number || pkgId}</Text>
                        <Text style={styles.driverVehicle}>
                          {pkg?.customer_name || '—'}
                        </Text>
                      </View>
                      <Text style={{ color: checked ? '#fff' : '#6B7280', fontSize: 18 }}>
                        {checked ? '✓' : ' '}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setBulkDeassignModalVisible(false)}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.assignBtn, { backgroundColor: '#EF4444' }, bulkDeassigning && styles.assignBtnDisabled]}
                onPress={handleBulkDeassign}
                disabled={bulkDeassigning || selectedIdsToDeassign.size === 0}
              >
                {bulkDeassigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.assignText, { color: '#fff' }]}>Désassigner</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Package Details Modal (real-time) */}
      <Modal visible={detailsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détails du Colis</Text>

            {detailsLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Chargement des détails...</Text>
              </View>
            ) : selectedPackageForDetails ? (
              <ScrollView style={{ maxHeight: 400 }}>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Réf:</Text> {selectedPackageForDetails.ref_number}</Text>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Client:</Text> {selectedPackageForDetails.customer_name || 'Non spécifié'}</Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.detailKey}>Statut:</Text>
                    <Text
                      style={{
                        marginTop: 6,
                        alignSelf: 'flex-start',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: getStatusColor(selectedPackageForDetails.status),
                        color: '#FFFFFF',
                        fontWeight: '800',
                      }}
                    >
                      {translateStatus(selectedPackageForDetails.status)}
                    </Text>
                  </View>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Assigné à:</Text> {(() => {
                    const assignedId = selectedPackageForDetails.assigned_to;
                    if (!assignedId) return 'N/A';
                    const driver = adminDrivers.find((d: any) => d.id === assignedId);
                    return driver ? `${driver.name} (${driver.custom_id || driver.id})` : assignedId;
                  })()}</Text>

                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Assigné le:</Text> {formatDateTime(selectedPackageForDetails.assigned_at)}</Text>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Accepté le:</Text> {formatDateTime(selectedPackageForDetails.accepted_at)}</Text>

                  {selectedPackageForDetails.status === 'Delivered' && selectedPackageForDetails.delivered_at && (
                    <Text style={styles.detailLine}><Text style={styles.detailKey}>Livré le:</Text> {formatDateTime(selectedPackageForDetails.delivered_at)}</Text>
                  )}
                  {selectedPackageForDetails.status === 'Returned' && selectedPackageForDetails.delivered_at && (
                    <Text style={styles.detailLine}><Text style={styles.detailKey}>Retourné le:</Text> {formatDateTime(selectedPackageForDetails.delivered_at)}</Text>
                  )}
                  {selectedPackageForDetails.status !== 'Delivered' && selectedPackageForDetails.status !== 'Returned' && selectedPackageForDetails.delivered_at && (
                    <Text style={styles.detailLine}><Text style={styles.detailKey}>Traité le:</Text> {formatDateTime(selectedPackageForDetails.delivered_at)}</Text>
                  )}

                  {selectedPackageForDetails.status === 'Returned' && (
                    <Text style={styles.detailLine}><Text style={styles.detailKey}>Raison du retour:</Text> {selectedPackageForDetails.return_reason || 'Raison non trouvée'}</Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.modalText}>Aucun colis sélectionné.</Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setDetailsModalVisible(false);
                  setSelectedPackageForDetailsId(null);
                  setSelectedPackageForDetails(null);
                }}
              >
                <Text style={styles.modalBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />

      {/* Edit Package Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderWithActions}>
              <Text style={styles.modalTitle}>Modifier Colis {editingPackage?.ref_number || ''}</Text>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn, styles.modalDeleteBtn]}
                onPress={() => {
                  setEditModalVisible(false);
                  setPackageToDelete(editingPackage);
                  setDeleteModalVisible(true);
                }}
              >
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.sectionTitle}>1. Informations Générales</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Expéditeur (Nom)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSenderName}
                  onChangeText={setEditSenderName}
                  placeholder="Ex: Jean Dupont"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Entreprise Expéditeur</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSenderCompany}
                  onChangeText={setEditSenderCompany}
                  placeholder="Ex: Boutique Paris"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>Téléphone Expéditeur</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editSenderPhone}
                    onChangeText={setEditSenderPhone}
                    placeholder="06..."
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>Date d'arrivée</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDateOfArrive}
                    onChangeText={setEditDateOfArrive}
                    placeholder="JJ/MM/AAAA"
                  />
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Infos Supplémentaires</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSupplementInfo}
                  onChangeText={setEditSupplementInfo}
                  placeholder="Ex: Informations..."
                />
              </View>

              <Text style={styles.sectionTitle}>2. Contact & Localisation</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Nom du Client</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCustomerName}
                  onChangeText={setEditCustomerName}
                  placeholder="Ex: Jean Dupont"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Adresse de Livraison</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCustomerAddress}
                  onChangeText={setEditCustomerAddress}
                  placeholder="Ex: 10 Rue de la Paix"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>Téléphone 1</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCustomerPhone}
                    onChangeText={setEditCustomerPhone}
                    placeholder="06..."
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>Téléphone 2</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCustomerPhone2}
                    onChangeText={setEditCustomerPhone2}
                    placeholder="07..."
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>GPS Latitude</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editGpsLat}
                    onChangeText={setEditGpsLat}
                    placeholder="48.8566"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>GPS Longitude</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editGpsLng}
                    onChangeText={setEditGpsLng}
                    placeholder="2.3522"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>3. Détails du Colis</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Description</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Ex: Vêtements fragiles"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>Poids</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editWeight}
                    onChangeText={setEditWeight}
                    placeholder="Ex: 2.5kg"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>Date Limite</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editLimitDate}
                    onChangeText={setEditLimitDate}
                    placeholder="JJ/MM/AAAA"
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>4. Facturation</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Montant (DH) {!editIsPaid && '*'}</Text>
                <TextInput
                  style={[styles.modalInput, editIsPaid && styles.inputDisabled]}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="Ex: 50.00"
                  keyboardType="numeric"
                  editable={!editIsPaid}
                />
                {editIsPaid && <Text style={styles.disabledNote}>Montant non requis si déjà payé</Text>}
              </View>

              <View style={styles.switchGroup}>
                <Text style={styles.filterLabel}>Déjà Payé (Pas de COD)</Text>
                <Switch
                  value={editIsPaid}
                  onValueChange={(value) => {
                    setEditIsPaid(value);
                    if (value) {
                      setEditPrice('0');
                    }
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingPackage(null);
                }}
              >
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={saveEditedPackage}
              >
                <Text style={styles.modalBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmer la Suppression</Text>
            <Text style={styles.modalText}>
              Voulez-vous vraiment supprimer le colis {packageToDelete?.ref_number ? `(${packageToDelete.ref_number})` : ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setPackageToDelete(null);
                }}
              >
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalBtnText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20, color: '#3B82F6' },

  filtersContainer: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
  },
  adminScanBtn: {
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminScanText: {
    fontSize: 18,
  },
  filterRow: { flexDirection: 'row' },
  filterGroup: { flex: 1, marginRight: 12 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  picker: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', padding: 12 },
  pickerText: { fontSize: 16, color: '#111827' },

  summaryContainer: {
    padding: 12,
    backgroundColor: '#EFF6FF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  financeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  financeStatBox: {
    flex: 1,
  },
  financeStatLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 2,
  },
  financeStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  financeStatDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  bulkControls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  bulkToggle: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 8,
  },
  summaryText: { fontSize: 16, fontWeight: '600', color: '#1E40AF' },
  summaryBold: { color: '#1E3A8A', fontWeight: '800', fontSize: 20 },
  bulkToggleActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  bulkText: { color: '#111827', fontSize: 16, fontWeight: '600' },
  bulkTextActive: { color: '#fff' },
  bulkAssignBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bulkAssignText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  actionButtons: {
    flexDirection: 'row',
  },
  actionBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 32,
    marginRight: 4,
  },
  editBtn: {
    backgroundColor: '#E0F2FE',
  },
  viewBtn: {
    backgroundColor: '#DBEAFE',
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  modalHeaderWithActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDeleteBtn: {
    minWidth: 40,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  tableContent: { padding: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerCheckbox: { width: 50, fontWeight: '700', textAlign: 'center' },
  headerText: { fontWeight: '700', fontSize: 14, color: '#374151' },
  headerPkg: { flex: 2.4 },
  headerCustomer: { flex: 2 },
  headerPrice: { flex: 1, textAlign: 'center' },
  headerStatus: { flex: 1.2, textAlign: 'center' },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkbox: { width: 50, paddingRight: 8 },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkboxIndeterminate: { backgroundColor: '#6B7280', borderColor: '#6B7280' },
  checkmark: { color: '#fff', fontWeight: 'bold' },
  cellPkg: { flex: 2.4 },
  pkgCellContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pkgInfo: { flex: 1, marginRight: 8 },
  pkgNumber: { fontWeight: '700', fontSize: 13, color: '#111827' },
  pkgSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  pkgActionButtons: { flexDirection: 'row', alignItems: 'center' },
  cellCustomer: { flex: 2, fontSize: 14 },
  cellPrice: { flex: 1, fontWeight: '600', textAlign: 'center', fontSize: 14 },
  statusBadge: {
    flex: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    minWidth: 320,
    maxWidth: '95%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
    paddingBottom: 8,
  },
  modalButtonSpacing: { marginRight: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  cancelBtn: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  driverVehicle: { fontSize: 14, color: '#6B7280' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  modalActionSpacing: { marginLeft: 12 },
  assignBtn: { backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  assignBtnDisabled: { backgroundColor: '#9CA3AF' },
  assignText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  // Driver list styles
  driverList: { maxHeight: 200, paddingBottom: 16 },
  driverOption: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  driverOptionActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  driverName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  driverVehicleType: { fontSize: 14, color: '#6B7280' },

  // Reuse driverOption for checkbox-like list

  // Additional styles for edit modal
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginTop: 12, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  switchGroup: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 32, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  disabledNote: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },

  // Package details modal styles
  detailBlock: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  detailLine: { fontSize: 14, color: '#111827', marginBottom: 8 },
  detailKey: { fontWeight: '800', color: '#1F2937' },
  loadingText: { fontSize: 14, fontWeight: '600', color: '#1E3A8A', marginTop: 8 },

  // Modal subtitle style
  modalSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },

  // Ensure FlatList never collapses during rotation/layout passes
  list: { flex: 1, minHeight: 0 },

  // Landscape Main Container Layout
  landscapeMainContainer: {
    flexDirection: 'row',
    flex: 1,
    height: '100%',
  },
  portraitMainContainer: {
    flex: 1,
  },
  landscapeSidePanel: {
    width: '28%',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    backgroundColor: '#fff',
    height: '100%',
  },
  landscapeSidePanelContent: {
    paddingBottom: 24,
  },
  landscapeListContainer: {
    flex: 1,
    height: '100%',
  },
  portraitListContainer: {
    flex: 1,
  },
});


