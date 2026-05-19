import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AddPackageScreenProps } from '../../types/navigation';
import { validatePackageData, validateNumber, validateCoordinates, sanitizeInput } from '../../utils/inputValidation';
import { useRoute } from '@react-navigation/native';
import useAdminStore from '../../store/useAdminStore';
import { formatDate as formatDateUtil, formatDateISO, parseDateString } from '../../utils/dateFormatter';
import type { Package } from '../../types';

export default function AddPackageScreen({ navigation }: AddPackageScreenProps) {
  const route = useRoute();
  const scannedData = (route.params as any)?.scannedData;
  const addAdminPackage = useAdminStore((state) => state.addPackage);

  // Date picker states
  const [showDateOfArrivePicker, setShowDateOfArrivePicker] = useState(false);
  const [showLimitDatePicker, setShowLimitDatePicker] = useState(false);
  const [showLimitTimePicker, setShowLimitTimePicker] = useState(false);
  
  // Time picker scroll refs
  const hoursScrollRef = useRef<FlatList>(null);
  const minutesScrollRef = useRef<FlatList>(null);

  // Core Identifiers
  const [senderName, setSenderName] = useState(scannedData?.sender_name || '');
  const [senderCompany, setSenderCompany] = useState(scannedData?.sender_company || '');
  const [senderPhone, setSenderPhone] = useState(scannedData?.sender_phone || '');
  const [dateOfArrive, setDateOfArrive] = useState<Date | null>(scannedData?.date_of_arrive ? new Date(scannedData.date_of_arrive) : null);
  const [supplementInfo, setSupplementInfo] = useState(scannedData?.supplement_info || '');

  // Customer Info
  const [customerName, setCustomerName] = useState(scannedData?.customer_name || '');
  const [address, setAddress] = useState(scannedData?.customer_address || '');
  const [phone1, setPhone1] = useState(scannedData?.customer_phone || '');
  const [phone2, setPhone2] = useState(scannedData?.customer_phone_2 || '');

  // Package Details
  const [weight, setWeight] = useState(scannedData?.weight || '');
  const [description, setDescription] = useState(scannedData?.description || '');
  const [limitDate, setLimitDate] = useState<Date | null>(scannedData?.limit_date ? new Date(scannedData.limit_date) : null);
  const [limitTime, setLimitTime] = useState(scannedData?.limit_time || '');
  const [selectedHours, setSelectedHours] = useState<number>(
    scannedData?.limit_time 
      ? parseInt(scannedData.limit_time.split(':')[0]) || 0
      : 0
  );
  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    scannedData?.limit_time 
      ? parseInt(scannedData.limit_time.split(':')[1]) || 0
      : 0
  );
  const [price, setPrice] = useState(scannedData?.price?.toString() || '');
  const [isPaid, setIsPaid] = useState(scannedData?.is_paid || false);

  // Format date to DD/MM/YYYY string using centralized utility
  const formatDate = (date: Date | null): string => {
    return formatDateUtil(date) || '';
  };

  // Format date to YYYY-MM-DD string for storage using centralized utility
  const formatDateForStorage = (date: Date | null): string => {
    return formatDateISO(date);
  };

  // Format time to HH:mm string (24-hour format)
  const formatTimeDisplay = (): string => {
    return `${String(selectedHours).padStart(2, '0')}:${String(selectedMinutes).padStart(2, '0')}`;
  };

  // Handle payment status change
  const handlePaymentStatusChange = (value: boolean) => {
    setIsPaid(value);
    if (value) {
      setPrice('0'); // Clear price when marked as paid
    }
  };
  
  // GPS (Manual for now)
  const [gpsLat, setGpsLat] = useState(scannedData?.gps_lat?.toString() || '');
  const [gpsLng, setGpsLng] = useState(scannedData?.gps_lng?.toString() || '');

  const [loading, setLoading] = useState(false);

  // Show indicator if data was scanned
  const isFromScan = !!scannedData;

  const handleAddPackage = async () => {
    // Sanitize all inputs first
    const sanitizedData = {
      sender_name: sanitizeInput(senderName),
      sender_company: sanitizeInput(senderCompany),
      sender_phone: sanitizeInput(senderPhone),
      date_of_arrive: formatDateForStorage(dateOfArrive),
      supplement_info: sanitizeInput(supplementInfo),
      customer_name: sanitizeInput(customerName),
      customer_address: sanitizeInput(address),
      customer_phone: sanitizeInput(phone1),
      customer_phone_2: sanitizeInput(phone2),
      weight: sanitizeInput(weight),
      description: sanitizeInput(description),
      gps_lat: sanitizeInput(gpsLat),
      gps_lng: sanitizeInput(gpsLng),
      limit_date: formatDateForStorage(limitDate),
      limit_time: sanitizeInput(limitTime),
      price: sanitizeInput(price),
      is_paid: isPaid,
    };

    // Validate package data comprehensively
    const validation = validatePackageData(sanitizedData);
    
    if (!validation.isValid) {
      Alert.alert("Erreur de validation", validation.error || "Veuillez corriger les erreurs dans le formulaire.");
      return;
    }

    // Additional validation for price if not paid
    if (!isPaid) {
      const priceValidation = validateNumber(sanitizedData.price, {
        required: true,
        minLength: 0.01,
        maxLength: 999999.99
      });
      
      if (!priceValidation.isValid) {
        Alert.alert("Erreur", priceValidation.error || "Le prix doit être un nombre positif.");
        return;
      }
    }

    // Validate GPS coordinates if provided
    if (sanitizedData.gps_lat || sanitizedData.gps_lng) {
      const coordValidation = validateCoordinates(sanitizedData.gps_lat, sanitizedData.gps_lng);
      if (!coordValidation.isValid) {
        Alert.alert("Erreur", coordValidation.error || "Coordonnées GPS invalides.");
        return;
      }
    }

    // Set default deadline date if not provided; do NOT default time
    const finalLimitDate = sanitizedData.limit_date || new Date().toISOString().split('T')[0];
    const finalLimitTime = sanitizedData.limit_time || undefined;

    setLoading(true);
    try {
      // Import the local database functions
      const { createPackage } = await import('../../utils/localDatabase');

      const timestamp = new Date().toISOString();

      // Generate PKG-xxxxxx format
      const generatePackageRef = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `PKG-${result}`;
      };



      // Create package with validated and sanitized data
      // Note: created_at, updated_at, and version are auto-set by createPackage()
      const newPackage: Package = {
        id: `PKG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        ref_number: generatePackageRef(), // Use PKG-xxxxxx format
        status: "Pending",
        sender_name: sanitizedData.sender_name || undefined,
        sender_company: sanitizedData.sender_company || undefined,
        sender_phone: sanitizedData.sender_phone || undefined,
        date_of_arrive: sanitizedData.date_of_arrive || undefined,
        supplement_info: sanitizedData.supplement_info || undefined,
        customer_name: sanitizedData.customer_name,
        customer_address: sanitizedData.customer_address || undefined,
        customer_phone: sanitizedData.customer_phone || undefined,
        customer_phone_2: sanitizedData.customer_phone_2 || undefined,
        weight: sanitizedData.weight || undefined,
        description: sanitizedData.description || undefined,
        gps_lat: sanitizedData.gps_lat ? parseFloat(sanitizedData.gps_lat) : undefined,
        gps_lng: sanitizedData.gps_lng ? parseFloat(sanitizedData.gps_lng) : undefined,
        limit_date: finalLimitDate,
        ...(finalLimitTime ? { limit_time: finalLimitTime } : {}),
        price: isPaid ? 0 : parseFloat(sanitizedData.price),
        is_paid: isPaid,
        assigned_to: undefined,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        hidden_by_driver: false,
        assigned_at: undefined,
        accepted_at: undefined,
        delivered_at: undefined,
        return_reason: undefined,
        statusHistory: [],
      };

      const createdPackage = await createPackage(newPackage);
      addAdminPackage(createdPackage);

      Alert.alert("Succès", "Colis créé avec succès !");
      navigation.goBack();
    } catch (error) {
      console.error('Package creation error:', error);
      Alert.alert("Erreur", "Impossible de créer le colis. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Nouveau Colis</Text>
            {isFromScan && <Text style={styles.scanIndicator}>📷 Données scannées</Text>}
          </View>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>1. Informations Générales</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expéditeur (Nom) *</Text>
            <TextInput style={styles.input} placeholder="Ex: Jean Dupont" value={senderName} onChangeText={setSenderName} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Entreprise Expéditeur (Optionnel)</Text>
            <TextInput style={styles.input} placeholder="Ex: Boutique Paris" value={senderCompany} onChangeText={setSenderCompany} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Téléphone Expéditeur</Text>
              <TextInput style={styles.input} placeholder="06..." keyboardType="phone-pad" value={senderPhone} onChangeText={setSenderPhone} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Date d'arrivée</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.input, styles.dateTextInput]}
                  placeholder="JJ/MM/AAAA"
                  value={formatDate(dateOfArrive)}
                  onChangeText={(text) => {
                    if (!text || text.trim() === '') {
                      setDateOfArrive(null);
                      return;
                    }
                    // Parse DD/MM/YYYY to Date
                    const parts = text.split('/');
                    if (parts.length === 3) {
                      const day = parseInt(parts[0]);
                      const month = parseInt(parts[1]) - 1;
                      const year = parseInt(parts[2]);
                      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        setDateOfArrive(new Date(year, month, day));
                      }
                    }
                  }}
                />
                <TouchableOpacity style={styles.calendarButton} onPress={() => setShowDateOfArrivePicker(true)}>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Infos Supplémentaires</Text>
            <TextInput style={styles.input} placeholder="Ex: Informations..." value={supplementInfo} onChangeText={setSupplementInfo} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du Client *</Text>
            <TextInput style={styles.input} placeholder="Ex: Jean Dupont" value={customerName} onChangeText={setCustomerName} />
          </View>

          <Text style={styles.sectionTitle}>2. Contact & Localisation</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse de Livraison</Text>
            <TextInput style={styles.input} placeholder="Ex: 10 Rue de la Paix" value={address} onChangeText={setAddress} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Téléphone 1</Text>
              <TextInput style={styles.input} placeholder="06..." keyboardType="phone-pad" value={phone1} onChangeText={setPhone1} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Téléphone 2 (Optionnel)</Text>
              <TextInput style={styles.input} placeholder="07..." keyboardType="phone-pad" value={phone2} onChangeText={setPhone2} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>GPS Latitude</Text>
              <TextInput style={styles.input} placeholder="48.8566" keyboardType="numbers-and-punctuation" value={gpsLat} onChangeText={setGpsLat} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>GPS Longitude</Text>
              <TextInput style={styles.input} placeholder="2.3522" keyboardType="numbers-and-punctuation" value={gpsLng} onChangeText={setGpsLng} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>3. Détails du Colis</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} placeholder="Ex: Vêtements fragiles" value={description} onChangeText={setDescription} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Poids</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput 
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="Ex: 2.5" 
                  value={weight} 
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                />
                {weight && <Text style={styles.inputSuffix}>Kg</Text>}
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Date Limite *</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.input, styles.dateTextInput]}
                  placeholder="JJ/MM/AAAA"
                  value={formatDate(limitDate)}
                  onChangeText={(text) => {
                    if (!text || text.trim() === '') {
                      setLimitDate(null);
                      return;
                    }
                    // Parse DD/MM/YYYY to Date
                    const parts = text.split('/');
                    if (parts.length === 3) {
                      const day = parseInt(parts[0]);
                      const month = parseInt(parts[1]) - 1;
                      const year = parseInt(parts[2]);
                      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        setLimitDate(new Date(year, month, day));
                      }
                    }
                  }}
                />
                <TouchableOpacity style={styles.calendarButton} onPress={() => setShowLimitDatePicker(true)}>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Heure Limite (HH:mm)</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.input, styles.dateTextInput]}
                placeholder="HH:mm"
                value={limitTime || ''}
                editable={false}
              />
              <TouchableOpacity style={styles.calendarButton} onPress={() => setShowLimitTimePicker(true)}>
                <Text style={styles.calendarIcon}>🕐</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>4. Facturation</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Montant (DH) {!isPaid && '*'}</Text>
            <TextInput 
              style={[styles.input, isPaid && styles.inputDisabled]} 
              placeholder="Ex: 50.00" 
              keyboardType="numeric" 
              value={price} 
              onChangeText={setPrice}
              editable={!isPaid}
            />
            {isPaid && <Text style={styles.disabledNote}>Montant non requis si déjà payé</Text>}
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Déjà Payé (Pas de COD)</Text>
            <Switch
              value={isPaid}
              onValueChange={handlePaymentStatusChange}
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
            />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleAddPackage} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Créer le Colis</Text>}
          </TouchableOpacity>
          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date pickers */}
      {showDateOfArrivePicker && (
        <DateTimePicker
          value={dateOfArrive || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDateOfArrivePicker(false);
            if (selectedDate) {
              setDateOfArrive(selectedDate);
            }
          }}
        />
      )}

      {showLimitDatePicker && (
        <DateTimePicker
          value={limitDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowLimitDatePicker(false);
            if (selectedDate) {
              setLimitDate(selectedDate);
            }
          }}
        />
      )}

      {/* Custom Scrollable Time Picker */}
      <Modal
        visible={showLimitTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLimitTimePicker(false)}
      >
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Sélectionner l'heure</Text>
              <TouchableOpacity onPress={() => setShowLimitTimePicker(false)}>
                <Text style={styles.timePickerClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerContent}>
              {/* Hours Scroller */}
              <View style={styles.scrollerColumn}>
                <Text style={styles.scrollerLabel}>Heures</Text>
                <FlatList
                  ref={hoursScrollRef}
                  data={Array.from({ length: 24 }, (_, i) => i)}
                  keyExtractor={(item) => `hour-${item}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.scrollerItem,
                        selectedHours === item && styles.scrollerItemSelected,
                      ]}
                      onPress={() => setSelectedHours(item)}
                    >
                      <Text
                        style={[
                          styles.scrollerItemText,
                          selectedHours === item && styles.scrollerItemTextSelected,
                        ]}
                      >
                        {String(item).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  initialScrollIndex={selectedHours}
                  getItemLayout={(data, index) => ({
                    length: 40,
                    offset: 40 * index,
                    index,
                  })}
                />
              </View>

              {/* Separator */}
              <Text style={styles.timeSeparator}>:</Text>

              {/* Minutes Scroller */}
              <View style={styles.scrollerColumn}>
                <Text style={styles.scrollerLabel}>Minutes</Text>
                <FlatList
                  ref={minutesScrollRef}
                  data={Array.from({ length: 60 }, (_, i) => i)}
                  keyExtractor={(item) => `minute-${item}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.scrollerItem,
                        selectedMinutes === item && styles.scrollerItemSelected,
                      ]}
                      onPress={() => setSelectedMinutes(item)}
                    >
                      <Text
                        style={[
                          styles.scrollerItemText,
                          selectedMinutes === item && styles.scrollerItemTextSelected,
                        ]}
                      >
                        {String(item).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  initialScrollIndex={selectedMinutes}
                  getItemLayout={(data, index) => ({
                    length: 40,
                    offset: 40 * index,
                    index,
                  })}
                />
              </View>
            </View>

            <View style={styles.timePickerFooter}>
              <TouchableOpacity
                style={styles.timePickerCancelBtn}
                onPress={() => setShowLimitTimePicker(false)}
              >
                <Text style={styles.timePickerCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timePickerConfirmBtn}
                onPress={() => {
                  setLimitTime(formatTimeDisplay());
                  setShowLimitTimePicker(false);
                }}
              >
                <Text style={styles.timePickerConfirmText}>Confirmer</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  backText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scanIndicator: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 100, flexGrow: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginTop: 16, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
  },
  dateInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  dateTextInput: {
    flex: 1, marginRight: 8,
  },
  calendarButton: {
    padding: 8,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  inputSuffix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 15, color: '#111827',
  },
  calendarIcon: {
    fontSize: 18,
  },
  switchGroup: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 32, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  submitBtn: { backgroundColor: '#111827', paddingVertical: 16, borderRadius: 12, alignItems: 'center', minHeight: 50, marginTop: 20 },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  disabledNote: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  // Time Picker Styles
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingBottom: 12,
    width: '85%',
    maxHeight: '50%',
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  timePickerClose: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  timePickerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    height: 160,
  },
  scrollerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  scrollerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  scrollerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  scrollerItemSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  scrollerItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  scrollerItemTextSelected: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 6,
  },
  timePickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  timePickerCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  timePickerConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  timePickerConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
