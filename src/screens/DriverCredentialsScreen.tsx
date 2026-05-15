/**
 * Driver Credentials Screen
 * 
 * Admin-only screen to view and manage the 20 pre-generated driver credentials.
 * Shows ID, PIN, and allows admin to assign name/phone to each credential.
 * Assignments are stored locally in encrypted storage.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ToastAndroid, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setSecureItem, getSecureItem, SECURE_KEYS } from '../utils/secureStorage';
import { DRIVER_CREDENTIALS, DriverCredential } from '../config/credentials';

interface DriverCredentialsScreenProps {
  navigation: any;
}

interface DriverAssignment {
  id: string;
  name: string;
  phone: string;
  assigned_at: string;
}

const ASSIGNMENTS_KEY = SECURE_KEYS.DRIVER_ASSIGNMENTS;

export default function DriverCredentialsScreen({ navigation }: DriverCredentialsScreenProps) {
  const [drivers] = useState<DriverCredential[]>(DRIVER_CREDENTIALS);
  const [assignments, setAssignments] = useState<Map<string, DriverAssignment>>(new Map());
  const [loading, setLoading] = useState(true);
  
  // Assignment Modal State
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Load assignments from encrypted storage
  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const stored = await getSecureItem(ASSIGNMENTS_KEY);
      if (stored) {
        const map = new Map<string, DriverAssignment>(Object.entries(stored));
        setAssignments(map);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAssignments = async (newAssignments: Map<string, DriverAssignment>) => {
    try {
      const obj = Object.fromEntries(newAssignments);
      await setSecureItem(ASSIGNMENTS_KEY, obj);
      setAssignments(newAssignments);
      
    } catch (error) {
      console.error('Error saving assignments:', error);
      
      throw error;
    }
  };

  const openAssignModal = (driverId: string) => {
    const existing = assignments.get(driverId);
    setSelectedDriverId(driverId);
    setDriverName(existing?.name || '');
    setDriverPhone(existing?.phone || '');
    setAssignModalVisible(true);
  };

  const handleAssign = async () => {
    if (!selectedDriverId) return;

    if (!driverName.trim()) {
      ToastAndroid.show('Le nom est requis', ToastAndroid.SHORT);
      return;
    }

    if (!driverPhone.trim()) {
      ToastAndroid.show('Le téléphone est requis', ToastAndroid.SHORT);
      return;
    }

    setSaving(true);
    try {
      const newAssignments = new Map(assignments);
      newAssignments.set(selectedDriverId, {
        id: selectedDriverId,
        name: driverName.trim(),
        phone: driverPhone.trim(),
        assigned_at: new Date().toISOString(),
      });

      await saveAssignments(newAssignments);
      
      setAssignModalVisible(false);
      setSelectedDriverId(null);
      setDriverName('');
      setDriverPhone('');
      ToastAndroid.show('Livreur assigné avec succès', ToastAndroid.SHORT);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'assignation');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = (driverId: string) => {
    Alert.alert(
      'Retirer l\'assignation',
      'Voulez-vous retirer ce livreur?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              const newAssignments = new Map(assignments);
              newAssignments.delete(driverId);
              await saveAssignments(newAssignments);
              ToastAndroid.show('Assignation retirée', ToastAndroid.SHORT);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de retirer l\'assignation');
            }
          }
        }
      ]
    );
  };

  const toggleDriverStatus = (driverId: string) => {
    Alert.alert(
      'Changer le Statut',
      'Voulez-vous activer/désactiver ce livreur?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            // Note: This is local state only, not persisted
            // In production, you'd want to persist this to AsyncStorage too
            const driver = drivers.find(d => d.id === driverId);
            if (driver) {
              driver.is_active = !driver.is_active;
              ToastAndroid.show(
                driver.is_active ? 'Livreur activé' : 'Livreur désactivé',
                ToastAndroid.SHORT
              );
            }
          }
        }
      ]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    ToastAndroid.show(`${label}: ${text}`, ToastAndroid.LONG);
  };

  const renderDriverCard = ({ item }: { item: DriverCredential }) => {
    const assignment = assignments.get(item.id);
    const isAssigned = !!assignment;

    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.driverId}>{item.id}</Text>
            <View style={[styles.statusBadge, isAssigned ? styles.statusAssigned : styles.statusUnassigned]}>
              <Text style={styles.statusText}>
                {isAssigned ? '✓ Assigné' : '○ Disponible'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Code PIN:</Text>
            <View style={styles.pinContainer}>
              <Text style={styles.pinValue}>****</Text>
              <Text style={styles.pinNote}>PIN hidden for security</Text>
            </View>
          </View>

          {isAssigned && assignment ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nom:</Text>
                <Text style={styles.infoValue}>{assignment.name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Téléphone:</Text>
                <Text style={styles.infoValue}>{assignment.phone}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity 
                  style={styles.editBtn}
                  onPress={() => openAssignModal(item.id)}
                >
                  <Text style={styles.editBtnText}>✏️ Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.unassignBtn}
                  onPress={() => handleUnassign(item.id)}
                >
                  <Text style={styles.unassignBtnText}>✕ Retirer</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.assignBtn}
              onPress={() => openAssignModal(item.id)}
            >
              <Text style={styles.assignBtnText}>+ Assigner à un Livreur</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const assignedCount = assignments.size;
  const availableCount = drivers.length - assignedCount;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identifiants Livreurs</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{drivers.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, styles.assignedLabel]}>Assignés</Text>
          <Text style={[styles.summaryValue, styles.assignedValue]}>{assignedCount}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, styles.availableLabel]}>Disponibles</Text>
          <Text style={[styles.summaryValue, styles.availableValue]}>{availableCount}</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>ℹ️ Information</Text>
        <Text style={styles.infoBoxText}>
          Assignez un ID à un livreur en ajoutant son nom et téléphone. 
          Le livreur pourra se connecter avec l'ID et le PIN que vous lui communiquez.
        </Text>
        <Text style={[styles.infoBoxText, { marginTop: 8, fontWeight: '600' }]}>
          💡 Si les 20 IDs sont tous assignés, vous pouvez créer des livreurs supplémentaires via "👤 Livreurs" → "+ Ajouter Livreur".
        </Text>
      </View>

      <FlatList
        data={drivers}
        keyExtractor={(item) => item.id}
        renderItem={renderDriverCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Assignment Modal */}
      <Modal visible={assignModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {assignments.get(selectedDriverId || '') ? 'Modifier' : 'Assigner'} {selectedDriverId}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom du Livreur *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Ahmed Benali"
                placeholderTextColor="#9CA3AF"
                value={driverName}
                onChangeText={setDriverName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Téléphone *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 0612345678"
                placeholderTextColor="#9CA3AF"
                value={driverPhone}
                onChangeText={setDriverPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setAssignModalVisible(false);
                  setSelectedDriverId(null);
                  setDriverName('');
                  setDriverPhone('');
                }}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]} 
                onPress={handleAssign}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmText}>
                    {assignments.get(selectedDriverId || '') ? 'Modifier' : 'Assigner'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 40,
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 60,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  assignedLabel: {
    color: '#059669',
  },
  assignedValue: {
    color: '#059669',
  },
  availableLabel: {
    color: '#3B82F6',
  },
  availableValue: {
    color: '#3B82F6',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    margin: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInactive: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverId: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusAssigned: {
    backgroundColor: '#D1FAE5',
  },
  statusUnassigned: {
    backgroundColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  cardBody: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  pinValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  pinContainer: {
    alignItems: 'center',
    gap: 2,
  },
  pinNote: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  assignBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  unassignBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  unassignBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    padding: 12,
  },
  cancelText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
