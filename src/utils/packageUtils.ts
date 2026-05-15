/**
 * Package utility functions
 */

import { Package } from '../types';

/**
 * Get short display reference for package lists
 * Converts PKG-XXXXXX to XXXX or returns original ref_number
 */
export const getPackageDisplayRef = (pkg: Package): string => {
  if (!pkg.ref_number) return '';
  
  // If it's PKG format, return last 4 characters
  if (pkg.ref_number.startsWith('PKG-')) {
    return pkg.ref_number.slice(-4);
  }
  
  // If it's a UUID, convert to short PKG format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(pkg.ref_number)) {
    const shortId = pkg.ref_number.split('-').pop()?.slice(-6).toUpperCase() || '000000';
    return `PKG-${shortId}`.slice(-4);
  }
  
  // Return original if it's already short
  return pkg.ref_number;
};

/**
 * Get full reference for database operations
 * Ensures PKG-XXXXXX format for consistency
 */
export const getPackageFullRef = (pkg: Package): string => {
  if (!pkg.ref_number) return '';
  
  // If it's already PKG format, return as is
  if (pkg.ref_number.startsWith('PKG-')) {
    return pkg.ref_number;
  }
  
  // If it's a UUID, convert to PKG format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(pkg.ref_number)) {
    const shortId = pkg.ref_number.split('-').pop()?.slice(-6).toUpperCase() || '000000';
    return `PKG-${shortId}`;
  }
  
  // If it's short (4 chars), convert to PKG format
  if (pkg.ref_number.length === 4) {
    return `PKG-${pkg.ref_number}`;
  }
  
  // Return original
  return pkg.ref_number;
};
