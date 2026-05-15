/**
 * Example: Using Local QR Code Generation
 * 
 * This shows how to integrate local QR code generation into your screens
 * instead of relying on external quickchart.io service
 */

import React, { useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { QRCodeComponent } from '../components/QRCodeComponent';

interface PackageData {
  ref_number: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_phone_2?: string;
  sender_name: string;
  sender_company?: string;
  sender_phone: string;
  date_of_arrive: string;
  supplement_info?: string;
  description: string;
  weight: string;
  gps_lat: number;
  gps_lng: number;
  limit_date: string;
  price: number;
  is_paid: boolean;
}

/**
 * Example Usage in a Screen Component
 */
const QRCodeDisplayExample = ({ packageData }: { packageData: PackageData }) => {
  const qrRef = useRef<any>(null);

  const handleExportQR = async () => {
    // Optional: Export QR code as image
    if (qrRef.current) {
      try {
        const svg = await qrRef.current.toDataURL();
        console.log('QR Code SVG:', svg);
        // You can save this or share it
      } catch (error) {
        console.error('Error exporting QR code:', error);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.packageInfo}>
        <Text style={styles.title}>{packageData.ref_number}</Text>
        <Text style={styles.subtitle}>{packageData.customer_name}</Text>
      </View>

      <View style={styles.qrContainer}>
        <QRCodeComponent
          data={packageData}
          size={300}
          getRef={qrRef}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleExportQR}>
        <Text style={styles.buttonText}>Export QR Code</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  packageInfo: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QRCodeDisplayExample;
