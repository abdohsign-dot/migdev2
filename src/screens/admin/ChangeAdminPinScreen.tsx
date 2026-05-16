import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { changeAdminPin } from '../utils/adminPin';

interface ChangeAdminPinScreenProps {
  navigation: any;
}

export default function ChangeAdminPinScreen({ navigation }: ChangeAdminPinScreenProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePin = async () => {
    // Trim inputs to remove any whitespace
    const trimmedCurrentPin = currentPin.trim();
    const trimmedNewPin = newPin.trim();
    const trimmedConfirmPin = confirmPin.trim();
    
    // Validate inputs
    if (!trimmedCurrentPin || !trimmedNewPin || !trimmedConfirmPin) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (trimmedCurrentPin.length !== 8) {
      Alert.alert('Erreur', 'Le PIN actuel doit contenir 8 chiffres');
      return;
    }

    if (trimmedNewPin.length !== 8) {
      Alert.alert('Erreur', 'Le nouveau PIN doit contenir 8 chiffres');
      return;
    }

    if (!/^\d+$/.test(trimmedCurrentPin)) {
      Alert.alert('Erreur', 'Le PIN actuel doit contenir uniquement des chiffres');
      return;
    }

    if (!/^\d+$/.test(trimmedNewPin)) {
      Alert.alert('Erreur', 'Le nouveau PIN doit contenir uniquement des chiffres');
      return;
    }

    if (trimmedNewPin !== trimmedConfirmPin) {
      Alert.alert('Erreur', 'Les nouveaux PINs ne correspondent pas');
      return;
    }

    if (trimmedCurrentPin === trimmedNewPin) {
      Alert.alert('Erreur', 'Le nouveau PIN doit être différent de l\'ancien');
      return;
    }

    setLoading(true);
    try {
      const result = await changeAdminPin(trimmedCurrentPin, trimmedNewPin);

      if (result.success) {
        Alert.alert(
          'Succès',
          'Votre PIN administrateur a été changé avec succès',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
        
        // Clear inputs
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de changer le PIN');
      }
    } catch (error) {
      console.error('Error changing PIN:', error);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Changer le PIN Admin</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PIN Actuel *</Text>
            <TextInput
              style={styles.input}
              placeholder="Entrez votre PIN actuel"
              value={currentPin}
              onChangeText={setCurrentPin}
              keyboardType="numeric"
              maxLength={8}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nouveau PIN *</Text>
            <TextInput
              style={styles.input}
              placeholder="Entrez un nouveau PIN (8 chiffres)"
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="numeric"
              maxLength={8}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmer le Nouveau PIN *</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirmez le nouveau PIN"
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="numeric"
              maxLength={8}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleChangePin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Changer le PIN</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
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
  submitBtn: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tipsBox: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 24,
  },
});
