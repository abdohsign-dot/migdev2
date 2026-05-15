import CryptoJS from 'crypto-js';

// Test PIN hashing
const testPin = '90230155';
const hash = CryptoJS.SHA256(testPin).toString();

console.log('PIN:', testPin);
console.log('Hash:', hash);

// Test verification
const enteredPin = '90230155';
const enteredHash = CryptoJS.SHA256(enteredPin).toString();

console.log('Entered PIN:', enteredPin);
console.log('Entered Hash:', enteredHash);
console.log('Match:', hash === enteredHash);
