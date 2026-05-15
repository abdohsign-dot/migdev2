import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface ScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

const { width } = Dimensions.get('window');

export default function ScannerModal({ visible, onClose, onScan }: ScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      if (!permission?.granted && permission?.canAskAgain) {
        requestPermission();
      }
    }
  }, [visible, permission, requestPermission]);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true);
      onScan(data);
    }
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.center}>
          <Text>Demande d'autorisation pour la caméra...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.center}>
          <Text style={styles.message}>Nous avons besoin de votre permission pour utiliser la caméra</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Accorder la permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
            <Text style={styles.buttonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
        />
        
        {/* Scanner Overlay */}
        <View style={styles.overlay}>
          <View style={styles.unfocusedContainer}></View>
          <View style={styles.middleContainer}>
            <View style={styles.unfocusedContainer}></View>
            <View style={styles.focusedContainer}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.unfocusedContainer}></View>
          </View>
          <View style={styles.unfocusedContainer}></View>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  closeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  middleContainer: {
    flexDirection: 'row',
    height: width * 0.7, // Square aspect ratio based on width
  },
  focusedContainer: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#10B981', // Green color
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
});
