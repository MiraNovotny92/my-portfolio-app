import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"; // NEW IMPORT

// --- YOUR CONFIG (Keep your existing keys!) ---
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
const db = getFirestore(app); // NEW: Initialize Database
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

// NEW: Save User's Script URL to Database
export const saveUserUrl = async (userId, url) => {
  try {
    await setDoc(doc(db, "users", userId), { scriptUrl: url }, { merge: true });
  } catch (e) {
    console.error("Error saving URL: ", e);
  }
};

// NEW: Get User's Script URL from Database
export const getUserUrl = async (userId) => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().scriptUrl;
    } else {
      return null;
    }
  } catch (e) {
    console.error("Error getting URL: ", e);
    return null;
  }
};

export { auth };