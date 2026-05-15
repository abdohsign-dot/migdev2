import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, 
  ActivityIndicator, ToastAndroid 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModifyDriverScreenProps } from '../types/navigation';
import { isPreStoredDriverId, activateDriverId } from '../config/credentials';
import useAuthStore from '../store/useAuthStore';

const VEHICLE_TYPES = ['Moto', 'Voiture', 'Camionnette'];

export default function ModifyDriverScreen({ navigation, route }: ModifyDriverScreenProps) {
  const { driver } = route.params;
  
  const [name, setName] = useState(driver.name || '');
  const [phone, setPhone] = useState(driver.phone || '');
  const [vehicle, setVehicle] = useState(driver.vehicle_type || 'Moto');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{name?: string; phone?: string}>({});
  const [firebaseAvailable, setFirebaseAvailable] = useState(true);
  const [isPreStored, setIsPreStored] = useState(false);
  const { userRole } = useAuthStore();
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    // Check if this is a pre-stored driver
    const preStored = isPreStoredDriverId(driver.id);
    setIsPreStored(preStored);
    
    // For pre-stored drivers with generic names, suggest adding real info
    if (preStored && (!driver.name || driver.name.startsWith('Livreur '))) {
      Alert.alert(
        "Configuration requise",
        "Ce livreur utilise un ID pré-configuré. Veuillez ajouter son nom réel et numéro de téléphone.",
        [{ text: "OK" }]
      );
    }
  }, [driver]);

  const validateForm = (): boolean => {
    const newErrors: {name?: string; phone?: string} = {};
    
    if (!name.trim()) {
      newErrors.name = "Le nom est requis";
    }
    
    if (!phone.trim()) {
      newErrors.phone = "Le téléphone est requis";
    } else if (!/^0[1-9]\d{8}$/.test(phone)) {
      newErrors.phone = "Format: 06... ou 07...";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveChanges = async () => {
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
      const updatedDriver = {
        ...driver,
        name,
        phone,
        vehicle_type: vehicle,
        _lastModified: new Date().toISOString()
      };

      // 1. Only try to update in Firebase if admin is logged in
      let firebaseUpdated = false;
      let firebaseError: any = null;
      
      if (isAdmin) {
        try {
          const { getApp } = require('@react-native-firebase/app');
          const { getFirestore, doc, updateDoc } = require('@react-native-firebase/firestore');
          const app = getApp();
          const db = getFirestore(app);
          await updateDoc(doc(db, 'drivers', driver.id), {
            name,
            phone,
            vehicle_type: vehicle,
            updated_at: new Date().toISOString(),
            updated_by: 'admin'
          });
          firebaseUpdated = true;
          if (isMounted) {
            setFirebaseAvailable(true);
          }
          console.log('✅ Admin updated driver in Firebase');
        } catch (firebaseErr) {
          firebaseError = firebaseErr;
          console.log('Firebase update failed:', firebaseErr);
          if (isMounted) {
            setFirebaseAvailable(false);
          }
        }
      }

      // 2. Always update locally
      try {
        const { storeDriverLocally } = await import('../utils/localDatabase');
        await storeDriverLocally(updatedDriver);
        console.log('✅ Driver updated locally');
      } catch (localError) {
        console.warn('⚠️ Could not update driver locally:', localError);
      }

      // 3. If it's a pre-stored driver, activate it with real info
      if (isPreStored) {
        activateDriverId(driver.id);
        console.log('✅ Pre-stored driver activated with real info');
      }

      let message = `Livreur "${name}" mis à jour avec succès.\n\n`;
      
      if (firebaseUpdated) {
        message += '✅ Synchronisé avec Firestore (Admin multi-appareil)\n';
      } else if (isAdmin && firebaseError) {
        message += '📱 Mis à jour localement seulement\n';
        message += `⚠️ Firestore erreur: ${firebaseError?.code || 'Erreur inconnue'}\n`;
        message += '🔧 Admin connecté mais Firestore indisponible\n';
      } else if (!isAdmin) {
        message += '📱 Mis à jour localement seulement\n';
        message += '👤 Mode Livreur - Pas de synchronisation Firestore\n';
        message += 'ℹ️ Seul l\'admin peut synchroniser entre appareils\n';
      } else {
        message += '📱 Mis à jour localement seulement\n';
      }
      
      if (isPreStored) {
        message += '🔓 ID pré-configuré activé avec informations réelles\n';
      }

      Alert.alert(
        "Modifications Enregistrées",
        message,
        [
          { 
            text: "OK", 
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error updating driver:', error);
      if (isMounted) {
        Alert.alert(
          "Erreur", 
          "Impossible de mettre à jour le livreur. " + (error instanceof Error ? error.message : String(error))
        );
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
      cleanup();
    }
  };

  const handleResetPIN = () => {
    Alert.alert(
      "Réinitialiser le PIN",
      "Cette fonctionnalité n'est pas encore disponible. Pour réinitialiser le PIN, vous devez créer un nouveau livreur.",
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier Livreur</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {isPreStored && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                📋 ID Pré-configuré: {driver.id}
              </Text>
              <Text style={styles.infoBannerSubtext}>
                Ce livreur utilise un ID réservé. Ajoutez ses informations réelles.
              </Text>
            </View>
          )}

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
            <Text style={styles.label}>ID de Connexion</Text>
            <View style={styles.idDisplay}>
              <Text style={styles.idText}>{driver.id}</Text>
              <Text style={styles.idNote}>
                {isPreStored ? 'ID pré-configuré (ne peut pas être modifié)' : 'ID généré par le système'}
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code PIN</Text>
            <View style={styles.pinDisplay}>
              <Text style={styles.pinText}>{driver.pin_code || '****'}</Text>
              <TouchableOpacity style={styles.resetPinButton} onPress={handleResetPIN}>
                <Text style={styles.resetPinText}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>Le PIN ne peut pas être modifié ici pour des raisons de sécurité.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]} 
            onPress={handleSaveChanges} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer les Modifications</Text>}
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
  
  infoBanner: {
    backgroundColor: '#E0E7FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoBannerText: {
    color: '#3730A3',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoBannerSubtext: {
    color: '#4F46E5',
    fontSize: 12,
  },
  
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827',
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  
  pillsContainer: { flexDirection: 'row', gap: 10 },
  pill: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF'
  },
  pillActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  pillText: { color: '#4B5563', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },
  
  idDisplay: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  idText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  idNote: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
  
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pinText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  resetPinButton: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  resetPinText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: { fontSize: 12, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },
  
  saveBtn: { 
    backgroundColor: '#111827', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 30,
    minHeight: 50,
  },
  saveBtnDisabled: { backgroundColor: '#9CA3AF' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});