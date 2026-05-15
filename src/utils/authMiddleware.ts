/**
 * Authentication middleware for Firestore operations
 * Provides user context and permission checking for database operations
 */

import { isCurrentUserAdmin, isCurrentUserDriver, getCurrentDriverId, getCurrentUser } from './supabaseAuth';
import type { Package, Driver } from '../types';
import {
  getPackageById,
  getDriverById,
  createPackage,
  createDriver,
  updatePackage,
  updateDriver,
  deletePackage,
  deleteDriver,
} from './supabaseDatabase';

export interface AuthContext {
  uid: string;
  isAdmin: boolean;
  isDriver: boolean;
  driverId?: string;
}

/**
 * Get current authentication context
 */
export const getAuthContext = async (): Promise<AuthContext | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const [isAdmin, isDriver, driverId] = await Promise.all([
      isCurrentUserAdmin(),
      isCurrentUserDriver(),
      getCurrentDriverId(),
    ]);

    return {
      uid: user.id,
      isAdmin,
      isDriver,
      driverId: driverId || undefined,
    };
  } catch (error) {
    console.error('Error getting auth context:', error);
    return null;
  }
};

/**
 * Check if user can read a specific package
 */
export const canReadPackage = async (packageData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can read all packages
    }

    const driverId = await getCurrentDriverId();
    if (driverId && packageData.assigned_to === driverId) {
      return true; // Drivers can read their own assigned packages
    }

    return false;
  } catch (error) {
    console.error('Error checking package read permission:', error);
    return false;
  }
};

/**
 * Check if user can update a package
 */
export const canUpdatePackage = async (packageData: any, updateData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can update any package
    }

    const driverId = await getCurrentDriverId();
    if (driverId && packageData.assigned_to === driverId) {
      // Check if driver is only updating allowed fields
      const allowedFields = ['status', 'delivered_at', 'accepted_at', 'return_reason', '_last_modified', '_version'];
      const updateKeys = Object.keys(updateData);
      
      const isAllowedUpdate = updateKeys.every(key => allowedFields.includes(key));
      if (isAllowedUpdate) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking package update permission:', error);
    return false;
  }
};

/**
 * Check if user can create a package
 */
export const canCreatePackage = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking package create permission:', error);
    return false;
  }
};

/**
 * Check if user can delete a package
 */
export const canDeletePackage = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking package delete permission:', error);
    return false;
  }
};

/**
 * Check if user can read driver information
 */
export const canReadDriver = async (driverData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can read all drivers
    }

    const driverId = await getCurrentDriverId();
    if (driverId === driverData.id) {
      return true; // Drivers can read their own profile
    }

    // Drivers can read other active drivers for visibility
    if (driverData.is_active === true) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking driver read permission:', error);
    return false;
  }
};

/**
 * Check if user can update driver information
 */
export const canUpdateDriver = async (driverData: any, updateData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can update any driver
    }

    const driverId = await getCurrentDriverId();
    if (driverId === driverData.id) {
      // Check if driver is only updating allowed fields
      const allowedFields = ['phone', 'vehicle_type', 'is_active'];
      const updateKeys = Object.keys(updateData);
      
      const isAllowedUpdate = updateKeys.every(key => allowedFields.includes(key));
      return isAllowedUpdate;
    }

    return false;
  } catch (error) {
    console.error('Error checking driver update permission:', error);
    return false;
  }
};

/**
 * Check if user can create driver
 */
export const canCreateDriver = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking driver create permission:', error);
    return false;
  }
};

/**
 * Check if user can delete driver
 */
export const canDeleteDriver = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking driver delete permission:', error);
    return false;
  }
};

/**
 * Wrapper for Supabase operations with permission checking (RLS-friendly; no service-role bypass)
 */
export class SecureFirestore {
  static async getDocument(collection: string, docId: string): Promise<any> {
    if (collection === 'packages') {
      const pkg = await getPackageById(docId);
      if (!pkg) return null;

      const canRead = await canReadPackage(pkg);
      if (!canRead) throw new Error('Permission denied: Cannot read this package');
      return pkg;
    }

    if (collection === 'drivers') {
      const driver = await getDriverById(docId);
      if (!driver) return null;

      const canRead = await canReadDriver(driver);
      if (!canRead) throw new Error('Permission denied: Cannot read this driver');
      return driver;
    }

    throw new Error(`Unknown collection: ${collection}`);
  }

  static async createDocument(collection: string, data: any): Promise<any> {
    if (collection === 'packages') {
      const allowed = await canCreatePackage();
      if (!allowed) throw new Error('Permission denied: Cannot create this package');
      return await createPackage(data);
    }

    if (collection === 'drivers') {
      const allowed = await canCreateDriver();
      if (!allowed) throw new Error('Permission denied: Cannot create this driver');
      return await createDriver(data);
    }

    throw new Error(`Unknown collection: ${collection}`);
  }

  static async updateDocument(collection: string, docId: string, updateData: any): Promise<any> {
    if (collection === 'packages') {
      const existing = await getPackageById(docId);
      if (!existing) throw new Error('Document not found');

      const allowed = await canUpdatePackage(existing, updateData);
      if (!allowed) throw new Error('Permission denied: Cannot update this package');

      return await updatePackage(docId, updateData);
    }

    if (collection === 'drivers') {
      const existing = await getDriverById(docId);
      if (!existing) throw new Error('Document not found');

      const allowed = await canUpdateDriver(existing, updateData);
      if (!allowed) throw new Error('Permission denied: Cannot update this driver');

      return await updateDriver(docId, updateData);
    }

    throw new Error(`Unknown collection: ${collection}`);
  }

  static async deleteDocument(collection: string, docId: string): Promise<void> {
    if (collection === 'packages') {
      const allowed = await canDeletePackage();
      if (!allowed) throw new Error('Permission denied: Cannot delete this package');
      await deletePackage(docId);
      return;
    }

    if (collection === 'drivers') {
      const allowed = await canDeleteDriver();
      if (!allowed) throw new Error('Permission denied: Cannot delete this driver');
      await deleteDriver(docId);
      return;
    }

    throw new Error(`Unknown collection: ${collection}`);
  }
}
