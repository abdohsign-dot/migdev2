/**
 * Comprehensive Input Validation Utilities
 * 
 * Provides secure input validation, sanitization, and XSS prevention
 * for all user inputs in the delivery app.
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

/**
 * Input validation configuration
 */
export interface ValidationConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  allowEmpty?: boolean;
  dataType?: 'string' | 'number' | 'email' | 'phone' | 'date' | 'url' | 'text';
}

/**
 * XSS prevention patterns
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]*src[^>]*javascript:/gi,
  /<embed[^>]*src[^>]*javascript:/gi,
  /<object[^>]*data[^>]*javascript:/gi,
  /<link[^>]*href[^>]*javascript:/gi,
  /<meta[^>]*http-equiv[^>]*refresh/i,
  /<style[^>]*>.*?<\/style>/gi,
  /expression\s*\(/gi,
];

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /(\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/gi,
  /(--|#|\/\*|\*\/)/gi,
  /(\bUNION\b.*\bSELECT\b)/gi,
  /(\bEXEC\b.*\()/gi,
];

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string, config: ValidationConfig = {}): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // XSS prevention
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // SQL injection prevention
  SQL_INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove potentially dangerous HTML entities
  sanitized = sanitized.replace(/&lt;?[^>]*&gt;?/gi, '');

  // Limit length if specified
  if (config.maxLength && sanitized.length > config.maxLength) {
    sanitized = sanitized.substring(0, config.maxLength);
  }

  return sanitized;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const sanitized = sanitizeInput(email);
  
  if (!emailRegex.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate phone number (international format support)
 */
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const sanitized = sanitizeInput(phone);
  
  // Remove common phone number formatting characters
  const cleanPhone = sanitized.replace(/[\s\-\(\)\+]/g, '');
  
  // Check if it's numeric and reasonable length
  if (!/^\d+$/.test(cleanPhone)) {
    return { isValid: false, error: 'Phone number must contain only digits' };
  }

  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { isValid: false, error: 'Phone number must be 10-15 digits' };
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate numeric input (price, weight, etc.)
 */
export const validateNumber = (input: string, config: ValidationConfig = {}): ValidationResult => {
  if (!input || input.trim() === '') {
    if (config.required) {
      return { isValid: false, error: 'This field is required' };
    }
    return { isValid: true, sanitizedValue: config.allowEmpty ? '' : 0 };
  }

  const sanitized = sanitizeInput(input);
  const numValue = parseFloat(sanitized);

  if (isNaN(numValue)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  if (config.minLength && numValue < config.minLength) {
    return { isValid: false, error: `Value must be at least ${config.minLength}` };
  }

  if (config.maxLength && numValue > config.maxLength) {
    return { isValid: false, error: `Value must be at most ${config.maxLength}` };
  }

  return { isValid: true, sanitizedValue: numValue };
};

/**
 * Validate text input with length limits
 */
export const validateText = (input: string, config: ValidationConfig = {}): ValidationResult => {
  const sanitized = sanitizeInput(input, config);

  if (config.required && (!sanitized || sanitized.trim() === '')) {
    return { isValid: false, error: 'This field is required' };
  }

  if (!config.allowEmpty && sanitized.trim() === '') {
    return { isValid: false, error: 'This field cannot be empty' };
  }

  if (config.minLength && sanitized.length < config.minLength) {
    return { isValid: false, error: `Must be at least ${config.minLength} characters` };
  }

  if (config.maxLength && sanitized.length > config.maxLength) {
    return { isValid: false, error: `Must be at most ${config.maxLength} characters` };
  }

  if (config.pattern && !config.pattern.test(sanitized)) {
    return { isValid: false, error: 'Invalid format' };
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate GPS coordinates
 */
export const validateCoordinates = (lat: string, lng: string): ValidationResult => {
  const latResult = validateNumber(lat, { 
    required: false, 
    minLength: -90, 
    maxLength: 90 
  });
  
  const lngResult = validateNumber(lng, { 
    required: false, 
    minLength: -180, 
    maxLength: 180 
  });

  if (!latResult.isValid) {
    return { isValid: false, error: 'Invalid latitude (must be -90 to 90)' };
  }

  if (!lngResult.isValid) {
    return { isValid: false, error: 'Invalid longitude (must be -180 to 180)' };
  }

  return { 
    isValid: true, 
    sanitizedValue: { 
      lat: latResult.sanitizedValue, 
      lng: lngResult.sanitizedValue 
    } 
  };
};

/**
 * Validate date input
 */
export const validateDate = (date: string, config: ValidationConfig = {}): ValidationResult => {
  if (!date || date.trim() === '') {
    if (config.required) {
      return { isValid: false, error: 'Date is required' };
    }
    return { isValid: true, sanitizedValue: '' };
  }

  const sanitized = sanitizeInput(date);
  
  // Check for common date formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
  ];

  const isValidFormat = datePatterns.some(pattern => pattern.test(sanitized));
  
  if (!isValidFormat) {
    return { isValid: false, error: 'Invalid date format (use YYYY-MM-DD)' };
  }

  // Check if it's a valid date
  const dateObj = new Date(sanitized);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Invalid date' };
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Comprehensive validation for package data
 */
export const validatePackageData = (packageData: any): ValidationResult => {
  const errors: string[] = [];

  // Validate required fields
  if (!packageData.customer_name || packageData.customer_name.trim() === '') {
    errors.push('Customer name is required');
  }

  // Validate customer name
  const nameResult = validateText(packageData.customer_name || '', {
    required: true,
    minLength: 2,
    maxLength: 100,
    dataType: 'text'
  });
  if (!nameResult.isValid && nameResult.error) {
    errors.push(nameResult.error);
  }

  // Validate phone numbers
  if (packageData.customer_phone) {
    const phoneResult = validatePhone(packageData.customer_phone);
    if (!phoneResult.isValid && phoneResult.error) {
      errors.push(`Customer phone: ${phoneResult.error}`);
    }
  }

  if (packageData.customer_phone_2) {
    const phone2Result = validatePhone(packageData.customer_phone_2);
    if (!phone2Result.isValid && phone2Result.error) {
      errors.push(`Customer phone 2: ${phone2Result.error}`);
    }
  }

  // Validate address
  if (packageData.customer_address) {
    const addressResult = validateText(packageData.customer_address, {
      required: false,
      minLength: 5,
      maxLength: 500,
      dataType: 'text'
    });
    if (!addressResult.isValid && addressResult.error) {
      errors.push(`Address: ${addressResult.error}`);
    }
  }

  // Validate weight
  if (packageData.weight) {
    const weightResult = validateNumber(packageData.weight, {
      required: false,
      minLength: 0.1,
      maxLength: 1000
    });
    if (!weightResult.isValid && weightResult.error) {
      errors.push(`Weight: ${weightResult.error}`);
    }
  }

  // Validate price
  if (!packageData.is_paid && packageData.price !== undefined) {
    const priceResult = validateNumber(packageData.price.toString(), {
      required: true,
      minLength: 0.01
    });
    if (!priceResult.isValid && priceResult.error) {
      errors.push(`Price: ${priceResult.error}`);
    }
  }

  // Validate GPS coordinates
  if (packageData.gps_lat || packageData.gps_lng) {
    const coordResult = validateCoordinates(
      packageData.gps_lat?.toString() || '', 
      packageData.gps_lng?.toString() || ''
    );
    if (!coordResult.isValid && coordResult.error) {
      errors.push(coordResult.error);
    }
  }

  // Validate description
  if (packageData.description) {
    const descResult = validateText(packageData.description, {
      required: false,
      maxLength: 1000,
      dataType: 'text'
    });
    if (!descResult.isValid && descResult.error) {
      errors.push(`Description: ${descResult.error}`);
    }
  }

  // Validate sender info
  if (packageData.sender_name) {
    const senderResult = validateText(packageData.sender_name, {
      required: false,
      minLength: 2,
      maxLength: 100,
      dataType: 'text'
    });
    if (!senderResult.isValid && senderResult.error) {
      errors.push(`Sender name: ${senderResult.error}`);
    }
  }

  if (packageData.sender_phone) {
    const senderPhoneResult = validatePhone(packageData.sender_phone);
    if (!senderPhoneResult.isValid && senderPhoneResult.error) {
      errors.push(`Sender phone: ${senderPhoneResult.error}`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, error: errors.join(', ') };
  }

  return { isValid: true };
};

/**
 * Generic validation function
 */
export const validateInput = (value: any, config: ValidationConfig): ValidationResult => {
  switch (config.dataType) {
    case 'email':
      return validateEmail(value);
    case 'phone':
      return validatePhone(value);
    case 'number':
      return validateNumber(value, config);
    case 'date':
      return validateDate(value, config);
    case 'url':
      return validateText(value, { ...config, pattern: /^https?:\/\/.+/ });
    case 'text':
    default:
      return validateText(value, config);
  }
};

/**
 * Batch validation for multiple fields
 */
export const validateFields = (fields: Record<string, any>, configs: Record<string, ValidationConfig>): ValidationResult => {
  const errors: string[] = [];
  const sanitizedData: Record<string, any> = {};

  Object.entries(configs).forEach(([fieldName, config]) => {
    const result = validateInput(fields[fieldName], config);
    
    if (!result.isValid) {
      if (result.error) {
        errors.push(`${fieldName}: ${result.error}`);
      }
    } else if (result.sanitizedValue !== undefined) {
      sanitizedData[fieldName] = result.sanitizedValue;
    }
  });

  if (errors.length > 0) {
    return { isValid: false, error: errors.join(', ') };
  }

  return { isValid: true, sanitizedValue: sanitizedData };
};
