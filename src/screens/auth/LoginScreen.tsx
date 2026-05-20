import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ToastAndroid, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../../store/useAuthStore';
import { LoginScreenProps } from '../../types/navigation';

import { verifyAdminPin } from '../../utils/adminPin';
import { getDriverById, verifyDriverPin, isPreStoredDriverId } from '../../config/credentials';
import { getDriverById as getDriverByIdFromSupabase } from '../../utils/supabaseDatabase';
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

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const [driverId, setDriverId] = useState('');
  const [driverPin, setDriverPin] = useState('');
  const [driverError, setDriverError] = useState('');
  const [loading, setLoading] = useState(false);
  const [driverIdError, setDriverIdError] = useState('');
  const [driverPinError, setDriverPinError] = useState('');

  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  
  // Triple tap detection for admin access
  const [tapCount, setTapCount] = useState(0);
  const [tapTimeout, setTapTimeout] = useState<NodeJS.Timeout | null>(null);

  const { loginAsDriver, unlockAdmin } = useAuthStore();

  const handleDriverLogin = async () => {
    // Clear previous errors
    setDriverIdError('');
    setDriverPinError('');
    setDriverError('');

    // Validate fields
    if (!driverId.trim()) {
      setDriverIdError('L\'ID est requis');
      ToastAndroid.show('Veuillez entrer votre ID', ToastAndroid.SHORT);
      return;
    }

    const trimmedDriverPin = driverPin.trim();
    
    if (!trimmedDriverPin) {
      setDriverPinError('Le code PIN est requis');
      ToastAndroid.show('Veuillez entrer votre code PIN', ToastAndroid.SHORT);
      return;
    }

    if (trimmedDriverPin.length !== 4) {
      setDriverPinError('Le code PIN doit contenir 4 chiffres');
      ToastAndroid.show('Le code PIN doit contenir 4 chiffres', ToastAndroid.SHORT);
      return;
    }

    setLoading(true);
    try {
      const trimmedId = driverId.trim();
      
      // Check if it's a pre-stored driver ID (from the 20 pre-generated IDs)
      const isPreStoredId = isPreStoredDriverId(trimmedId);
      
      if (isPreStoredId) {
        // For pre-stored IDs, ONLY use local authentication - NO Firebase fallback
        const localDriver = getDriverById(trimmedId);
        
        if (localDriver) {
          // Verify PIN with bcrypt hash
          const isValid = await verifyDriverPin(trimmedDriverPin, localDriver.pin_hash);
          
          if (isValid && localDriver.is_active) {
            loginAsDriver(trimmedId);
            setLoading(false);
            return;
          } else if (!localDriver.is_active) {
            setDriverError('Compte désactivé. Contactez l\'administrateur.');
            ToastAndroid.show('Compte désactivé', ToastAndroid.SHORT);
            setLoading(false);
            return;
          } else {
            setDriverError('Code PIN incorrect.');
            ToastAndroid.show('Code PIN incorrect', ToastAndroid.SHORT);
            setLoading(false);
            return;
          }
        } else {
          // Pre-stored ID not found in local list
          setDriverIdError('ID Livreur introuvable');
          setDriverError('ID Livreur introuvable dans la liste pré-configurée.');
          ToastAndroid.show('ID Livreur introuvable', ToastAndroid.SHORT);
          setLoading(false);
          return;
        }
      }

      // For non-pre-stored IDs, use Supabase (custom IDs created by admin)
      try {
        console.log('🔍 Searching for driver in Supabase:', trimmedId);

        const driver = await getDriverByIdFromSupabase(trimmedId);
        
        if (driver) {
          console.log('✅ Driver found in Supabase:', trimmedId);
          console.log('📋 Driver data:', { is_active: driver.is_active, has_pin: !!driver.pin_code });

          if (driver.is_active && driver.pin_code === trimmedDriverPin) {
            console.log('✅ PIN verified, logging in');
            loginAsDriver(driver.id);
          } else if (!driver.is_active) {
            console.log('❌ Driver account is inactive');
            setDriverError('Compte désactivé. Contactez l\'administrateur.');
            ToastAndroid.show('Compte désactivé', ToastAndroid.SHORT);
          } else {
            console.log('❌ PIN incorrect');
            setDriverError('Code PIN incorrect.');
            ToastAndroid.show('Code PIN incorrect', ToastAndroid.SHORT);
          }
        } else {
          console.log('❌ Driver not found in Supabase:', trimmedId);
          setDriverIdError('ID Livreur introuvable');
          setDriverError('ID Livreur introuvable.');
          ToastAndroid.show('ID Livreur introuvable', ToastAndroid.SHORT);
        }
      } catch (supabaseError) {
        console.error('❌ Supabase error:', supabaseError);
        setDriverError('Erreur de connexion Supabase. Vérifiez votre connexion.');
        ToastAndroid.show('Erreur de connexion', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error(error);
      setDriverError('Erreur de connexion. Veuillez réessayer.');
      ToastAndroid.show('Erreur de connexion', ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };

  // Handle triple tap for admin access
  const handleGearTap = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // Clear existing timeout
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }

    // If 3 taps, open admin modal
    if (newTapCount === 3) {
      setAdminModalVisible(true);
      setTapCount(0);
      setTapTimeout(null);
      
    } else {
      // Reset tap count after 1 second
      const timeout = setTimeout(() => {
        setTapCount(0);
      }, 1000);
      setTapTimeout(timeout);
    }
  };

  // Sanitize admin PIN input - only allow numeric characters
  const handleAdminPinChange = (text: string) => {
    // Remove all non-numeric characters
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    // Limit to 8 digits
    const limited = numericOnly.slice(0, 8);
    
    setAdminPin(limited);
    setAdminPinError('');
  };

  const handleAdminLogin = async () => {
    // Trim PIN to remove any whitespace
    const trimmedAdminPin = adminPin.trim();
    
    console.log('🔐 Admin login attempt');
    console.log('📝 PIN length:', trimmedAdminPin.length);
    
    // Validate PIN length
    if (trimmedAdminPin.length !== 8) {
      console.log('❌ PIN length validation failed');
      setAdminPinError('Le code PIN doit contenir exactement 8 chiffres');
      ToastAndroid.show('Le code PIN doit contenir 8 chiffres', ToastAndroid.SHORT);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Verifying admin PIN...');
      // Verify admin PIN (works online and offline with cache)
      const isValid = await verifyAdminPin(trimmedAdminPin);
      
      console.log('✅ PIN verification result:', isValid);
      
      if (isValid) {
        console.log('✅ Admin login successful');
        setAdminModalVisible(false);
        setAdminPin('');
        setAdminPinError('');
        unlockAdmin();
        // Stack will automatically unmount and switch to AdminStack
      } else {
        console.log('❌ Admin PIN incorrect');
        setAdminPinError('Code PIN incorrect');
        ToastAndroid.show('Code PIN incorrect', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('❌ Admin login error:', error);
      setAdminPinError('Erreur de connexion');
      ToastAndroid.show('Erreur de connexion', ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        
        {/* Hidden Admin Gear Icon - Requires 3 taps */}
        <TouchableOpacity 
          style={styles.adminIcon} 
          onPress={handleGearTap}
          activeOpacity={0.7}
        >
          <Text style={styles.adminIconText}>⚙️</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Delivry</Text>
            <Text style={styles.subtitle}>Espace Livreur</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
            <Text style={styles.label}>ID de Connexion</Text>
            <TextInput
              style={[styles.input, driverIdError ? styles.inputError : null]}
              placeholder="Entrez votre ID fourni par l'admin"
              placeholderTextColor="#9CA3AF"
              value={driverId}
              onChangeText={(text) => { setDriverId(text); setDriverIdError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {driverIdError && <Text style={styles.errorText}>{driverIdError}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Code PIN</Text>
            <TextInput
              style={[styles.input, driverPinError ? styles.inputError : null]}
              placeholder="****"
              placeholderTextColor="#9CA3AF"
              value={driverPin}
              onChangeText={(text) => { setDriverPin(text); setDriverPinError(''); }}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
            />
          </View>

          {driverError ? <Text style={styles.mainErrorText}>{driverError}</Text> : null}

          <TouchableOpacity 
            style={[styles.button, (!driverId.trim() || !driverPin.trim()) && styles.buttonDisabled]} 
            onPress={handleDriverLogin}
            disabled={!driverId.trim() || !driverPin.trim() || loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Connexion</Text>}
          </TouchableOpacity>
          </View>
        </View>

        {/* Admin PIN Modal */}
        <Modal animationType="fade" transparent={true} visible={adminModalVisible} onRequestClose={() => setAdminModalVisible(false)}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Accès Administrateur</Text>
              <Text style={styles.modalSubtitle}>Code PIN à 8 chiffres</Text>
              <Text style={styles.label}>Code PIN Admin</Text>
              <TextInput
                style={[styles.adminInput, adminPinError ? styles.adminInputError : null]}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                keyboardType="numeric"
                maxLength={8}
                value={adminPin}
                onChangeText={handleAdminPinChange}
                contextMenuHidden={true} // Disable context menu (paste)
                autoComplete="off"
                textContentType="none"
              />
              <Text style={styles.pinCounter}>{adminPin.length}/8 chiffres</Text>
              {adminPinError ? <Text style={styles.errorText}>{adminPinError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => { 
                    setAdminModalVisible(false); 
                    setAdminPin(''); 
                    setAdminPinError(''); 
                  }}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitButton, adminPin.length !== 8 && styles.submitButtonDisabled]} 
                  onPress={handleAdminLogin}
                  disabled={adminPin.length !== 8 || loading}
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buttonText}>Valider</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F3F4F6',
  },
  keyboardView: { 
    flex: 1,
    ...Platform.select({
      ios: orientation.isPortrait ? {} : { paddingHorizontal: SPACING.lg },
      android: {},
    }),
  },
  adminIcon: { 
    position: 'absolute', 
    top: responsiveSize(50, 60), 
    right: responsiveSize(20, 30), 
    padding: responsiveSize(10, 15), 
    zIndex: 10 
  },
  adminIconText: { 
    fontSize: responsiveFontSize(24, 28), 
    opacity: 0.3 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center',
    paddingHorizontal: SPACING.responsive.paddingHorizontal,
    paddingVertical: SPACING.responsive.paddingVertical,
    maxWidth: deviceType.isTablet ? 600 : '100%',
    alignSelf: 'center',
    width: '100%',
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      } : {},
      android: {},
    }),
  },
  title: { 
    fontSize: FONTS.compact.title, 
    fontWeight: '700', 
    color: '#111827', 
    textAlign: 'center', 
    marginBottom: SPACING.xs, 
    letterSpacing: -0.5,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flex: 1,
        marginBottom: 0,
      } : {},
      android: {},
    }),
  },
  subtitle: { 
    fontSize: FONTS.compact.subtitle, 
    color: '#6B7280', 
    textAlign: 'center', 
    marginBottom: responsiveSize(24, 20),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flex: 1,
        marginBottom: 0,
        marginLeft: SPACING.md,
      } : {},
      android: {},
    }),
  },
  titleContainer: {
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      } : {},
      android: {},
    }),
  },
  formContainer: {
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flex: 2,
        maxWidth: 400,
      } : {},
      android: {},
    }),
  },
  inputContainer: { 
    marginBottom: responsiveSize(20, 24) 
  },
  label: { 
    fontSize: FONTS.compact.small, 
    fontWeight: '600', 
    color: '#374151', 
    marginBottom: SPACING.xs 
  },
  input: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    borderRadius: BORDER_RADIUS.responsive.input, 
    paddingHorizontal: responsiveSize(12, 16), 
    paddingVertical: responsiveSize(10, 12), 
    fontSize: FONTS.compact.body, 
    color: '#111827',
    height: responsiveSize(40, 44),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        fontSize: 14,
      } : {},
      android: {},
    }),
  },
  inputError: { 
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: { 
    color: '#EF4444', 
    fontSize: FONTS.responsive.small, 
    marginTop: SPACING.xs 
  },
  mainErrorText: { 
    color: '#EF4444', 
    fontSize: FONTS.responsive.caption, 
    marginTop: -SPACING.xs, 
    marginBottom: SPACING.md, 
    textAlign: 'center', 
    fontWeight: '500' 
  },
  button: { 
    backgroundColor: '#3B82F6', 
    borderRadius: BORDER_RADIUS.responsive.button, 
    paddingVertical: responsiveSize(12, 14), 
    alignItems: 'center', 
    ...RESPONSIVE_SHADOWS.button,
    height: responsiveSize(40, 44),
    justifyContent: 'center',
  },
  buttonDisabled: { 
    backgroundColor: '#9CA3AF', 
    shadowOpacity: 0, 
    elevation: 0 
  },
  buttonText: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.body, 
    fontWeight: '600' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: SPACING.responsive.screenPadding 
  },
  modalContent: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: BORDER_RADIUS.responsive.modal, 
    padding: responsiveSize(24, 32), 
    width: deviceType.isTablet ? '60%' : '90%' as any, 
    maxWidth: deviceType.isTablet ? 600 : 400 as any,
    maxHeight: deviceType.isTablet ? '80%' : '70%' as any,
    ...RESPONSIVE_SHADOWS.modal 
  },
  modalTitle: { 
    fontSize: responsiveFontSize(20, 24), 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: SPACING.sm 
  },
  modalSubtitle: { 
    fontSize: FONTS.responsive.body, 
    color: '#6B7280', 
    marginBottom: SPACING.lg, 
    fontStyle: 'italic' 
  },
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: SPACING.lg, 
    gap: SPACING.md,
    ...Platform.select({
      ios: orientation.isLandscape ? {
        flexDirection: 'row-reverse',
      } : {},
      android: {},
    }),
  },
  cancelButton: { 
    paddingHorizontal: 20, 
    borderRadius: BORDER_RADIUS.md, 
    backgroundColor: '#F3F4F6',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: { 
    color: '#4B5563', 
    fontWeight: '600',
    fontSize: 15,
  },
  submitButton: { 
    backgroundColor: '#10B981', 
    paddingHorizontal: 24, 
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: { 
    backgroundColor: '#9CA3AF', 
    opacity: 0.5 
  },
  adminInput: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    borderRadius: BORDER_RADIUS.md, 
    paddingHorizontal: 16, 
    fontSize: 20, 
    color: '#111827',
    height: 50,
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: 'bold',
  },
  adminInputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  pinCounter: { 
    fontSize: FONTS.responsive.small, 
    color: '#6B7280', 
    marginTop: SPACING.xs, 
    textAlign: 'right' 
  },
});
