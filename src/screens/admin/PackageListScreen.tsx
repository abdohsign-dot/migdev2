import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, ScrollView, Platform, Image } from 'react-native';
import Share from 'react-native-share';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalDatabase } from '../../hooks/useLocalDatabase';
import useAdminStore from '../../store/useAdminStore';
import PackageCard from '../../components/PackageCard';
import { QRCodeComponent } from '../../components/QRCodeComponent';
import { extractQRData, generateQRString } from '../../utils/qrGenerator';
import { getPackageDisplayRef } from '../../utils/packageUtils';
import { formatDate } from '../../utils/dateFormatter';

interface PackageListScreenProps {
  navigation: any;
}

export default function PackageListScreen({ navigation }: PackageListScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInstanceKey, setModalInstanceKey] = useState(0);
  
  const { packages: localPackages = [], drivers: localDrivers = [], loading: localLoading = false, syncing = false, refresh, assignPackageToDriver } = useLocalDatabase({ isAdmin: true });
  const adminPackages = useAdminStore((state) => state.packages);
  const adminDrivers = useAdminStore((state) => state.drivers);
  const setAdminPackages = useAdminStore((state) => state.setPackages);
  const setAdminDrivers = useAdminStore((state) => state.setDrivers);
  const setAdminLoading = useAdminStore((state) => state.setLoading);

  useEffect(() => {
    setAdminPackages(localPackages);
    setAdminDrivers(localDrivers);
    setAdminLoading(localLoading);
  }, [localPackages, localDrivers, localLoading, setAdminPackages, setAdminDrivers, setAdminLoading]);

  useEffect(() => {
    console.log('📋 PackageListScreen mounted');
    console.log('📦 Packages loaded:', adminPackages?.length || 0);
  }, [adminPackages]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleAssignPackage = useCallback(async (packageId: string) => {
    try {
      navigation.navigate('DriverList', { 
        mode: 'assign', 
        packageId,
        onAssign: async (driverId: string) => {
          await assignPackageToDriver([packageId], driverId);
          navigation.goBack();
        }
      });
    } catch (err: any) {
      console.error('Error assigning package:', err);
      setError(err?.message || 'Erreur lors de l\'assignation du colis');
    }
  }, [navigation, assignPackageToDriver]);

  const filteredPackages = filterStatus === 'all' 
    ? adminPackages
    : adminPackages.filter(p => p.status === filterStatus);

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

  const sortedPackages = React.useMemo(() => {
    return [...filteredPackages].sort((a: any, b: any) => {
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
  }, [filteredPackages]);

  const statusOptions = ['all', 'Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned'];
  
  const statusLabels: Record<string, string> = {
    'all': 'Tous',
    'Pending': 'En attente',
    'Assigned': 'Assigné',
    'In Transit': 'En cours',
    'Delivered': 'Livré',
    'Returned': 'Retourné'
  };
  const formatWeight = (w: any) => {
    if (!w && w !== 0) return 'N/A';
    const s = String(w).trim();
    if (s === '') return 'N/A';
    return /kg$/i.test(s) ? s : `${s} kg`;
  };

  const getReceiptText = (pkg: any) => {
    return `----------------------------------
DÉTAILS DU COLIS
----------------------------------
RÉFÉRENCE : ${getPackageDisplayRef(pkg)}
DATE CRÉA : ${formatDate(pkg.created_at)}
----------------------------------

EXPÉDITEUR
----------
Nom       : ${pkg.sender_name || 'N/A'}
Société   : ${pkg.sender_company || 'N/A'}
Téléphone : ${pkg.sender_phone || 'N/A'}
Date arr. : ${formatDate(pkg.date_of_arrive) || 'N/A'}
Infos supp: ${pkg.supplement_info || 'N/A'}

DESTINATAIRE
------------
Nom       : ${pkg.customer_name || 'N/A'}
Adresse   : ${pkg.customer_address || 'N/A'}
Téléphone : ${pkg.customer_phone || 'N/A'}${pkg.customer_phone_2 ? '\nTél 2     : ' + pkg.customer_phone_2 : ''}
GPS       : ${pkg.gps_lat && pkg.gps_lng ? `${pkg.gps_lat}, ${pkg.gps_lng}` : 'N/A'}

DÉTAILS COLIS
-------------
Poids     : ${formatWeight(pkg.weight)}
Prix      : ${pkg.is_paid ? 'Payé' : ((pkg.price || 0) + ' DH')}
Statut    : ${statusLabels[pkg.status] || pkg.status}
Date lim. : ${formatDate(pkg.limit_date) || 'N/A'}${pkg.limit_time ? ` ${pkg.limit_time}` : ''}
Notes     : ${pkg.description || 'Aucune'}
----------------------------------`;
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ Erreur: {error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setError(null);
              navigation.goBack();
            }}
          >
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liste des Colis</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <View style={styles.filterBar}>
        {statusOptions.map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterBtn, filterStatus === status && styles.filterBtnActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
              {statusLabels[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total : <Text style={styles.summaryBold}>{sortedPackages.length}</Text> colis
        </Text>
      </View>

      {adminLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : filteredPackages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucun colis</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={sortedPackages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.packageRow}
              onPress={() => {
                setSelectedPkg(item);
                setModalInstanceKey(k => k + 1);
                setModalVisible(true);
              }}
            >
              <Text style={styles.rowRef}>{item.ref_number}</Text>
              <Text style={styles.rowCustomer} numberOfLines={1}>{item.customer_name || 'Client Inconnu'}</Text>
              <View style={[styles.rowStatusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.rowStatusText}>{statusLabels[item.status] || item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={syncing} onRefresh={refresh} colors={['#3B82F6']} />
          }
        />
      )}

      {/* Printable Text Modal */}
      <Modal
        key={modalInstanceKey}
        visible={modalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom']}>
          <View style={[styles.modalContent, { height: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails à imprimer</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  onPress={async () => {
                    if (!selectedPkg) return;

                    const receiptText = getReceiptText(selectedPkg);
                    const qrData = extractQRData(selectedPkg);
                    const qrString = generateQRString(qrData);

                    const qr = qrRef.current;

                    try {
                      if (qr?.toDataURL) {
                        const dataUrl: string | undefined = await qr.toDataURL();
                        if (dataUrl) {
                          await Share.open({
                            title: 'Exporter le QR',
                            url: dataUrl,
                            type: 'image/png',
                            message: `📦 ${selectedPkg.ref_number}`,
                          });
                          return;
                        }
                      }
                    } catch (e) {
                      console.log('QR image export failed, falling back to text share:', e);
                    }

                    const fallbackMessage =
                      `${receiptText}\n\n` +
                      `QR_DATA (à régénérer) :\n${qrString}`;

                    await Share.open({
                      title: 'Exporter',
                      message: fallbackMessage || 'Exporter',
                    });
                  }}
                  style={[styles.closeBtn, { backgroundColor: '#3B82F6', marginRight: 8 }]}
                >
                  <Text style={styles.closeBtnText}>Exporter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    setModalInstanceKey(k => k + 1);
                  }}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.printableContainer}
              contentContainerStyle={styles.printableScrollContent}
              nestedScrollEnabled={true}
              alwaysBounceVertical={true}
              showsVerticalScrollIndicator={true}
            >
              {selectedPkg && (
                <>
                  <Text selectable={true} style={styles.printableText}>
                    {`----------------------------------
DÉTAILS DU COLIS
----------------------------------
RÉFÉRENCE : ${selectedPkg.ref_number}
DATE CRÉA : ${formatDate(selectedPkg.created_at)}
----------------------------------

EXPÉDITEUR
----------
Nom       : ${selectedPkg.sender_name || 'N/A'}
Société   : ${selectedPkg.sender_company || 'N/A'}
Téléphone : ${selectedPkg.sender_phone || 'N/A'}
Date arr. : ${formatDate(selectedPkg.date_of_arrive) || 'N/A'}
Infos supp: ${selectedPkg.supplement_info || 'N/A'}

DESTINATAIRE
------------
Nom       : ${selectedPkg.customer_name || 'N/A'}
Adresse   : ${selectedPkg.customer_address || 'N/A'}
Téléphone : ${selectedPkg.customer_phone || 'N/A'}${selectedPkg.customer_phone_2 ? '\nTél 2     : ' + selectedPkg.customer_phone_2 : ''}
GPS       : ${selectedPkg.gps_lat && selectedPkg.gps_lng ? `${selectedPkg.gps_lat}, ${selectedPkg.gps_lng}` : 'N/A'}

DÉTAILS COLIS
-------------
  Poids     : ${formatWeight(selectedPkg.weight)}
Prix      : ${selectedPkg.is_paid ? 'Payé' : ((selectedPkg.price || 0) + ' DH')}
Statut    : ${statusLabels[selectedPkg.status] || selectedPkg.status}
Date lim. : ${formatDate(selectedPkg.limit_date) || 'N/A'}${selectedPkg.limit_time ? ` ${selectedPkg.limit_time}` : ''}
Notes     : ${selectedPkg.description || 'Aucune'}
----------------------------------`}
                  </Text>

                  {/* QR right after the end text so it doesn't float at the bottom */}
                  <View style={styles.qrContainer}>
                    <QRCodeComponent
                      key={modalInstanceKey}
                      data={selectedPkg}
                      size={200}
                      getRef={(ref: any) => {
                        qrRef.current = ref;
                      }}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      Pending: '#9CA3AF',
      Assigned: '#3B82F6',
      'In Transit': '#F59E0B',
      Delivered: '#10B981',
      Returned: '#EF4444',
      Archived: '#8B5CF6'
    };
    return colors[status] || '#6B7280';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8 },
  backText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 24, color: '#3B82F6' },
  
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    marginBottom: 8,
  },
  filterBtnActive: {
    backgroundColor: '#3B82F6',
  },
  filterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  
  summary: {
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  summaryText: { fontSize: 14, color: '#1E40AF' },
  summaryBold: { fontWeight: '800', fontSize: 18 },
  list: { flex: 1 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 16 },
  listContent: { padding: 16 },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Row styles
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rowRef: {
    fontWeight: '700',
    color: '#111827',
    width: 95,
  },
  rowCustomer: {
    flex: 1,
    color: '#4B5563',
    marginHorizontal: 8,
    textAlign: 'center',
    paddingLeft: 20,
  },
  rowStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rowStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '100%',
    // Important: do not clip content, otherwise QR at the bottom can get cut off on some devices
    overflow: 'visible',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  printableContainer: {
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  printableScrollContent: {
    padding: 20,
    paddingBottom: 120,
    alignItems: 'stretch',
    flexGrow: 1,
  },
  printableText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
    width: '100%',
    marginBottom: 0,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backgroundColor: '#FFFFFF',
    marginBottom: 0,
    width: '100%',
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
});