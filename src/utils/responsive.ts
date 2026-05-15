/**
 * Responsive Design Utilities
 * 
 * Provides responsive design utilities for different screen sizes and orientations.
 * Supports phones, tablets, and various screen orientations.
 */

import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

// Get current device dimensions
const { width, height } = Dimensions.get('window');

// Device type detection
export const deviceType = {
  isPhone: width < 768,
  isTablet: width >= 768,
  isSmallPhone: width < 375,
  isLargePhone: width >= 375 && width < 768,
  isSmallTablet: width >= 768 && width < 1024,
  isLargeTablet: width >= 1024,
};

// Orientation detection
export const orientation = {
  isPortrait: height >= width,
  isLandscape: width > height,
};

// Breakpoint constants
export const BREAKPOINTS = {
  SMALL_PHONE: 375,
  LARGE_PHONE: 768,
  SMALL_TABLET: 768,
  LARGE_TABLET: 1024,
  DESKTOP: 1200,
};

// Responsive spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Responsive spacing
  responsive: {
    paddingHorizontal: deviceType.isTablet ? 32 : 24,
    paddingVertical: deviceType.isTablet ? 24 : 16,
    marginHorizontal: deviceType.isTablet ? 32 : 24,
    marginVertical: deviceType.isTablet ? 24 : 16,
    screenPadding: deviceType.isTablet ? 40 : 24,
  },
};

// Responsive font sizes
export const FONTS = {
  // Base font sizes
  xs: 10,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 42,
  
  // Responsive font sizes
  responsive: {
    title: deviceType.isTablet ? 48 : 42,
    subtitle: deviceType.isTablet ? 22 : 18,
    heading: deviceType.isTablet ? 24 : 20,
    body: deviceType.isTablet ? 18 : 16,
    caption: deviceType.isTablet ? 14 : 12,
    small: deviceType.isTablet ? 12 : 10,
  },
  
  // Compact font sizes for information density
  compact: {
    title: deviceType.isTablet ? 32 : 28,
    subtitle: deviceType.isTablet ? 18 : 16,
    heading: deviceType.isTablet ? 20 : 18,
    body: deviceType.isTablet ? 16 : 14,
    caption: deviceType.isTablet ? 12 : 10,
    small: deviceType.isTablet ? 10 : 8,
    tiny: deviceType.isTablet ? 8 : 6,
  },
};

// Responsive dimensions
export const DIMENSIONS = {
  // Card dimensions
  card: {
    width: deviceType.isTablet ? '48%' : '100%',
    maxWidth: deviceType.isTablet ? 400 : '100%',
    marginHorizontal: deviceType.isTablet ? '1%' : 0,
  },
  
  // Button dimensions
  button: {
    height: deviceType.isTablet ? 56 : 48,
    paddingHorizontal: deviceType.isTablet ? 24 : 16,
  },
  
  // Input dimensions
  input: {
    height: deviceType.isTablet ? 56 : 48,
    fontSize: deviceType.isTablet ? 18 : 16,
  },
  
  // Modal dimensions
  modal: {
    width: deviceType.isTablet ? '60%' : '90%',
    maxWidth: deviceType.isTablet ? 600 : 400,
    maxHeight: deviceType.isTablet ? '80%' : '70%',
  },
  
  // Header dimensions
  header: {
    height: deviceType.isTablet ? 120 : 100,
    paddingTop: deviceType.isTablet ? 60 : 40,
    paddingHorizontal: SPACING.responsive.paddingHorizontal,
  },
};

// Layout utilities
export const LAYOUT = {
  // Flexbox helpers
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  row: {
    flexDirection: 'row',
  },
  
  column: {
    flexDirection: 'column',
  },
  
  spaceBetween: {
    justifyContent: 'space-between',
  },
  
  spaceAround: {
    justifyContent: 'space-around',
  },
  
  spaceEvenly: {
    justifyContent: 'space-evenly',
  },
  
  // Responsive layout
  responsive: {
    // Grid layout for tablets
    grid: deviceType.isTablet ? {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    } : {
      flexDirection: 'column',
    },
    
    // Two column layout for tablets
    twoColumn: deviceType.isTablet ? {
      flexDirection: 'row',
      gap: SPACING.md,
    } : {
      flexDirection: 'column',
      gap: SPACING.sm,
    },
    
    // Responsive container
    container: {
      flex: 1,
      paddingHorizontal: SPACING.responsive.paddingHorizontal,
      maxWidth: deviceType.isTablet ? 1200 : '100%',
      alignSelf: 'center',
      width: '100%',
    },
  },
};

// Shadow utilities
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Responsive shadows (defined after SHADOWS)
export const RESPONSIVE_SHADOWS = {
  card: deviceType.isTablet ? SHADOWS.medium : SHADOWS.small,
  button: deviceType.isTablet ? SHADOWS.medium : SHADOWS.small,
  modal: SHADOWS.large,
};

// Border radius utilities
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
  
  responsive: {
    button: deviceType.isTablet ? 16 : 12,
    card: deviceType.isTablet ? 16 : 12,
    input: deviceType.isTablet ? 16 : 12,
    modal: deviceType.isTablet ? 24 : 16,
  },
};

// Helper functions
export const responsiveWidth = (percentage: number) => {
  return `${percentage}%`;
};

export const responsiveSize = (size: number, tabletSize?: number) => {
  return deviceType.isTablet && tabletSize ? tabletSize : size;
};

export const responsiveFontSize = (phoneSize: number, tabletSize?: number) => {
  return deviceType.isTablet && tabletSize ? tabletSize : phoneSize;
};

export const responsivePadding = (phoneSize: number, tabletSize?: number) => {
  return deviceType.isTablet && tabletSize ? tabletSize : phoneSize;
};

export const responsiveMargin = (phoneSize: number, tabletSize?: number) => {
  return deviceType.isTablet && tabletSize ? tabletSize : phoneSize;
};

// Platform specific adjustments
export const PLATFORM = {
  ios: Platform.OS === 'ios',
  android: Platform.OS === 'android',
  
  // Status bar height
  statusBarHeight: Platform.OS === 'ios' ? (orientation.isPortrait ? 44 : 0) : 0,
  
  // Safe area adjustments
  safeAreaTop: Platform.OS === 'ios' ? (orientation.isPortrait ? 44 : 0) : 0,
  safeAreaBottom: Platform.OS === 'ios' ? (orientation.isPortrait ? 34 : 0) : 0,
};

// Export all utilities
export const Responsive = {
  deviceType,
  orientation,
  BREAKPOINTS,
  SPACING,
  FONTS,
  DIMENSIONS,
  LAYOUT,
  SHADOWS,
  RESPONSIVE_SHADOWS,
  BORDER_RADIUS,
  responsiveWidth,
  responsiveSize,
  responsiveFontSize,
  responsivePadding,
  responsiveMargin,
  PLATFORM,
};

// Hook for responsive updates (if needed in future)
export const useResponsiveDimensions = () => {
  const [dimensions, setDimensions] = useState({ width, height });
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    
    return () => subscription?.remove();
  }, []);
  
  return {
    width: dimensions.width,
    height: dimensions.height,
    isPortrait: dimensions.height >= dimensions.width,
    isLandscape: dimensions.width > dimensions.height,
  };
};
