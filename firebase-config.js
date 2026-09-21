// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  runTransaction, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmYkO6Ivno8LqjrxHjZwA_D5d2rMLUKyw",
  authDomain: "izzathulislam-2cae0.firebaseapp.com",
  projectId: "izzathulislam-2cae0",
  storageBucket: "izzathulislam-2cae0.firebasestorage.app",
  messagingSenderId: "215037378087",
  appId: "1:215037378087:web:8e705fe380c1d7c6909802",
  measurementId: "G-DGPKPMPK9T"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with multi-tab offline local cache persistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

/**
 * Standard update wrapper that automatically stamps `updatedAt` and an optional `updatedBy`.
 */
export async function safeUpdateDoc(docRef, data, updatedBy = null) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp()
  };
  if (updatedBy) {
    payload.updatedBy = updatedBy;
  }
  return await updateDoc(docRef, payload);
}

/**
 * Safe deletion helper: Flags records as soft-deleted (isDeleted: true) to prevent accidental data loss.
 */
export async function softDeleteDoc(docRef, deletedBy = null) {
  const payload = {
    isDeleted: true,
    deletedAt: serverTimestamp()
  };
  if (deletedBy) {
    payload.deletedBy = deletedBy;
  }
  return await updateDoc(docRef, payload);
}

/**
 * Hard delete helper: Permanently removes a document from Firestore when required.
 */
export async function hardDeleteDoc(docRef) {
  console.warn(`[Firestore Deletion] Permanently deleting document: ${docRef.path}`);
  return await deleteDoc(docRef);
}

/**
 * SHA-256 Hasher using the Web Crypto API for secure password & token matching
 */
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(String(message).trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates cryptographically secure random tokens for QR verification badges
 */
export function generateSecureToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export { 
  db, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  runTransaction, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
};
