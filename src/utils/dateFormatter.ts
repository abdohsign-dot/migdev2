/**
 * Date Formatter Utility
 * Provides consistent date/time formatting across the application
 * Format: dd/mm/yyyy hh:mm with timezone consideration
 * Timezone: Auto-detects user's timezone (Morocco: Africa/Casablanca)
 */

/**
 * Get the user's timezone
 * Falls back to UTC if unable to detect
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect timezone, using UTC:', error);
    return 'UTC';
  }
};

/**
 * Format a date to dd/mm/yyyy hh:mm format with timezone consideration
 * @param date - Date object, ISO string, or timestamp
 * @param includeTime - Whether to include time (default: true)
 * @param includeSeconds - Whether to include seconds (default: false)
 * @returns Formatted string in dd/mm/yyyy hh:mm format
 */
export const formatDateTime = (
  date?: Date | string | number | null,
  includeTime: boolean = true,
  includeSeconds: boolean = false
): string => {
  if (!date) return 'N/A';

  try {
    let dateObj: Date;

    // Convert input to Date object
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }

    // Validate date
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: getUserTimezone(),
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = false;

      if (includeSeconds) {
        options.second = '2-digit';
      }
    }

    const formatter = new Intl.DateTimeFormat('en-GB', options);
    return formatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
};

/**
 * Format a date to dd/mm/yyyy format only (no time)
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string in dd/mm/yyyy format
 */
export const formatDate = (date?: Date | string | number | null): string => {
  return formatDateTime(date, false);
};

/**
 * Format a date to dd/mm/yyyy hh:mm:ss format with timezone consideration
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string in dd/mm/yyyy hh:mm:ss format
 */
export const formatDateTimeWithSeconds = (
  date?: Date | string | number | null
): string => {
  return formatDateTime(date, true, true);
};

/**
 * Format a date to hh:mm format only
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted string in hh:mm format
 */
export const formatTime = (date?: Date | string | number | null): string => {
  if (!date) return 'N/A';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }

    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: getUserTimezone(),
    });

    return formatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'N/A';
  }
};

/**
 * Format a date to ISO string (YYYY-MM-DD)
 * Useful for storage and API communication
 * @param date - Date object, ISO string, or timestamp
 * @returns ISO date string in YYYY-MM-DD format
 */
export const formatDateISO = (date?: Date | string | number | null): string => {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date to ISO:', error);
    return '';
  }
};

/**
 * Format a date to ISO string with time (YYYY-MM-DDTHH:mm:ss.sssZ)
 * Useful for storage and API communication
 * @param date - Date object, ISO string, or timestamp
 * @returns ISO datetime string
 */
export const formatDateTimeISO = (
  date?: Date | string | number | null
): string => {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    return dateObj.toISOString();
  } catch (error) {
    console.error('Error formatting datetime to ISO:', error);
    return '';
  }
};

/**
 * Parse a date string in dd/mm/yyyy format to Date object
 * @param dateString - Date string in dd/mm/yyyy format
 * @returns Date object or null if invalid
 */
export const parseDateString = (dateString: string): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;

  const parts = dateString.trim().split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  // Create date (month is 0-indexed in Date constructor)
  const date = new Date(year, month - 1, day);

  // Validate the date
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

/**
 * Parse a datetime string in dd/mm/yyyy hh:mm format to Date object
 * @param dateTimeString - DateTime string in dd/mm/yyyy hh:mm format
 * @returns Date object or null if invalid
 */
export const parseDateTimeString = (dateTimeString: string): Date | null => {
  if (!dateTimeString || typeof dateTimeString !== 'string') return null;

  const parts = dateTimeString.trim().split(' ');
  if (parts.length !== 2) return null;

  const date = parseDateString(parts[0]);
  if (!date) return null;

  const timeParts = parts[1].split(':');
  if (timeParts.length < 2) return null;

  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return null;

  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param date - Date object, ISO string, or timestamp
 * @returns Relative time string
 */
export const getRelativeTime = (date?: Date | string | number | null): string => {
  if (!date) return 'N/A';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }

    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'à l\'instant';
    } else if (diffMins < 60) {
      return `il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else {
      return formatDateTime(dateObj);
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return 'N/A';
  }
};

/**
 * Check if a date is today
 * @param date - Date object, ISO string, or timestamp
 * @returns true if date is today
 */
export const isToday = (date?: Date | string | number | null): boolean => {
  if (!date) return false;

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return false;
    }

    if (isNaN(dateObj.getTime())) {
      return false;
    }

    const today = new Date();
    return (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    );
  } catch (error) {
    console.error('Error checking if date is today:', error);
    return false;
  }
};

/**
 * Check if a date is in the past
 * @param date - Date object, ISO string, or timestamp
 * @returns true if date is in the past
 */
export const isPast = (date?: Date | string | number | null): boolean => {
  if (!date) return false;

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return false;
    }

    if (isNaN(dateObj.getTime())) {
      return false;
    }

    return dateObj.getTime() < new Date().getTime();
  } catch (error) {
    console.error('Error checking if date is past:', error);
    return false;
  }
};

/**
 * Check if a date is in the future
 * @param date - Date object, ISO string, or timestamp
 * @returns true if date is in the future
 */
export const isFuture = (date?: Date | string | number | null): boolean => {
  if (!date) return false;

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return false;
    }

    if (isNaN(dateObj.getTime())) {
      return false;
    }

    return dateObj.getTime() > new Date().getTime();
  } catch (error) {
    console.error('Error checking if date is future:', error);
    return false;
  }
};

/**
 * Get the difference between two dates in days
 * @param date1 - First date
 * @param date2 - Second date (defaults to now)
 * @returns Number of days between dates
 */
export const getDaysDifference = (
  date1?: Date | string | number | null,
  date2?: Date | string | number | null
): number => {
  if (!date1) return 0;

  try {
    let dateObj1: Date;
    let dateObj2: Date;

    if (typeof date1 === 'string') {
      dateObj1 = new Date(date1);
    } else if (typeof date1 === 'number') {
      dateObj1 = new Date(date1);
    } else if (date1 instanceof Date) {
      dateObj1 = date1;
    } else {
      return 0;
    }

    if (date2) {
      if (typeof date2 === 'string') {
        dateObj2 = new Date(date2);
      } else if (typeof date2 === 'number') {
        dateObj2 = new Date(date2);
      } else if (date2 instanceof Date) {
        dateObj2 = date2;
      } else {
        dateObj2 = new Date();
      }
    } else {
      dateObj2 = new Date();
    }

    if (isNaN(dateObj1.getTime()) || isNaN(dateObj2.getTime())) {
      return 0;
    }

    const diffMs = dateObj2.getTime() - dateObj1.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error('Error calculating days difference:', error);
    return 0;
  }
};
