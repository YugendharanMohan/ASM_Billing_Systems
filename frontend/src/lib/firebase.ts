import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration
// These values are safe to expose in frontend code — they identify the project,
// not grant access. Security is enforced by Firebase Security Rules.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCF0EQpmBGAT_Wo4elFmUCgVYLhuzquZqM",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "asm-billing-systems.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "asm-billing-systems",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "asm-billing-systems.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth instance for use across the app
export const auth = getAuth(app);
export default app;
