import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"; // NEW IMPORT

// YOUR CONFIG (Keep your existing keys here!)
const firebaseConfig = {
  // ... keep your existing keys ...
  apiKey: "AIzaSy...", 
  // ...
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

// NEW: Save User's Script URL
export const saveUserUrl = async (userId, url) => {
  await setDoc(doc(db, "users", userId), { scriptUrl: url }, { merge: true });
};

// NEW: Get User's Script URL
export const getUserUrl = async (userId) => {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().scriptUrl;
  } else {
    return null;
  }
};

export { auth };