import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import useAdminStore from '../../store/useAdminStore';
import { AdminReportsScreenProps } from '../../types/navigation';
import { formatDate } from '../../utils/dateFormatter';
import { useResponsiveDimensions } from '../../utils/responsive';

export default function AdminReportsScreen({ navigation }: AdminReportsScreenProps) {
  const { isLandscape } = useResponsiveDimensions();
  const adminPackages = useAdminStore((state) => state.packages);
  const adminDrivers = useAdminStore((state) => state.drivers);

  // Filters
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setHours(0,0,0,0)));
  const [endDate, setEndDate] = useState<Date>(new Date(new Date().setHours(23,59,59,999)));
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  
  // Date Picker state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const onChangeStart = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      selectedDate.setHours(0, 0, 0, 0);
      setStartDate(selectedDate);
    }
  };

  const onChangeEnd = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      selectedDate.setHours(23, 59, 59, 999);
      setEndDate(selectedDate);
    }
  };

  // Filter Data
  const filteredPackages = useMemo(() => {
    return adminPackages.filter((pkg) => {
      // Date filter on created_at (or limit_date if preferred, here using created_at for creation date as user specified)
      const pkgDate = pkg.created_at ? new Date(pkg.created_at) : null;
      if (!pkgDate) return false;

      if (pkgDate < startDate || pkgDate > endDate) {
        return false;
      }

      // Driver filter
      if (selectedDriverId !== 'all' && pkg.assigned_to !== selectedDriverId) {
        return false;
      }

      // Ignore archived? Let's include everything in the date range unless filtered out
      if (pkg.is_archived) return false; 

      return true;
    });
  }, [adminPackages, startDate, endDate, selectedDriverId]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalAmount = 0;
    let totalGrossAmount = 0;
    let deliveredCount = 0;
    let otherCount = 0;

    filteredPackages.forEach((pkg) => {
      const pkgPrice = pkg.price || 0;
      totalGrossAmount += pkgPrice;

      if (pkg.status === 'Delivered') {
        deliveredCount++;
        // If is_paid is false, the amount is collected (price), if is_paid is true, amount collected is 0 DH.
        const amount = pkg.is_paid ? 0 : pkgPrice;
        totalAmount += amount;
      } else if (pkg.status !== 'Returned') {
        otherCount++;
      }
    });

    return {
      totalPackages: filteredPackages.length,
      deliveredCount,
      otherCount,
      totalAmount,
      totalGrossAmount,
    };
  }, [filteredPackages]);

  // Group packages by driver for the report list
  const groupedByDriver = useMemo(() => {
    const groups: Record<string, typeof adminPackages> = {};
    filteredPackages.forEach((pkg) => {
      const driverId = pkg.assigned_to || 'unassigned';
      if (!groups[driverId]) {
        groups[driverId] = [];
      }
      groups[driverId].push(pkg);
    });
    return groups;
  }, [filteredPackages]);

  const exportPDF = async () => {
    if (filteredPackages.length === 0) {
      Alert.alert('Info', 'Aucun colis à exporter pour ces filtres.');
      return;
    }

    try {
      let htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              h1 { text-align: center; color: #1E293B; }
              h2 { color: #3B82F6; margin-top: 30px; border-bottom: 2px solid #E2E8F0; padding-bottom: 5px; }
              .summary { background: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
              .summary p { margin: 5px 0; font-size: 16px; font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: left; }
              th { background-color: #F1F5F9; font-weight: bold; }
              .driver-section { margin-bottom: 40px; }
              .total-row { font-weight: bold; background-color: #F8FAFC; }
            </style>
          </head>
          <body>
            <h1>Rapport des Colis</h1>
            <div class="summary">
              <p>Période : ${formatDate(startDate.toISOString())} - ${formatDate(endDate.toISOString())}</p>
              <p>Chauffeur filtré : ${selectedDriverId === 'all' ? 'Tous' : adminDrivers.find(d => d.id === selectedDriverId)?.name || 'Inconnu'}</p>
              <p>Total des colis : ${stats.totalPackages}</p>
              <p>Montant Total Collecté (Livrés à payer) : ${stats.totalAmount} DH</p>
              <p>Montant Global Indiqué (Tous les colis) : ${stats.totalGrossAmount} DH</p>
            </div>
      `;

      for (const [driverId, pkgs] of Object.entries(groupedByDriver)) {
        const driverName = driverId === 'unassigned' 
          ? 'Non assigné' 
          : adminDrivers.find(d => d.id === driverId)?.name || 'Chauffeur Inconnu';
        
        let driverTotalAmount = 0;
        let driverGrossTotal = 0;
        
        let tableRows = pkgs.map(pkg => {
          let amount = 0;
          driverGrossTotal += (pkg.price || 0);
          if (pkg.status === 'Delivered') {
             amount = pkg.is_paid ? 0 : (pkg.price || 0);
             driverTotalAmount += amount;
          }
          return `
            <tr>
              <td>${pkg.ref_number}</td>
              <td>${pkg.customer_name || '-'}</td>
              <td>${pkg.status}</td>
              <td>${pkg.price || 0} DH ${pkg.is_paid ? '(Payé)' : ''}</td>
              <td>${amount} DH</td>
            </tr>
          `;
        }).join('');

        htmlContent += `
          <div class="driver-section">
            <h2>${driverName}</h2>
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Prix Indiqué</th>
                  <th>Montant Collecté</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
                <tr class="total-row">
                  <td colspan="4" style="text-align: right;">Total Collecté pour ${driverName}:</td>
                  <td>${driverTotalAmount} DH</td>
                </tr>
                <tr class="total-row">
                  <td colspan="4" style="text-align: right;">Total Global Indiqué pour ${driverName}:</td>
                  <td>${driverGrossTotal} DH</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }

      htmlContent += `
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exporter le Rapport PDF'
        });
      } else {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil.');
      }
    } catch (error) {
      console.error('PDF Export error:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rapports & Stats</Text>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.dateRow}>
          <View style={styles.datePickerWrapper}>
            <Text style={styles.label}>Du :</Text>
            {Platform.OS === 'android' ? (
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBox}>
                <Text>{formatDate(startDate.toISOString())}</Text>
              </TouchableOpacity>
            ) : (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={onChangeStart}
              />
            )}
            {showStartPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={onChangeStart}
              />
            )}
          </View>
          
          <View style={styles.datePickerWrapper}>
            <Text style={styles.label}>Au :</Text>
            {Platform.OS === 'android' ? (
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBox}>
                <Text>{formatDate(endDate.toISOString())}</Text>
              </TouchableOpacity>
            ) : (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={onChangeEnd}
              />
            )}
            {showEndPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={onChangeEnd}
              />
            )}
          </View>
        </View>

        <Text style={styles.label}>Chauffeur :</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDriverId}
            onValueChange={(itemValue) => setSelectedDriverId(itemValue)}
          >
            <Picker.Item label="Tous les chauffeurs" value="all" />
            {adminDrivers.map((driver) => (
              <Picker.Item key={driver.id} label={driver.name} value={driver.id} />
            ))}
          </Picker>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Résumé Global</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Colis :</Text>
            <Text style={styles.statValue}>{stats.totalPackages}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Colis Livrés :</Text>
            <Text style={styles.statValue}>{stats.deliveredCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { fontWeight: 'bold' }]}>Montant Total Collecté :</Text>
            <Text style={[styles.statValue, { color: '#10B981', fontWeight: 'bold' }]}>
              {stats.totalAmount} DH
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { fontWeight: 'bold' }]}>Montant Global (Tous) :</Text>
            <Text style={[styles.statValue, { color: '#3B82F6', fontWeight: 'bold' }]}>
              {stats.totalGrossAmount} DH
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.exportButton} onPress={exportPDF}>
          <Text style={styles.exportButtonText}>📄 Exporter en PDF</Text>
        </TouchableOpacity>

        {Object.entries(groupedByDriver).map(([driverId, pkgs]) => {
          const driverName = driverId === 'unassigned' 
            ? 'Non assigné' 
            : adminDrivers.find(d => d.id === driverId)?.name || 'Chauffeur Inconnu';
          
          let driverTotalAmount = 0;
          let driverGrossTotal = 0;
          pkgs.forEach(pkg => {
            driverGrossTotal += (pkg.price || 0);
            if (pkg.status === 'Delivered') {
              driverTotalAmount += pkg.is_paid ? 0 : (pkg.price || 0);
            }
          });

          return (
            <View key={driverId} style={styles.driverSection}>
              <View style={styles.driverSectionHeader}>
                <Text style={styles.driverName}>{driverName}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.driverTotal}>{driverTotalAmount} DH (Collecté)</Text>
                  <Text style={[styles.driverTotal, { color: '#3B82F6', fontSize: 13, marginTop: 2 }]}>{driverGrossTotal} DH (Global)</Text>
                </View>
              </View>
              {pkgs.map(pkg => {
                const amount = (pkg.status === 'Delivered' && !pkg.is_paid) ? (pkg.price || 0) : 0;
                return (
                  <View key={pkg.id} style={styles.pkgRow}>
                    <View style={styles.pkgInfo}>
                      <Text style={styles.pkgRef}>{pkg.ref_number}</Text>
                      <Text style={styles.pkgStatus}>{pkg.status}</Text>
                    </View>
                    <Text style={styles.pkgAmount}>{amount > 0 ? `${amount} DH` : '-'}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  datePickerWrapper: {
    flex: 1,
    marginHorizontal: 5,
  },
  label: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 15,
    color: '#475569',
  },
  statValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  exportButton: {
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  driverSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  driverTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  pkgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pkgInfo: {
    flex: 1,
  },
  pkgRef: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  pkgStatus: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  pkgAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
