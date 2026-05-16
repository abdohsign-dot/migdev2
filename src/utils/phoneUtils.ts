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
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  // 2. Handle Moroccan mobile numbers starting with 06 or 07
  // If the original string starts with 06 or 07 (ignoring symbols)
  // or if the cleaned string starts with 06 or 07
  if (phone.trim().startsWith('06') || phone.trim().startsWith('07')) {
    return `212${cleanPhone.substring(1)}`;
  }

  // 3. If it's already a full international number (e.g. starts with 212)
  // we assume it's already correct.
  
  // 4. Fallback: if it starts with 0 but not 06/07, it might be a fixed line or other
  // If user wants +212 for all 0... numbers, we could generalize, 
  // but they specifically mentioned 06/07.
  
  return cleanPhone;
};
