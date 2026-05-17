import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddDriverScreenProps } from '../../types/navigation';
import { DRIVER_CREDENTIALS, getActiveDrivers, generateAdminDriverId, addNewDriverCredential, storeDriverPin } from '../../config/credentials';
import useAuthStore from '../../store/useAuthStore';

const VEHICLE_TYPES = ['Moto', 'Voiture', 'Camionnette'];

export default function AddDriverScreen({ navigation }: AddDriverScreenProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [vehicle, setVehicle] = useState('Moto');
  const [zone, setZone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{name?: string; phone?: string; pin?: string}>({});


  const validateForm = (): boolean => {
    const newErrors: {name?: string; phone?: string; pin?: string} = {};
    
    if (!name.trim()) {
      newErrors.name = "Le nom est requis";
    }
    
    if (!phone.trim()) {
      newErrors.phone = "Le téléphone est requis";
    } else if (!/^0[1-9]\d{8}$/.test(phone)) {
      newErrors.phone = "Format: 06... ou 07...";
    }
    
    const trimmedPin = pin.trim();
    
    if (!trimmedPin) {
      newErrors.pin = "Le code PIN est requis";
    } else if (trimmedPin.length !== 4) {
      newErrors.pin = "Le PIN doit contenir exactement 4 chiffres";
    } else if (!/^\d+$/.test(trimmedPin)) {
      newErrors.pin = "Le PIN doit contenir uniquement des chiffres";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Sanitize PIN input - only numeric
  const handlePinChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(numericOnly);
  };

  const handleAddDriver = async () => {
    // Get trimmed values
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedPin = pin.trim();
    
    if (!validateForm()) {
      ToastAndroid.show('Veuillez corriger les erreurs', ToastAndroid.SHORT);
      return;
    }

    setLoading(true);
    let isMounted = true;
    
    // Cleanup function
    const cleanup = () => {
      isMounted = false;
    };
    
    try {
      // Generate a short driver ID (format: DRV-XXXXXX where X is alphanumeric)
      const generateShortDriverId = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking chars (0,1,I,O)
        let result = 'DRV-';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      let driverId: string = generateShortDriverId();
      
      // Store locally and queue sync
      try {
        const { storeDriverLocally, addToSyncQueue, processSyncQueue, syncDriversFromSupabase } = await import('../../utils/supabaseSync');
        const driverObj = {
          id: driverId,
          custom_id: driverId, // Use generated ID as custom_id
          name: trimmedName,
          phone: trimmedPhone,
          vehicle_type: vehicle,
          zone: zone.trim() || undefined,
          pin_code: trimmedPin,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          source: 'local' as const,
          auditLog: []
        };
        
        await storeDriverLocally(driverObj);
        
        // Queue for Supabase sync
        await addToSyncQueue({
          type: 'create',
          collection: 'drivers',
          data: driverObj
        });
        
        console.log('✅ Driver created and queued for sync:', driverId);

        // Immediately flush queue to Supabase (fire-and-forget — don't await so UI isn't blocked)
        processSyncQueue()
          .then(() => syncDriversFromSupabase())
          .catch((e: any) => console.warn('⚠️ Background sync after create failed:', e));
      } catch (localError) {
        console.warn('⚠️ Could not store driver locally:', localError);
      }

      Alert.alert(
        "Livreur Créé",
        `Le livreur a été créé avec succès.\n\nID: ${driverId}\nPIN: ${trimmedPin}`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('❌ Error creating driver:', error);
      if (isMounted) {
        Alert.alert(
          "Erreur", 
          "Impossible d'ajouter le livreur. " + (error instanceof Error ? error.message : String(error))
        );
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
      cleanup();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau Livreur</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom Complet *</Text>
            <TextInput 
              style={[styles.input, errors.name && styles.inputError]} 
              placeholder="Ex: Jean Dupont" 
              value={name} 
              onChangeText={setName} 
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone *</Text>
            <TextInput 
              style={[styles.input, errors.phone && styles.inputError]} 
              placeholder="06..." 
              keyboardType="phone-pad" 
              value={phone} 
              onChangeText={setPhone} 
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type de Véhicule *</Text>
            <View style={styles.pillsContainer}>
              {VEHICLE_TYPES.map(type => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.pill, vehicle === type && styles.pillActive]}
                  onPress={() => setVehicle(type)}
                >
                  <Text style={[styles.pillText, vehicle === type && styles.pillTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Zone (Quartier/Secteur)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: Maarif, Centre Ville, etc." 
              value={zone} 
              onChangeText={setZone} 
            />
            <Text style={styles.helperText}>Aide à l'assignation des colis par secteur.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code PIN (Sécurité) *</Text>
            <TextInput 
              style={[styles.input, errors.pin && styles.inputError]} 
              placeholder="1234" 
              keyboardType="numeric" 
              secureTextEntry
              maxLength={4}
              value={pin} 
              onChangeText={handlePinChange}
              contextMenuHidden={true}
              autoComplete="off"
            />
            <Text style={styles.pinCounter}>{pin.length}/4 chiffres</Text>
            {errors.pin && <Text style={styles.errorText}>{errors.pin}</Text>}
            <Text style={styles.helperText}>Ce code sera exigé lors de la connexion du livreur.</Text>
          </View>



          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleAddDriver} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Créer le Livreur</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollContent: { padding: 20, paddingTop: 30, paddingBottom: 100, flexGrow: 1 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827',
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  pinCounter: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'right' },
  helperText: { fontSize: 12, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },
  pillsContainer: { flexDirection: 'row', gap: 10 },
  pill: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF'
  },
  pillActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  pillText: { color: '#4B5563', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },
  submitBtn: { backgroundColor: '#111827', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, minHeight: 50 },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  
  // Firebase fallback styles
  warningText: { color: '#F59E0B', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  idContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  idOption: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  idOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  idText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 14,
  },
  idTextSelected: {
    color: '#FFFFFF',
  },
});
