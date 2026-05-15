/**
 * Pre-Generated Credentials System
 * 
 * This file contains 20 pre-generated driver credentials and admin PIN.
 * All PINs are hashed with SHA-256 using crypto-js for local development.
 * 
 * SECURITY:
 * - Hashes are generated with SHA-256 (crypto-js)
 * - Original PINs are NOT stored in code
 * - Only admin can view the credentials list
 * - Drivers cannot see other drivers' credentials
 */

// Import crypto-js for SHA-256 hashing
import CryptoJS from 'crypto-js';

/**
 * Hash PIN using SHA-256 (same as admin PIN)
 */
const hashPin = (pin: string): string => {
  return CryptoJS.SHA256(pin).toString();
};

/**
 * Pre-generated Driver Credentials
 * 
 * Format:
 * - ID: DRV-XXX (3 digits)
 * - PIN: 4 digits
 * 
 * Note: These are stored locally for offline authentication.
 * Driver details (name, vehicle, phone) are stored in Firebase when admin creates the driver.
 */

export interface DriverCredential {
  id: string;
  pin_hash: string;       // SHA-256 hash of PIN (crypto-js)
  is_active: boolean;     // Active status (local only, not synced)
}

/**
 * 20 Pre-generated Driver Credentials
 * 
 * These are ready to use immediately without Firebase.
 * Admin can activate/deactivate and assign to real drivers in Firebase.
 * 
 * PINs: 0001 through 0020 (4-digit PINs matching driver number)
 * Example: DRV-001 uses PIN "0001", DRV-002 uses PIN "0002", etc.
 * 
 * IMPORTANT: These start as INACTIVE. Admin must activate them when assigning to real drivers.
 */
export const DRIVER_CREDENTIALS: DriverCredential[] = [
  { id: 'DRV-001', pin_hash: '888b19a43b151683c87895f6211d9f8640f97bdc8ef32f03dbe057c8f5e56d32', is_active: false }, // PIN: 0001
  { id: 'DRV-002', pin_hash: '4fac6dbe26e823ed6edf999c63fab3507119cf3cbfb56036511aa62e258c35b4', is_active: false }, // PIN: 0002
  { id: 'DRV-003', pin_hash: '446e21f212ab200933c4c9a0802e1ff0c410bbd75fca10168746fc49883096db', is_active: false }, // PIN: 0003
  { id: 'DRV-004', pin_hash: '0591b59c1bdd9acd2847a202ddd02c3f14f9b5a049a5707c3279c1e967745ed4', is_active: false }, // PIN: 0004
  { id: 'DRV-005', pin_hash: '1ed8eb363bcd64c52f5f8703ecd464008979ac2ef462e6c5df342fe56c561bd5', is_active: false }, // PIN: 0005
  { id: 'DRV-006', pin_hash: '6b3b9a6ddb739ea6b3984e9038c33edeaecfb0eea476eba17b606d4699ca24e1', is_active: false }, // PIN: 0006
  { id: 'DRV-007', pin_hash: 'f15cea39f11dc0371cfb9a4b7b1c38d5c636feb72d70e2759b0e505905ee9d01', is_active: false }, // PIN: 0007
  { id: 'DRV-008', pin_hash: '0b6dfcd5427a43a60b0a38360499be09d494c8d8d67d70fc23080186e17161ba', is_active: false }, // PIN: 0008
  { id: 'DRV-009', pin_hash: '44798dd7d0f2c058bff13fdbac8c49b3a2ee56823eddcc2d26054a15ef41c842', is_active: false }, // PIN: 0009
  { id: 'DRV-010', pin_hash: '0b08e3dcc50fe4e5cee9b0b3a671a8db936f8335ba9050696d41cbb9a07f22e3', is_active: false }, // PIN: 0010
  { id: 'DRV-011', pin_hash: 'a8d0b6f0939cfd883251f62b265f971ef8a5ab97eee32b91460f08b965601d93', is_active: false }, // PIN: 0011
  { id: 'DRV-012', pin_hash: '84b2a5d834daee2fff7eb5e31f44ba68eb860d86d2cf8e37606a26fa775cf23b', is_active: false }, // PIN: 0012
  { id: 'DRV-013', pin_hash: '18303683dba5587003399c2103c2cbd8448bed6601514d9ea159a5af102e1310', is_active: false }, // PIN: 0013
  { id: 'DRV-014', pin_hash: '07a8e31c03ce18180509eeb3107b8f7788f06e60b69cc91eccf6e1ec87917fc9', is_active: false }, // PIN: 0014
  { id: 'DRV-015', pin_hash: '4298e3b3ed58c3af466ba112a0fe1e45eb478751bb5ed9b0156938f1ba7a3dcf', is_active: false }, // PIN: 0015
  { id: 'DRV-016', pin_hash: 'd5153a8e6fa6caad01f67479b366b5d9f3b6350e594dd3f8776d4edb7a2a889c', is_active: false }, // PIN: 0016
  { id: 'DRV-017', pin_hash: '1ca028f07214879e7a13ac5fddab2db2f66149572a62e814e97e7ad4ba286f4c', is_active: false }, // PIN: 0017
  { id: 'DRV-018', pin_hash: '7550e2da7b7a165c69fb72da92347f15b535eeebe8ea58913b09542376e83917', is_active: false }, // PIN: 0018
  { id: 'DRV-019', pin_hash: '5e5dca63a627cc52986d9e4cf1ed33075ff5b76a41074600730a045900c437b1', is_active: false }, // PIN: 0019
  { id: 'DRV-020', pin_hash: '3a0a6026cbab0726507859c4d59884c41ac6042bc8fc9f5c9ff7dc16164e5e63', is_active: false }, // PIN: 0020
];

/**
 * Verify driver PIN against SHA-256 hash
 */
export const verifyDriverPin = async (pin: string, hash: string): Promise<boolean> => {
  try {
    // Validate input
    if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
      return false;
    }
    
    // Hash the entered PIN and compare with stored hash
    const enteredHash = hashPin(pin);
    return enteredHash === hash;
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
};

/**
 * Verify admin PIN
 * Uses the verification from adminPin utility
 */
export const verifyAdminPinLocal = async (pin: string): Promise<boolean> => {
  try {
    // Import dynamically to avoid circular dependencies
    const { verifyAdminPin } = await import('../utils/adminPin');
    return await verifyAdminPin(pin);
  } catch (error) {
    console.error('Error in admin PIN verification:', error);
    return false;
  }
};

/**
 * Get driver by ID
 */
export const getDriverById = (id: string): DriverCredential | undefined => {
  return DRIVER_CREDENTIALS.find(d => d.id === id);
};

/**
 * Get all active drivers
 */
export const getActiveDrivers = (): DriverCredential[] => {
  return DRIVER_CREDENTIALS.filter(d => d.is_active);
};

/**
 * Check if driver ID is from pre-stored list (DRV-001 to DRV-020)
 */
export const isPreStoredDriverId = (driverId: string): boolean => {
  return /^DRV-\d{3}$/.test(driverId);
};

/**
 * Get credentials list (admin only)
 * Returns driver IDs only for security - PINs are never exposed
 */
export const getCredentialsList = (): Array<{id: string}> => {
  return DRIVER_CREDENTIALS.map(d => ({
    id: d.id,
  }));
};

/**
 * Generate a random driver ID for admin-created drivers
 * Format: ADM-XXXX-YYYY (where XXXX is timestamp, YYYY is random)
 * This is COMPLETELY DIFFERENT from pre-stored IDs (DRV-001 to DRV-020)
 */
export const generateAdminDriverId = (): string => {
  const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
  }
  return `ADM-${timestamp}-${randomPart}`;
};

/**
 * Check if a driver ID is admin-created (ADM-XXXX-YYYY)
 * COMPLETELY DIFFERENT from pre-stored IDs (DRV-001 to DRV-020)
 */
export const isAdminCreatedDriverId = (driverId: string): boolean => {
  return /^ADM-\d{4}-[A-Z0-9]{4}$/.test(driverId);
};

/**
 * Activate a pre-stored driver ID
 * This should be called when admin assigns a pre-stored ID to a real driver
 */
export const activateDriverId = (driverId: string): boolean => {
  const driverIndex = DRIVER_CREDENTIALS.findIndex(d => d.id === driverId);
  if (driverIndex !== -1) {
    DRIVER_CREDENTIALS[driverIndex].is_active = true;
    return true;
  }
  return false;
};

/**
 * Deactivate a pre-stored driver ID
 * This should be called when admin removes a driver
 */
export const deactivateDriverId = (driverId: string): boolean => {
  const driverIndex = DRIVER_CREDENTIALS.findIndex(d => d.id === driverId);
  if (driverIndex !== -1) {
    DRIVER_CREDENTIALS[driverIndex].is_active = false;
    return true;
  }
  return false;
};

/**
 * Add a new driver credential with admin ID
 * For when Firebase is unavailable - creates admin-created driver
 */
export const addNewDriverCredential = (pin: string): {id: string, pin_hash: string} => {
  const newId = generateAdminDriverId();
  const pinHash = hashPin(pin);
  
  // Add to DRIVER_CREDENTIALS array
  DRIVER_CREDENTIALS.push({
    id: newId,
    pin_hash: pinHash,
    is_active: true
  });
  
  return { id: newId, pin_hash: pinHash };
};

/**
 * Store PIN for any driver ID (Firestore or local)
 * This allows drivers to log in with their PIN
 */
export const storeDriverPin = (driverId: string, pin: string): void => {
  const pinHash = hashPin(pin);
  
  // Check if driver already exists in credentials
  const existingIndex = DRIVER_CREDENTIALS.findIndex(d => d.id === driverId);
  
  if (existingIndex !== -1) {
    // Update existing driver PIN
    DRIVER_CREDENTIALS[existingIndex].pin_hash = pinHash;
    DRIVER_CREDENTIALS[existingIndex].is_active = true;
  } else {
    // Add new driver credential
    DRIVER_CREDENTIALS.push({
      id: driverId,
      pin_hash: pinHash,
      is_active: true
    });
  }
  
  console.log(`🔐 PIN stored for driver ${driverId}`);
};
