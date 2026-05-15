import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddDriverScreenProps } from '../types/navigation';
import { DRIVER_CREDENTIALS, getActiveDrivers, generateAdminDriverId, addNewDriverCredential, storeDriverPin } from '../config/credentials';
import useAuthStore from '../store/useAuthStore';

const VEHICLE_TYPES = ['Moto', 'Voiture', 'Camionnette'];

export default function AddDriverScreen({ navigation }: AddDriverScreenProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [vehicle, setVehicle] = useState('Moto');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{name?: string; phone?: string; pin?: string}>({});
  const [firebaseAvailable, setFirebaseAvailable] = useState(true);
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const { userRole } = useAuthStore();
  const isAdmin = userRole === 'admin';

  // Get available driver IDs from stored credentials
  React.useEffect(() => {
    const activeDrivers = getActiveDrivers();
    const usedIds = activeDrivers.map(d => d.id);
    const available = DRIVER_CREDENTIALS
      .filter(d => !usedIds.includes(d.id))
      .map(d => d.id);
    setAvailableIds(available);
    if (available.length > 0) {
      setSelectedId(available[0]);
    }
  }, []);

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
      let useFirebase = false;
      
      // IMPORTANT: Admin-created drivers should NEVER use pre-stored IDs
      // Pre-stored IDs (DRV-001 to DRV-020) are ONLY for pre-configured drivers
      
      let firebaseError: any = null;
      
      // STRATEGY: Only sync to Firestore if admin is logged in
      // Otherwise, create locally only
      
      if (isAdmin) {
        // Admin is logged in - try to save to Firestore with our pre-generated ID
        try {
          // Use React Native Firebase v22 modular API
          const { getApp } = require('@react-native-firebase/app');
          const { getFirestore, doc, setDoc } = require('@react-native-firebase/firestore');
          
          const app = getApp();
          const db = getFirestore(app);
          
          // Create driver in Firestore using our generated ID (consistent format)
          const driverRef = doc(db, 'drivers', driverId);
          await setDoc(driverRef, {
            id: driverId, // Store ID in document too for reference
            name: trimmedName,
            phone: trimmedPhone,
            vehicle_type: vehicle,
            pin_code: trimmedPin,
            is_active: true,
            created_at: new Date().toISOString(),
            source: 'firebase',
            created_by: 'admin'
          });
          
          useFirebase = true;
          if (isMounted) {
            setFirebaseAvailable(true);
          }
          
          // Store PIN locally for login (Firestore driver)
          storeDriverPin(driverId, trimmedPin);
          console.log('✅ Admin created driver in Firestore with ID:', driverId);
          
        } catch (firebaseErr) {
          firebaseError = firebaseErr;
          console.log('❌ Firestore creation failed:', firebaseErr);
          console.log('Error code:', (firebaseErr as any)?.code);
          console.log('Error message:', (firebaseErr as any)?.message);
          if (isMounted) {
            setFirebaseAvailable(false);
          }
          // Continue to local creation - same ID format will be used
        }
      }
      
      // Store locally with same ID format (whether Firestore succeeded or not)
      if (!useFirebase) {
        // Add to local credentials (for login)
        addNewDriverCredential(trimmedPin);
        console.log(`📱 Created driver locally with ID:`, driverId);
      }

      // Make sure driverId is set
      if (!driverId) {
        throw new Error('Could not generate driver ID');
      }

      // Store driver info locally (in AsyncStorage or local DB)
      try {
        // Import dynamically to avoid circular dependencies
        const { storeDriverLocally } = await import('../utils/localDatabase');
        await storeDriverLocally({
          id: driverId,
          name,
          phone: trimmedPhone,
          vehicle_type: vehicle,
          pin_code: trimmedPin,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          source: useFirebase ? 'firebase' : 'local'
        });
        console.log('✅ Driver stored locally with ID:', driverId);
      } catch (localError) {
        console.warn('⚠️ Could not store driver locally:', localError);
        // Continue anyway - at least we have the ID
      }

      let message = `Le livreur a été créé avec succès.\n\nID de Connexion:\n${driverId}\n\nCode PIN:\n${trimmedPin}\n\n`;
      
      if (useFirebase) {
        message += '✅ Synchronisé avec Firestore (Admin multi-appareil)\n';
        message += '� Disponible sur tous les appareils connectés\n';
      } else if (isAdmin && firebaseError) {
        message += '📱 Stocké localement seulement\n';
        message += `⚠️ Firestore erreur: ${(firebaseError as any)?.code || 'Erreur inconnue'}\n`;
        if ((firebaseError as any)?.message) {
          message += `Détail: ${(firebaseError as any).message.substring(0, 50)}...\n`;
        }
        message += '🔧 Se synchronisera quand Firestore sera disponible\n';
      } else if (!isAdmin) {
        message += '📱 Stocké localement seulement\n';
        message += '👤 Mode Livreur - Pas de synchronisation Firestore\n';
        message += 'ℹ️ Seul l\'admin peut synchroniser entre appareils\n';
      }
      
      message += `\nFormat ID: DRV-XXXXXX (6 caractères alphanumériques)\n`;
      message += '⚠️ Note: Les IDs DRV-001 à DRV-020 sont réservés pour configuration préalable\n';
      message += '\nVeuillez transmettre ces informations au livreur.';

      Alert.alert(
        "Livreur Créé",
        message,
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

          {!firebaseAvailable && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ID Disponible *</Text>
              <Text style={styles.warningText}>⚠️ Firebase indisponible - Utilisation des IDs pré-configurés</Text>
              {availableIds.length > 0 ? (
                <View style={styles.idContainer}>
                  {availableIds.map(id => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.idOption, selectedId === id && styles.idOptionSelected]}
                      onPress={() => setSelectedId(id)}
                    >
                      <Text style={[styles.idText, selectedId === id && styles.idTextSelected]}>
                        {id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.errorText}>Aucun ID disponible</Text>
              )}
            </View>
          )}

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
