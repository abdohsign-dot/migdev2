import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, NativeModules, requireNativeComponent } from 'react-native';

// Native Android Spinner component
const NativeSpinner = Platform.OS === 'android' 
  ? requireNativeComponent('RNCSafeAreaProvider')
  : View;

interface NativePickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: { label: string; value: string }[];
  style?: any;
}

export function NativePicker({ selectedValue, onValueChange, items, style }: NativePickerProps) {
  const [selected, setSelected] = useState(selectedValue);

  useEffect(() => {
    setSelected(selectedValue);
  }, [selectedValue]);

  const handleChange = (value: string) => {
    setSelected(value);
    onValueChange(value);
  };

  if (Platform.OS === 'ios') {
    // Fallback for iOS (will use standard Picker)
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Select an option</Text>
      {/* This is a placeholder - we'll use a simple TouchableOpacity list instead */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
});

export default NativePicker;
