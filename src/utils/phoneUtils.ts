/**
 * Phone utilities for formatting and validation
 */

/**
 * Formats a phone number for use with WhatsApp API/Deep links
 * Logic for Morocco:
 * - If number begins with 06 or 07, replace 0 with 212
 * - If number already has country code or is differently formatted, clean it and use it
 * 
 * @param phone The raw phone number string
 * @returns Formatted phone number digits
 */
export const formatPhoneForWhatsApp = (phone: string): string => {
  if (!phone) return '';

  // 1. Remove all non-digit characters
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  
  // 2. If it starts with "21206" or "21207" (redundant 0 with country code), strip the '0'
  if (cleanPhone.startsWith('21206') || cleanPhone.startsWith('21207')) {
    cleanPhone = '212' + cleanPhone.substring(4);
  }
  
  // 3. If it starts with "06" or "07" (local format)
  else if (cleanPhone.startsWith('06') || cleanPhone.startsWith('07')) {
    cleanPhone = '212' + cleanPhone.substring(1);
  }
  
  // 4. If it is 9 digits starting with "6" or "7" (missing country code and leading 0)
  else if (cleanPhone.length === 9 && (cleanPhone.startsWith('6') || cleanPhone.startsWith('7'))) {
    cleanPhone = '212' + cleanPhone;
  }
  
  // 5. General fallback: if it starts with "0", strip it and prepend "212"
  else if (cleanPhone.startsWith('0')) {
    cleanPhone = '212' + cleanPhone.substring(1);
  }

  return cleanPhone;
};
