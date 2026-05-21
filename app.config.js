/**
 * Loads .env for Metro / Expo so EXPO_PUBLIC_* vars are inlined into the app bundle.
 * After changing .env: npx expo start -c (and rebuild dev client if needed: npx expo run:android).
 */
require('dotenv').config();

const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
  },
};
