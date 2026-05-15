/**
 * Environment Configuration
 * 
 * This file handles environment variables for the app.
 * 
 * IMPORTANT: Admin PIN is now stored securely in Firestore with SHA-256 hashing.
 * No hardcoded PINs in the code!
 */

// Firebase Project ID
export const FIREBASE_PROJECT_ID = 'anonymous-98bf3';

/**
 * Admin Authentication - Permanent Solution
 * 
 * The admin PIN is now stored securely in Firestore:
 * 
 * 1. Initialization:
 *    - Run: npx ts-node scripts/initializeAdminPin.ts <your-8-digit-PIN>
 *    - This creates a SHA-256 hash and stores it in Firestore
 * 
 * 2. Authentication:
 *    - Admin enters PIN in the app
 *    - PIN is verified against the SHA-256 hash
 *    - Works offline with local cache (24-hour validity)
 * 
 * 3. Changing PIN:
 *    - Admin can change PIN from the app settings
 *    - Requires current PIN verification
 *    - New PIN is hashed and stored securely
 * 
 * 4. Security Features:
 *    - SHA-256 hashing (crypto-js)
 *    - No plaintext PINs stored anywhere
 *    - Local cache for offline access
 *    - Cache expires after 24 hours
 * 
 * This approach is production-ready and secure!
 */

// Validate configuration
export const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!FIREBASE_PROJECT_ID) {
    errors.push('❌ Firebase Project ID is missing');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Log configuration warnings in development
if (__DEV__) {
  const { errors } = validateConfig();
  if (errors.length > 0) {
    console.warn('Configuration Warnings:');
    errors.forEach(error => console.warn(error));
  }
}
