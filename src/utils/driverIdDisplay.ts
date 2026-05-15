/**
 * Driver ID Display Utility
 * 
 * Ensures consistent display of driver IDs across the app.
 * Always displays custom_id (e.g., DRV-XXXXXX) to users,
 * while using UUID internally for database operations.
 */

import { Driver } from '../types';

/**
 * Get the display ID for a driver
 * Returns custom_id if available, otherwise returns the UUID
 * This is what should be shown to users in the UI
 */
export const getDriverDisplayId = (driver: Driver | null | undefined): string => {
  if (!driver) return 'N/A';
  return driver.custom_id || driver.id;
};

/**
 * Get the display ID from a driver object or ID string
 * Handles both Driver objects and raw ID strings
 */
export const getDisplayId = (driverOrId: Driver | string | null | undefined): string => {
  if (!driverOrId) return 'N/A';
  
  if (typeof driverOrId === 'string') {
    return driverOrId; // Assume it's already a custom_id or display format
  }
  
  return getDriverDisplayId(driverOrId);
};

/**
 * Format driver info for display
 * Returns a string like "Driver Name (DRV-XXXXXX)"
 */
export const formatDriverDisplay = (driver: Driver | null | undefined): string => {
  if (!driver) return 'N/A';
  const displayId = getDriverDisplayId(driver);
  return `${driver.name} (${displayId})`;
};

/**
 * Get driver name with display ID
 * Returns just the name with ID in parentheses
 */
export const getDriverNameWithId = (driver: Driver | null | undefined): string => {
  if (!driver) return 'N/A';
  const displayId = getDriverDisplayId(driver);
  return `${driver.name} (${displayId})`;
};

/**
 * Get just the display ID for a driver
 * Useful for showing in lists or dropdowns
 */
export const getDriverIdForDisplay = (driver: Driver | null | undefined): string => {
  if (!driver) return 'N/A';
  return getDriverDisplayId(driver);
};

/**
 * Check if a driver ID is a UUID (internal format)
 */
export const isUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Check if a driver ID is a custom ID (display format)
 */
export const isCustomId = (id: string): boolean => {
  return id.startsWith('DRV-') || id.startsWith('ADM-');
};

/**
 * Normalize driver ID for internal use
 * If given a custom_id, returns the UUID from the driver object
 * If given a UUID, returns it as-is
 */
export const normalizeDriverIdForDb = (
  idOrDriver: string | Driver,
  drivers?: Driver[]
): string => {
  if (typeof idOrDriver === 'string') {
    // If it's a UUID, return as-is
    if (isUUID(idOrDriver)) {
      return idOrDriver;
    }
    
    // If it's a custom_id, try to find the driver and get UUID
    if (drivers) {
      const driver = drivers.find(d => d.custom_id === idOrDriver);
      if (driver) {
        return driver.id;
      }
    }
    
    // Fallback: return as-is (might be a custom_id that we'll handle elsewhere)
    return idOrDriver;
  }
  
  // If it's a Driver object, return the UUID
  return idOrDriver.id;
};

/**
 * Get driver by custom_id from a list
 */
export const getDriverByCustomId = (
  customId: string,
  drivers: Driver[]
): Driver | undefined => {
  return drivers.find(d => d.custom_id === customId);
};

/**
 * Get driver by UUID from a list
 */
export const getDriverByUUID = (
  uuid: string,
  drivers: Driver[]
): Driver | undefined => {
  return drivers.find(d => d.id === uuid);
};

/**
 * Get driver by either custom_id or UUID
 */
export const getDriverByIdOrCustomId = (
  id: string,
  drivers: Driver[]
): Driver | undefined => {
  if (isUUID(id)) {
    return getDriverByUUID(id, drivers);
  }
  return getDriverByCustomId(id, drivers);
};

/**
 * Convert a list of drivers to display format
 * Adds a displayId field to each driver
 */
export const addDisplayIds = (drivers: Driver[]): (Driver & { displayId: string })[] => {
  return drivers.map(driver => ({
    ...driver,
    displayId: getDriverDisplayId(driver),
  }));
};
