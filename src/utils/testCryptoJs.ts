/**
 * Test crypto-js in React Native
 * 
 * This utility tests if crypto-js is working correctly in the React Native environment.
 * Call this from your app to verify crypto-js functionality.
 */

import CryptoJS from 'crypto-js';

/**
 * Hash PIN using SHA-256
 */
const hashPin = (pin: string): string => {
  return CryptoJS.SHA256(pin).toString();
};

export const testCryptoJsInRN = async (): Promise<void> => {
  console.log('\n🧪 ========== Testing crypto-js in React Native ==========\n');

  try {
    // Test 1: Hash a test PIN
    console.log('Test 1: Hashing test PIN "12345678"...');
    try {
      const testPin = '12345678';
      const hash = hashPin(testPin);
      console.log('✅ Hash generated:', hash.substring(0, 30) + '...\n');

      // Test 2: Verify the hash
      console.log('Test 2: Verifying the hash...');
      const isMatch = hashPin(testPin) === hash;
      console.log(isMatch ? '✅ Hash verification works!' : '❌ Hash verification failed', '\n');

      // Test 3: Test with wrong PIN
      console.log('Test 3: Testing with wrong PIN "87654321"...');
      const wrongPin = '87654321';
      const wrongHash = hashPin(wrongPin);
      const isWrongMatch = wrongHash === hash;
      console.log(isWrongMatch ? '❌ Wrong PIN matched (ERROR!)' : '✅ Wrong PIN correctly rejected', '\n');

      // Test 4: Test with driver PINs
      console.log('Test 4: Testing with driver PIN "0001"...');
      const driverPin = '0001';
      const driverHash = hashPin(driverPin);
      console.log('Driver PIN:', driverPin);
      console.log('Driver Hash:', driverHash.substring(0, 30) + '...');
      console.log('Expected hash for DRV-001:', '888b19a43b151683c87895f6211d9f8640f97bdc8ef32f03dbe057c8f5e56d32'.substring(0, 30) + '...');
      const driverMatch = driverHash === '888b19a43b151683c87895f6211d9f8640f97bdc8ef32f03dbe057c8f5e56d32';
      console.log('Driver PIN test:', driverMatch ? '✅ Match!' : '❌ No match', '\n');

      // Test 5: Test with admin PIN
      console.log('Test 5: Testing with admin PIN "90230155"...');
      const adminPin = '90230155';
      const adminHash = hashPin(adminPin);
      console.log('Admin PIN:', adminPin);
      console.log('Admin Hash:', adminHash.substring(0, 30) + '...\n');

      // Summary
      console.log('========== Test Summary ==========');
      console.log('Hash generation: ✅');
      console.log('Hash verification:', isMatch ? '✅' : '❌');
      console.log('Wrong PIN rejection:', !isWrongMatch ? '✅' : '❌');
      console.log('Driver PIN test:', driverMatch ? '✅' : '❌');
      console.log('Admin PIN hash generation: ✅');
      console.log('==================================\n');

    } catch (error) {
      console.error('❌ Test failed:', error, '\n');
    }
  } catch (error) {
    console.error('❌ Overall test failed:', error);
  }
};
