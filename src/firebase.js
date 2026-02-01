// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// YOUR JAMIEZ APP CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyBSoIu98oRFHvcCasLmdMYkO3b18ZM-lOE",
  authDomain: "jamiez-38bfc.firebaseapp.com",
  projectId: "jamiez-38bfc",
  storageBucket: "jamiez-38bfc.firebasestorage.app",
  messagingSenderId: "856024076099",
  appId: "1:856024076099:web:3bb511ae8f40917037e9f6",
  measurementId: "G-YLVSJE9EH2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Login Function
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Login failed", error);
    alert(error.message);
  }
};

// Logout Function
export const logout = () => {
  return signOut(auth);
};

export { auth };