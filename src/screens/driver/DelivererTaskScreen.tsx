import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ToastAndroid, Linking, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PackageCard from '../../components/PackageCard';
import useAuthStore from '../../store/useAuthStore';
import { DelivererTaskScreenProps } from '../../types/navigation';
import { useLocalDatabase } from '../../hooks/useLocalDatabase';
import { updatePackage, upsertPackageLocally } from '../../utils/localDatabase';
import { showExportOptions } from '../../utils/offlineExport';
import { sendAutoReportToAdmin } from '../../utils/offlineExport';
import { getStatusColor } from '../../utils/statusColors';
import { formatPhoneForWhatsApp } from '../../utils/phoneUtils';
import ScannerModal from '../../components/ScannerModal';
import { getPackageDisplayRef } from '../../utils/packageUtils';
import { formatDate } from '../../utils/dateFormatter';
import useDriverStore from '../../store/useDriverStore';
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

export default function DelivererTaskScreen({ navigation }: DelivererTaskScreenProps) {
  const { driverId, logout } = useAuthStore();

  const assignedMissions = useDriverStore((s) => s.assignedMissions);
  const setAssignedMissions = useDriverStore((s) => s.setAssignedMissions);
  const updateMissionStatus = useDriverStore((s) => s.updateMissionStatus);
  const addMission = useDriverStore((s) => s.addMission);

  // Use local database hook - drivers only sync their packages
  const {
    packages: localPackages,
    loading,
    syncing,
    lastSync,
    pendingSyncCount,
    isOnline,
    connectionError,
    refresh,
    reloadLocalData,
    updatePackageInState,
    addPackageToState,
    updatePackageStatus,
  } = useLocalDatabase({ driverId: driverId || undefined, isAdmin: false });

  // Return Modal State
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnReasonError, setReturnReasonError] = useState('');
  const [returningPackageId, setReturningPackageId] = useState<string | null>(null);

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);

  // Expanded package state
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  // Auto-report state
  const [autoReportSent, setAutoReportSent] = useState(false);
  const [adminPhone, setAdminPhone] = useState(''); // This could come from config or settings

  // Hide completed tasks state
  const [hideCompletedTasks, setHideCompletedTasks] = useState(false);

  const handleClearPackage = async (pkgId: string) => {
    Alert.alert(
      "Masquer la mission",
      "Voulez-vous masquer ce colis de votre liste ? Cette action n'affecte pas le serveur ni l'administrateur.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Masquer",
          style: "destructive",
          onPress: async () => {
            try {
              if (driverId) {
                const { deleteDriverPackageLocally } = require('../../utils/localDatabase');
                await deleteDriverPackageLocally(pkgId, driverId);
                await reloadLocalData();
                ToastAndroid.show('Colis masqué de la liste', ToastAndroid.SHORT);
              }
            } catch (e) {
              console.error('Failed to clear package locally:', e);
              ToastAndroid.show('Erreur lors de la suppression locale', ToastAndroid.SHORT);
            }
          }
        }
      ]
    );
  };

  // Debug: Log driver info and packages
  useEffect(() => {
    console.log('📱 Driver ID:', driverId);
    console.log('📦 Packages loaded:', localPackages.length);
    console.log('📋 Package details:', localPackages.map(p => ({ 
      id: p.id, 
      ref: p.ref_number, 
      status: p.status,
      assigned_to: p.assigned_to,
      customer_name: p.customer_name,
      customer_address: p.customer_address,
      customer_phone: p.customer_phone,
      price: p.price,
      description: p.description
    })));
  }, [driverId, localPackages]);

  // Hydrate driver store from local DB missions
  useEffect(() => {
    setAssignedMissions(localPackages as any);
  }, [localPackages, setAssignedMissions]);

  // Sort packages by next delivery deadline (limit_date + optional limit_time)
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

  const packages = React.useMemo(() => {
    return [...assignedMissions].sort((a: any, b: any) => {
      const aMs = getDeadlineMillis(a);
      const bMs = getDeadlineMillis(b);
      if (aMs === null && bMs === null) return 0;
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      if (aMs < bMs) return -1;
      if (aMs > bMs) return 1;
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aCreated - bCreated;
    });
  }, [assignedMissions]);

  // Filter packages based on hide completed tasks setting
  const filteredPackages = hideCompletedTasks
    ? packages.filter(
        (p) => p.status !== 'Delivered' && p.status !== 'Returned' && p.status !== 'Archived'
      )
    : packages;

  // Calculate total price for all packages (not filtered)
  const totalPrice = packages.reduce((sum, pkg) => sum + (pkg.price || 0), 0);

  // Calculate total price for visible packages (filtered)
  const visibleTotalPrice = filteredPackages.reduce((sum, pkg) => sum + (pkg.price || 0), 0);

  // Count completed tasks
  const completedTasksCount = packages.filter(p => 
    p.status === 'Delivered' || p.status === 'Returned' || p.status === 'Archived'
  ).length;

  const handleAcceptTask = async (pkgId: string) => {
    Alert.alert(
      "Confirmation d'acceptation",
      "Voulez-vous accepter cette mission de livraison ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Accepter",
          onPress: async () => {
            try {
              const now = new Date().toISOString();

              await updatePackageStatus(pkgId, 'In Transit', {
                accepted_at: now,
                assigned_to: driverId || undefined,
              });

              updateMissionStatus(
                pkgId,
                { status: 'In Transit', accepted_at: now } as any,
                {
                  actorId: driverId || 'unknown',
                  actorRole: 'driver',
                  operationId: Date.now().toString(),
                  deviceId: 'unknown',
                  updatedAt: now,
                  source: 'app',
                }
              );

              ToastAndroid.show('Mission acceptée avec succès', ToastAndroid.SHORT);
            } catch (error) {
              console.error('Accept task error:', error);
              Alert.alert("Erreur", "Impossible d'accepter la mission. Vérifiez votre connexion.");
            }
          },
        },
      ]
    );
  };

  const handleDeliverTask = async (pkgId: string) => {
    try {
      const now = new Date().toISOString();

      await updatePackageStatus(pkgId, 'Delivered', {
        delivered_at: now,
      });

      updateMissionStatus(
        pkgId,
        { status: 'Delivered', delivered_at: now } as any,
        {
          actorId: driverId || 'unknown',
          actorRole: 'driver',
          operationId: Date.now().toString(),
          deviceId: 'unknown',
          updatedAt: now,
          source: 'app',
        }
      );

      ToastAndroid.show('✅ Colis livré avec succès', ToastAndroid.SHORT);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de valider la livraison. Réessayez.");
    }
  };

  // Phone call functionality
  const makePhoneCall = async (phoneNumber: string) => {
    if (!phoneNumber) return;

    // Keep only digits for tel:
    const digits = phoneNumber.replace(/[^0-9]/g, '');
    if (!digits) {
      Alert.alert('Erreur', "Numéro de téléphone invalide");
      return;
    }

    const phoneUrl = `tel:${digits}`;
    try {
      console.log('📞 tel URL:', phoneUrl);
      await Linking.openURL(phoneUrl);
    } catch (error) {
      console.error('Phone call error:', error);
      Alert.alert("Erreur", "Impossible d'effectuer l'appel");
    }
  };

  // WhatsApp functionality
  const openWhatsApp = async (phoneNumber: string) => {
    if (!phoneNumber) return;

    const cleanPhoneDigits = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanPhoneDigits) {
      Alert.alert("Erreur", "Numéro WhatsApp invalide");
      return;
    }

    const formattedPhone = formatPhoneForWhatsApp(phoneNumber);

    const whatsappDeepLink = `whatsapp://send?phone=${formattedPhone}`;
    const whatsappWebFallback = `https://wa.me/${formattedPhone}`;

    try {
      console.log('💬 WhatsApp deep link:', whatsappDeepLink);
      await Linking.openURL(whatsappDeepLink);
    } catch (error) {
      console.error('WhatsApp deep link failed:', error);
      try {
        console.log('💬 WhatsApp web fallback:', whatsappWebFallback);
        await Linking.openURL(whatsappWebFallback);
      } catch (error2) {
        console.error('WhatsApp fallback failed:', error2);
        Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp");
      }
    }
  };

  // GPS/Maps functionality
  const openMaps = async (address: string, lat?: number, lng?: number) => {
    try {
      if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
        const httpsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        try {
          console.log('🗺️ maps geo URL:', geoUrl);
          await Linking.openURL(geoUrl);
          return;
        } catch (geoErr) {
          console.error('Maps geo failed:', geoErr);
          console.log('🗺️ maps https fallback URL:', httpsUrl);
          await Linking.openURL(httpsUrl);
          return;
        }
      }

      if (address) {
        const encodedAddress = encodeURIComponent(address);
        const httpsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        console.log('🗺️ maps address https URL:', httpsUrl);
        await Linking.openURL(httpsUrl);
        return;
      }

      Alert.alert("Erreur", "Aucune adresse disponible");
    } catch (error) {
      console.error('Maps error:', error);
      Alert.alert("Erreur", "Impossible d'ouvrir les cartes");
    }
  };

  const openReturnModal = (pkgId: string) => {
    // Keep clean separation: only reset when opening a new package modal
    setSelectedPackageId(pkgId);
    setReturnReason('');
    setReturnReasonError('');
    setReturnModalVisible(true);
  };

  const handleConfirmReturn = async () => {
    // Clear previous errors
    setReturnReasonError('');

    // Validate return reason
    if (!returnReason.trim()) {
      setReturnReasonError('Veuillez indiquer une raison de retour');
      ToastAndroid.show('Veuillez indiquer une raison de retour', ToastAndroid.SHORT);
      return;
    }

    if (returnReason.trim().length < 5) {
      setReturnReasonError('La raison doit contenir au moins 5 caractères');
      ToastAndroid.show('Raison trop courte', ToastAndroid.SHORT);
      return;
    }

    if (!selectedPackageId) {
      Alert.alert('Erreur', 'Aucun colis sélectionné');
      return;
    }

    setReturningPackageId(selectedPackageId);

    try {
      const now = new Date().toISOString();

      await updatePackageStatus(selectedPackageId, 'Returned', {
        return_reason: returnReason.trim(),
        delivered_at: now, // Mark as processed
      });

      updateMissionStatus(
        selectedPackageId,
        {
          status: 'Returned',
          return_reason: returnReason.trim(),
          delivered_at: now,
        } as any,
        {
          actorId: driverId || 'unknown',
          actorRole: 'driver',
          operationId: Date.now().toString(),
          deviceId: 'unknown',
          updatedAt: now,
          source: 'app',
        }
      );

      ToastAndroid.show('📦 Colis retourné avec succès', ToastAndroid.SHORT);
      setReturnModalVisible(false);
      setReturnReason('');
      setSelectedPackageId(null);
    } catch (error) {
      console.error('Return package error:', error);
      Alert.alert('Erreur', 'Impossible de traiter le retour. Réessayez.');
    } finally {
      setReturningPackageId(null);
    }
  };

  const handleLogout = () => {
    logout();
    // Stack will automatically unmount and switch to AuthStack
  };

  // Auto-report trigger when connection is lost
  const triggerAutoReport = async () => {
    if (!isOnline && !autoReportSent && connectionError) {
      const completedTasks = packages.filter(p => p.status === 'Delivered' || p.status === 'Returned');
      
      if (completedTasks.length > 0) {
        try {
          console.log(`🚨 Triggering auto-report for ${completedTasks.length} completed tasks`);
          
          // Get driver name from auth store or use driverId
          const driverName = driverId || 'Driver';
          
          await sendAutoReportToAdmin(
            packages,
            driverName,
            driverId || undefined,
            adminPhone // Empty for now, will use general share
          );
          
          setAutoReportSent(true);
          ToastAndroid.show('📤 Rapport automatique envoyé à l\'admin', ToastAndroid.LONG);
          
          Alert.alert(
            '📤 Rapport envoyé',
            `Rapport de livraison automatique envoyé pour ${completedTasks.length} tâches terminées.\n\nVeuillez contacter l\'admin pour confirmer la réception.`,
            [{ text: 'OK', style: 'default' }]
          );
        } catch (error) {
          console.error('Auto-report failed:', error);
          ToastAndroid.show('❌ Échec de l\'envoi du rapport', ToastAndroid.SHORT);
        }
      }
    }
  };

  // Effect to trigger auto-report when connection is lost
  useEffect(() => {
    if (!isOnline && connectionError && !autoReportSent) {
      // Add a small delay to ensure all data is loaded
      const timer = setTimeout(() => {
        triggerAutoReport();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    // Reset auto-report flag when connection is restored
    if (isOnline && autoReportSent) {
      setAutoReportSent(false);
    }
  }, [isOnline, connectionError, autoReportSent, packages]);

  const handleScan = (data: string) => {
    setScannerVisible(false);

    console.log('📱 QR Scanned - Raw data length:', data.length);
    console.log('📱 QR Scanned - First 200 chars:', data.substring(0, 200));
    console.log('📱 QR Scanned - Last 200 chars:', data.substring(Math.max(0, data.length - 200)));

    // Validate QR code data - reject URLs and invalid formats
    if (!data || data.trim().length === 0) {
      Alert.alert('Format invalide', 'Le QR code scanné est vide.');
      return;
    }

    // Reject URLs and web links
    if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('www.')) {
      Alert.alert('Format invalide', 'Les liens web ne sont pas supportés.');
      return;
    }

    let searchRef = data.trim();
    let parsedPayload: any | null = null;

    // First try to parse entire data as JSON (in case QR contains only JSON)
    try {
      const parsed = JSON.parse(data);
      parsedPayload = parsed;
      console.log('✅ Parsed entire QR as JSON:', parsedPayload);
    } catch (e) {
      // Not pure JSON, try to extract from formatted text
      console.log('Not pure JSON, trying to extract from text...');
    }

    // If not parsed yet, try to extract JSON from QR data (handles formatted text + JSON)
    if (!parsedPayload) {
      // Method 1: Look for QR_DATA marker
      const qrDataMarker = 'QR_DATA (à régénérer) :';
      const markerIndex = data.indexOf(qrDataMarker);
      
      if (markerIndex !== -1) {
        const jsonPart = data.substring(markerIndex + qrDataMarker.length).trim();
        console.log('🔍 Found QR_DATA marker, JSON part:', jsonPart.substring(0, 100) + '...');
        
        try {
          parsedPayload = JSON.parse(jsonPart);
          console.log('✅ Parsed from QR_DATA marker:', parsedPayload);
        } catch (e) {
          console.warn('❌ Failed to parse from marker:', e);
        }
      }
      
      // Method 2: If still not parsed, try finding JSON braces
      if (!parsedPayload) {
        const startBrace = data.indexOf('{');
        const lastBrace = data.lastIndexOf('}');
        
        if (startBrace !== -1 && lastBrace !== -1 && lastBrace > startBrace) {
          const jsonCandidate = data.substring(startBrace, lastBrace + 1);
          console.log('🔍 Fallback: JSON candidate:', jsonCandidate.substring(0, 100) + '...');
          
          try {
            parsedPayload = JSON.parse(jsonCandidate);
            console.log('✅ Parsed from braces fallback:', parsedPayload);
          } catch (e) {
            console.warn('❌ Failed braces fallback:', e);
          }
        }
      }
      
      if (!parsedPayload) {
        console.log('❌ All parsing methods failed');
      }
    }

    // Fallback: Try to parse entire data as JSON (in case QR is pure JSON)
    if (!parsedPayload) {
      try {
        const parsed = JSON.parse(data);
        parsedPayload = parsed;
      } catch (e) {
        // Not JSON - continue with text parsing
      }
    }

    // Extract reference number
    if (parsedPayload?.ref_number) {
      searchRef = String(parsedPayload.ref_number);
    } else if (parsedPayload?.ref) {
      searchRef = String(parsedPayload.ref);
    } else {
      // Not JSON - check if it's formatted text with RÉFÉRENCE line
      const refMatch = searchRef.match(/RÉFÉRENCE\s*:\s*(PKG-\d+|\d+)/i);
      if (refMatch) {
        searchRef = refMatch[1];
      }

      // Validate reference number format (basic validation)
      if (!/^PKG-\d+$/.test(searchRef) && !/^\d+$/.test(searchRef)) {
        Alert.alert('Format invalide', 'Le QR code doit contenir un numéro de référence valide (ex: PKG-123456).');
        return;
      }
    }

    // Find package by ID or Ref Number (local only)
    const foundPkg = packages.find(
      (p) => p.id === searchRef || p.ref_number?.toLowerCase() === searchRef.toLowerCase()
    );

    if (foundPkg) {
      // If we have QR payload data, update the existing package with QR data
      if (parsedPayload) {
        console.log('🔄 Updating existing package with QR data');
        
        const updatedPkg = {
          ...foundPkg,
          // Update with QR data
          customer_name: parsedPayload.customer_name || foundPkg.customer_name,
          customer_address: parsedPayload.customer_address || foundPkg.customer_address,
          customer_phone: parsedPayload.customer_phone || foundPkg.customer_phone,
          customer_phone_2: parsedPayload.customer_phone_2 || foundPkg.customer_phone_2,
          gps_lat: parsedPayload.gps_lat ?? foundPkg.gps_lat,
          gps_lng: parsedPayload.gps_lng ?? foundPkg.gps_lng,
          sender_name: parsedPayload.sender_name || foundPkg.sender_name,
          sender_company: parsedPayload.sender_company || foundPkg.sender_company,
          sender_phone: parsedPayload.sender_phone || foundPkg.sender_phone,
          description: parsedPayload.description || foundPkg.description,
          weight: parsedPayload.weight || foundPkg.weight,
          supplement_info: parsedPayload.supplement_info || foundPkg.supplement_info,
          date_of_arrive: parsedPayload.date_of_arrive || foundPkg.date_of_arrive,
          limit_date: parsedPayload.limit_date ?? foundPkg.limit_date,
          ...(parsedPayload.limit_time ?? foundPkg.limit_time ? { limit_time: parsedPayload.limit_time ?? foundPkg.limit_time } : {}),
          price: parsedPayload.price ?? foundPkg.price,
          is_paid: parsedPayload.is_paid ?? foundPkg.is_paid,
          _lastModified: new Date().toISOString(),
        };

        upsertPackageLocally(updatedPkg);
        
        // Update local state immediately for instant UI update
        updatePackageInState(updatedPkg);
        
        setExpandedPackageId(foundPkg.id);
        ToastAndroid.show('Colis mis à jour avec données QR', ToastAndroid.SHORT);
        return;
      }

      // No QR payload or package exists and has valid data, just show it
      setExpandedPackageId(foundPkg.id);
      ToastAndroid.show('Colis trouvé', ToastAndroid.SHORT);
      return;
    }

    // Offline fallback (Firestore down / package not yet assigned locally):
    // Create a local draft from QR payload so driver can prefill + accept.
    if (!driverId) {
      Alert.alert('Erreur', 'Driver ID manquant.');
      return;
    }

    const draftPkg: any = {
      // Make id == ref_number so UI/accept/update uses consistent id
      id: searchRef,
      ref_number: searchRef,

      status: 'Assigned',
      assigned_to: driverId,

      // Timestamps
      accepted_at: new Date().toISOString(),
      assigned_at: new Date().toISOString(),
      _lastModified: new Date().toISOString(),
      _version: '1.0',

      // Prefill customer info (optional fields)
      customer_name: parsedPayload?.customer_name ?? 'Non spécifié',
      customer_address: parsedPayload?.customer_address ?? '',
      customer_phone: parsedPayload?.customer_phone ?? '',
      customer_phone_2: parsedPayload?.customer_phone_2 ?? '',
      gps_lat: parsedPayload?.gps_lat ?? undefined,
      gps_lng: parsedPayload?.gps_lng ?? undefined,

      // Prefill some extra fields used by UI
      sender_name: parsedPayload?.sender_name ?? '',
      sender_company: parsedPayload?.sender_company ?? '',
      sender_phone: parsedPayload?.sender_phone ?? '',
      description: parsedPayload?.description ?? '',
      weight: parsedPayload?.weight ?? '',
      supplement_info: parsedPayload?.supplement_info ?? '',
      date_of_arrive: parsedPayload?.date_of_arrive ?? parsedPayload?.created_at ?? new Date().toISOString(),
      limit_date: parsedPayload?.limit_date ?? undefined,
      ...(parsedPayload?.limit_time ? { limit_time: parsedPayload?.limit_time } : {}),

      price: parsedPayload?.price ?? 0,
      is_paid: !!parsedPayload?.is_paid,
    };

    console.log('📦 Creating draft package:', draftPkg);
    console.log('👤 Current driverId:', driverId);

    // Save draft locally so "Accepter Mission" can work (updatePackageStatus uses local pkgs)
    upsertPackageLocally(draftPkg);

    console.log('💾 Draft package saved locally');

    // Update local state immediately for instant UI update
    addPackageToState(draftPkg);
    addMission(draftPkg);

    console.log('📱 Package added to UI state, packages count:', localPackages.length + 1);

    setExpandedPackageId(draftPkg.id);
    ToastAndroid.show('QR reconnu: mission créée localement', ToastAndroid.SHORT);
    Alert.alert(
      'Mission prête',
      'Le QR a été reconnu. Vous pouvez accepter la mission (pré-remplie).'
    );
  };

  const handleExport = () => {
    if (packages.length === 0) {
      Alert.alert('Aucun colis', 'Vous n\'avez aucun colis à exporter.');
      return;
    }

    // Show export options (WhatsApp + CSV only)
    // offlineExport.ts still supports Email, but DelivererTaskScreen limits the UI options.
    showExportOptions(packages, `Driver_${driverId}`, undefined);
  };

  // Cash to collect (Only counts delivered packages)
  const cashToCollect = packages
    .filter(p => p.status === 'Delivered')
    .filter(p => !p.is_paid)
    .reduce((sum, pkg) => sum + (pkg.price || 0), 0);

  // Total delivered packages count
  const deliveredCount = packages.filter(p => p.status === 'Delivered').length;

  // Total delivered revenue (sum of all delivered packages)
  const deliveredRevenue = packages
    .filter(p => p.status === 'Delivered')
    .reduce((sum, pkg) => sum + (pkg.price || 0), 0);

  const toggleExpand = (pkgId: string) => {
    setExpandedPackageId(expandedPackageId === pkgId ? null : pkgId);
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

  type DeadlineWarningLevel = 'OK' | 'WARNING' | 'URGENT' | 'EXPIRED';

  const computeDeadlineWarning = (pkg: any): DeadlineWarningLevel => {
    if (!pkg?.limit_date) return 'OK';
    if (pkg.status === 'Delivered' || pkg.status === 'Returned') return 'OK';

    // Build deadline datetime
    // - If limit_time exists: combine limit_date + limit_time
    // - Else: treat limit_date as end-of-day (23:59) so date-only still creates a deterministic deadline
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
    const now = new Date();

    if (Number.isNaN(deadline.getTime())) return 'OK';

    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs < 0) return 'EXPIRED';

    const diffHours = diffMs / (1000 * 60 * 60);

    // WARNING: within last 2 hours
    if (diffHours <= 2) {
      // URGENT: within last 1 hour
      if (diffHours <= 1) return 'URGENT';
      return 'WARNING';
    }

    return 'OK';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Mes Missions</Text>
            {/* Sync Status Indicator */}
            <View style={styles.syncStatus}>
              {syncing ? (
                <View style={styles.syncIndicator}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={styles.syncText}>Synchronisation...</Text>
                </View>
              ) : !isOnline ? (
                <View style={styles.syncIndicator}>
                  <Text style={styles.syncDot}>🚨</Text>
                  <Text style={styles.syncText}>HORS LIGNE</Text>
                </View>
              ) : lastSync ? (
                <View style={styles.syncIndicator}>
                  <Text style={styles.syncDot}>✓</Text>
                  <Text style={styles.syncText}>Synchronisé</Text>
                </View>
              ) : null}
              {connectionError && (
                <Text style={styles.connectionError}>{connectionError}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setScannerVisible(true)} style={styles.scanBtn}>
              <Text style={styles.scanText}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
              <Text style={styles.exportText}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refresh} style={styles.refreshBtn} disabled={syncing}>
              <Text style={styles.refreshText}>{syncing ? '⟳' : '↻'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cashBox}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Colis</Text>
              <Text style={styles.statValue}>{packages.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Livrés</Text>
              <Text style={styles.statValue}>{deliveredCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Revenu Total</Text>
              <Text style={styles.statValue}>{deliveredRevenue.toFixed(2)} DH</Text>
            </View>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
      ) : filteredPackages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {hideCompletedTasks 
              ? "Toutes les missions sont terminées. Afficher les missions terminées pour voir les détails."
              : "Aucune mission assignée pour le moment."
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPackages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.numberedItem}>
              {/* Simple Numbered Line */}
              <TouchableOpacity 
                style={styles.numberedLine}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.lineNumber}>{index + 1}.</Text>
                <View style={styles.lineInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Text style={styles.lineText}>{getPackageDisplayRef(item)}</Text>

                    {(() => {
                      const level = computeDeadlineWarning(item);
                      if (level === 'OK') return null;

                      const label =
                        level === 'EXPIRED' ? '⛔ Dépassé' :
                        level === 'URGENT' ? '⚠️ URGENT' :
                        '⏰ Bientôt';

                      const bg =
                        level === 'EXPIRED' ? '#EF4444' :
                        level === 'URGENT' ? '#F97316' :
                        '#F59E0B';

                      return (
                        <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{label}</Text>
                        </View>
                      );
                    })()}

                    <Text style={styles.lineText} numberOfLines={1}>
                      {item.customer_name || 'Client'}
                    </Text>
                  </View>

                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{translateStatus(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.expandIcon}>{expandedPackageId === item.id ? '▼' : '▶'}</Text>
              </TouchableOpacity>

                    {/* Expanded Details - Show on Tap */}
              {expandedPackageId === item.id && (
                <View style={styles.expandedDetails}>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.expandedDetailsScrollContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.detailSection}>
                      <Text style={styles.detailTitle}>📦 Détails du Colis</Text>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Référence:</Text>
                        <Text style={styles.detailValue}>{getPackageDisplayRef(item)}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Client:</Text>
                        <Text style={styles.detailValue}>{item.customer_name || 'Non spécifié'}</Text>
                      </View>

                      {/* Address with GPS button */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Adresse:</Text>
                        <View style={styles.addressRow}>
                          <Text style={styles.detailValue}>{item.customer_address || 'Non spécifiée'}</Text>
                          {(item.customer_address || (item.gps_lat && item.gps_lng)) && (
                            <TouchableOpacity 
                              style={styles.gpsBtn} 
                              onPress={() => openMaps(item.customer_address || '', item.gps_lat, item.gps_lng)}
                            >
                              <Text style={styles.gpsBtnText}>🗺️</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Primary Phone with Call & WhatsApp */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Téléphone 1:</Text>
                        <View style={styles.phoneRow}>
                          <Text style={styles.phoneValue}>
                            {item.customer_phone || 'Non spécifié'}
                          </Text>
                          {item.customer_phone && (
                            <View style={styles.phoneButtons}>
                              <TouchableOpacity 
                                style={styles.callBtn} 
                                onPress={() => makePhoneCall(item.customer_phone!)}
                              >
                                <Text style={styles.callBtnText}>📞</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.whatsappBtn} 
                                onPress={() => openWhatsApp(item.customer_phone!)}
                              >
                                <Text style={styles.whatsappBtnText}>💬</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Secondary Phone with Call & WhatsApp */}
                      {item.customer_phone_2 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Téléphone 2:</Text>
                          <View style={styles.phoneRow}>
                            <Text style={styles.phoneValue}>
                              {item.customer_phone_2}
                            </Text>
                            <View style={styles.phoneButtons}>
                              <TouchableOpacity 
                                style={styles.callBtn} 
                                onPress={() => makePhoneCall(item.customer_phone_2!)}
                              >
                                <Text style={styles.callBtnText}>📞</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.whatsappBtn} 
                                onPress={() => openWhatsApp(item.customer_phone_2!)}
                              >
                                <Text style={styles.whatsappBtnText}>💬</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Prix:</Text>
                        <Text style={styles.detailValue}>
                          {item.is_paid ? 'Payé' : `${item.price} DH`}
                        </Text>
                      </View>

                      {/* Deadline (mandatory display if present) */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date lim. :</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(item.limit_date) || 'N/A'}
                          {item.limit_time ? ` ${item.limit_time}` : ''}
                        </Text>
                      </View>

                      {item.description && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Description:</Text>
                          <Text style={styles.detailValue}>{item.description}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionSection}>
                      {item.status === 'Assigned' && (
                        <TouchableOpacity 
                          style={[styles.actionBtn, styles.acceptBtn]} 
                          onPress={() => handleAcceptTask(item.id)}
                        >
                          <Text style={styles.actionBtnText}>✅ Accepter Mission</Text>
                        </TouchableOpacity>
                      )}

                      {item.status === 'In Transit' && (
                        <>
                          <TouchableOpacity 
                            style={[styles.actionBtn, styles.deliverBtn]} 
                            onPress={() => handleDeliverTask(item.id)}
                          >
                            <Text style={styles.actionBtnText}>📦 Marquer Livré</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.actionBtn, styles.returnBtn]} 
                            onPress={() => openReturnModal(item.id)}
                          >
                            <Text style={styles.actionBtnText}>🔙 Retourner Colis</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Always show option to clear/hide this single task from list */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.hideTaskBtn]} 
                        onPress={() => handleClearPackage(item.id)}
                      >
                        <Text style={styles.actionBtnText}>🧹 Effacer de la liste</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Total Price Display */}
      {packages.length > 0 && (
        <View style={styles.totalPriceContainer}>
          <View style={styles.totalPriceRow}>
            <Text style={styles.totalPriceLabel}>
              Total {hideCompletedTasks ? 'Visible' : 'Tous'} Colis:
            </Text>
            <Text style={styles.totalPriceValue}>
              {hideCompletedTasks ? visibleTotalPrice.toFixed(2) : totalPrice.toFixed(2)} DH
            </Text>
          </View>
        </View>
      )}

      {/* Return Reason Modal */}
      <Modal visible={returnModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Raison du Retour</Text>
            {selectedPackageId && (
              <Text style={styles.errorText}>
                {returnReason.trim()
                  ? ''
                  : 'Raison rapide: si colis introuvable / non répondant, indiquez-le ici'}
              </Text>
            )}
            <TextInput
              style={[styles.input, returnReasonError ? styles.inputError : null]}
              placeholder="Ex: Client absent, refusé..."
              value={returnReason}
              onChangeText={setReturnReason}
              multiline
            />
            {returnReasonError && <Text style={styles.errorText}>{returnReasonError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setReturnModalVisible(false); setReturnReason(''); setReturnReasonError(''); }}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.returnConfirmBtn, !!returningPackageId && styles.returnConfirmBtnDisabled]} 
                onPress={handleConfirmReturn}
                disabled={!!returningPackageId}
              >
                {returningPackageId ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmText}>Confirmer le Retour</Text>}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F9FAFB',
  },
  header: { 
    backgroundColor: '#111827', 
    ...DIMENSIONS.header,
    borderBottomLeftRadius: responsiveSize(24, 32), 
    borderBottomRightRadius: responsiveSize(24, 32),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
      } : {},
      android: {},
    }),
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: responsiveSize(24, 16),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        marginBottom: 0,
        flex: 1,
      } : {},
      android: {},
    }),
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.heading, 
    fontWeight: '700',
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        fontSize: FONTS.compact.subtitle,
      } : {},
      android: {},
    }),
  },
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.sm,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        gap: SPACING.md,
      } : {},
      android: {},
    }),
  },
  scanBtn: {
    padding: responsiveSize(8, 12),
    backgroundColor: '#3B82F6',
    borderRadius: BORDER_RADIUS.responsive.button,
  },
  scanText: {
    fontSize: responsiveFontSize(20, 22),
  },
  exportBtn: { 
    padding: responsiveSize(8, 12), 
    backgroundColor: '#8B5CF6', 
    borderRadius: BORDER_RADIUS.responsive.button,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        paddingHorizontal: SPACING.md,
      } : {},
      android: {},
    }),
  },
  exportText: { 
    fontSize: responsiveFontSize(20, 22),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        fontSize: 18,
      } : {},
      android: {},
    }),
  },
  refreshBtn: { 
    padding: responsiveSize(8, 12) 
  },
  refreshText: { 
    color: '#10B981', 
    fontSize: responsiveFontSize(24, 28), 
    fontWeight: '600' 
  },
  logoutBtn: { 
    padding: responsiveSize(8, 12) 
  },
  logoutText: { 
    color: '#9CA3AF', 
    fontSize: FONTS.responsive.caption 
  },
  syncStatus: { 
    marginTop: SPACING.xs 
  },
  syncIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.xs 
  },
  syncDot: { 
    fontSize: FONTS.responsive.small 
  },
  syncText: { 
    color: '#9CA3AF', 
    fontSize: FONTS.responsive.small, 
    fontWeight: '500' 
  },
  connectionError: {
    color: '#EF4444',
    fontSize: FONTS.responsive.small,
    fontWeight: '600',
    marginTop: 2,
  },
  cashBox: { 
    backgroundColor: '#10B981', 
    padding: responsiveSize(12, 14), 
    borderRadius: responsiveSize(12, 14), 
    ...RESPONSIVE_SHADOWS.card,
    marginHorizontal: SPACING.responsive.paddingHorizontal,
    marginBottom: SPACING.sm,
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center',
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        justifyContent: 'space-evenly',
        paddingHorizontal: SPACING.md,
      } : {},
      android: {},
    }),
  },
  statItem: { 
    alignItems: 'center', 
    flex: 1,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flex: 0,
        paddingHorizontal: SPACING.sm,
      } : {},
      android: {},
    }),
  },
  statLabel: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.tiny, 
    fontWeight: '600', 
    marginBottom: 2, 
    opacity: 0.9 
  },
  statValue: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.subtitle, 
    fontWeight: '700' 
  },
  statDivider: { width: 1, height: 40, backgroundColor: '#FFFFFF', opacity: 0.3 },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: FONTS.compact.body },
  
  // Compact Card Styles
  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indexNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B7280',
    marginRight: 12,
    minWidth: 30,
  },
  compactInfo: {
    flex: 1,
  },
  compactRef: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  compactCustomer: {
    fontSize: 13,
    color: '#6B7280',
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compactStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expandIcon: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 0,
  },
  
  // New Numbered List Styles
  numberedItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  numberedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  lineNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 12,
    minWidth: 25,
  },
  lineInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expandedDetails: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expandedDetailsScrollContent: {
    paddingBottom: 8,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    flex: 0,
    width: '42%',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'left',
    flexWrap: 'wrap',
  },
  actionSection: {
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  deliverBtn: {
    backgroundColor: '#3B82F6',
  },
  returnBtn: {
    backgroundColor: '#EF4444',
  },
  hideTaskBtn: {
    backgroundColor: '#6B7280',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Phone and GPS action styles
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 8,
    flexWrap: 'wrap',
  },
  phoneValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'left',
    flexWrap: 'wrap',
  },
  phoneButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 0,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  callBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
  },
  callBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
  },
  whatsappBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  gpsBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
  },
  gpsBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  clearBtn: {
    backgroundColor: '#6B7280',
    paddingHorizontal: responsivePadding(12, 14),
    paddingVertical: responsivePadding(8, 10),
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
  },
  clearBtnActive: {
    backgroundColor: '#10B981',
  },
  clearBtnText: {
    fontSize: responsiveFontSize(12, 14),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Total Price Styles
  totalPriceContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.responsive.card,
    padding: responsivePadding(16, 20),
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsivePadding(8, 12),
  },
  totalPriceLabel: {
    fontSize: responsiveFontSize(16, 18),
    fontWeight: '600',
    color: '#374151',
  },
  totalPriceValue: {
    fontSize: responsiveFontSize(18, 20),
    fontWeight: '700',
    color: '#10B981',
  },
  hiddenTasksInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: responsivePadding(8, 12),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  hiddenTasksText: {
    fontSize: responsiveFontSize(12, 14),
    color: '#6B7280',
    flex: 1,
  },
  showTasksBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: responsivePadding(12, 16),
    paddingVertical: responsivePadding(6, 8),
    borderRadius: BORDER_RADIUS.sm,
  },
  showTasksBtnText: {
    fontSize: responsiveFontSize(12, 14),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111827' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, gap: 12 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  returnConfirmBtn: { backgroundColor: '#EF4444', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  returnConfirmBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});
