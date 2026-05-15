import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { generateQRString, extractQRData } from '../utils/qrGenerator';

interface QRCodeComponentProps {
  /** Full package data (optional if `value` is provided) */
  data?: any;
  /** Raw QR payload (optional). If present, we use it directly. */
  value?: string;
  size?: number;

  // Support both patterns:
  // - callback ref: (ref) => void
  // - ref object: { current: ... }
  getRef?: ((ref: any) => void) | React.RefObject<any>;
}

/**
 * QRCodeComponent
 * Displays a QR code.
 * - If `value` is provided: uses it directly as the QR payload.
 * - Else: generates payload from `data` using extractQRData/generateQRString.
 */
export const QRCodeComponent: React.FC<QRCodeComponentProps> = ({
  data,
  value,
  size = 300,
  getRef,
}) => {
  const qrRef = useRef<any>(null);

  React.useEffect(() => {
    if (!getRef || !qrRef.current) return;

    // Callback ref
    if (typeof getRef === 'function') {
      getRef(qrRef.current);
      return;
    }

    // Ref object
    if (typeof getRef === 'object' && 'current' in getRef) {
      (getRef as React.RefObject<any>).current = qrRef.current;
    }
  }, [getRef]);

  const qrString =
    typeof value === 'string' ? value : generateQRString(extractQRData(data));

  return (
    <View style={styles.container}>
      <QRCode
        value={qrString}
        size={size}
        color="black"
        backgroundColor="white"
        getRef={(ref: any) => {
          qrRef.current = ref;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
