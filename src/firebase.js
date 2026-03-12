// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

// ⭐ UPDATED Config to match your Project Settings exactly
const firebaseConfig = {
  apiKey: "AIzaSyDY0PAA1OIyLvBqKz24r2sfezv6jNShuY0",
  authDomain: "rvm-web-app.firebaseapp.com",
  projectId: "rvm-web-app",
  storageBucket: "rvm-web-app.firebasestorage.app",
  messagingSenderId: "738705045695",
  appId: "1:738705045695:web:cc8111ad8fa1bb5cd8ae0a",
  measurementId: "G-FQ5QV62775" // Added this to match settings
};

// Initialize App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

auth.languageCode = "en";

// ⭐ FIX: Safety check before accessing settings
// Set this to TRUE if using "Phone numbers for testing" (e.g., +1 650-555-3434)
// Set this to FALSE if using REAL PHONES
if (auth.settings) {
  auth.settings.appVerificationDisabledForTesting = false; 
}

export { auth, RecaptchaVerifier, signInWithPhoneNumber };