import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  collection,
  doc,
  addDoc,
  getDocFromServer,
  getDocs,
  increment,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDmYkO6Ivno8LqjrxHjZwA_D5d2rMLUKyw",
  authDomain: "izzathulislam-2cae0.firebaseapp.com",
  projectId: "izzathulislam-2cae0",
  storageBucket: "izzathulislam-2cae0.firebasestorage.app",
  messagingSenderId: "215037378087",
  appId: "1:215037378087:web:8e705fe380c1d7c6909802",
  measurementId: "G-DGPKPMPK9T"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const CACHE_PREFIX = "izzathulislammadrasa:v2";
const CACHE_SCHEMA = 1;
const collectionRevisionCache = new Map();
const SENSITIVE_COLLECTIONS = new Set([
  "users",
  "students",
  "results",
  "public_results",
  "attendance",
  "admissions",
  "audit_logs"
]);

if (typeof window !== "undefined") {
  window.addEventListener("storage", event => {
    if (event.key?.startsWith(`${CACHE_PREFIX}:revision:`)) {
      const collectionName = event.key.slice(`${CACHE_PREFIX}:revision:`.length);
      collectionRevisionCache.delete(collectionName);
    }
  });
}

function invalidateCollectionRevision(collectionName) {
  collectionRevisionCache.delete(collectionName);
  try {
    localStorage.removeItem(`${CACHE_PREFIX}:revision:${collectionName}`);
  } catch (error) {
    console.warn(`Unable to invalidate the ${collectionName} local cache revision.`, error);
  }
}

function getUserCacheScope() {
  try {
    const user = JSON.parse(sessionStorage.getItem("izzath_user") || "null");
    return user ? `${user.role || "user"}:${user.id || user.phone || user.username || "unknown"}` : "public";
  } catch (error) {
    console.warn("Unable to read the current user for local cache scoping.", error);
    return "public";
  }
}

function getCacheKey(collectionName, queryKey) {
  return `${CACHE_PREFIX}:${getUserCacheScope()}:${collectionName}:${queryKey}`;
}

function readLocalCache(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn("Unable to read the local Firestore cache.", error);
    return null;
  }
}

function writeLocalCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Unable to persist the Firestore query cache.", error);
  }
}

async function getCollectionRevision(collectionName) {
  if (!collectionRevisionCache.has(collectionName)) {
    const revisionPromise = getDocFromServer(doc(db, "_app_meta", collectionName))
      .then(snapshot => snapshot.exists() ? Number(snapshot.data().revision) || 0 : 0)
      .catch(error => {
        if (error.code === "unavailable" || error.code === "failed-precondition") {
          const cached = readLocalCache(`${CACHE_PREFIX}:revision:${collectionName}`);
          if (cached && Number.isFinite(cached.revision)) return cached.revision;
        }
        throw error;
      });
    collectionRevisionCache.set(collectionName, revisionPromise);
  }

  const revision = await collectionRevisionCache.get(collectionName);
  writeLocalCache(`${CACHE_PREFIX}:revision:${collectionName}`, { revision });
  return revision;
}

function makeSnapshot(cached) {
  const docs = cached.docs.map(item => ({
    id: item.id,
    data: () => item.data,
    exists: () => true
  }));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach(callback) {
      docs.forEach(callback);
    }
  };
}

export async function getCachedDocs(firestoreQuery, collectionName, queryKey = "all") {
  if (SENSITIVE_COLLECTIONS.has(collectionName)) {
    return getDocs(firestoreQuery);
  }

  const key = getCacheKey(collectionName, queryKey);
  const revision = await getCollectionRevision(collectionName);
  const cached = readLocalCache(key);

  if (cached?.schema === CACHE_SCHEMA && cached.revision === revision) {
    return makeSnapshot(cached);
  }

  const snapshot = await getDocs(firestoreQuery);
  const docs = snapshot.docs
    .map(item => ({ id: item.id, data: item.data() }))
    .filter(item => item.data.isDeleted !== true);
  const entry = { schema: CACHE_SCHEMA, revision, docs };
  writeLocalCache(key, entry);
  return makeSnapshot(entry);
}

function addCollectionRevision(batch, collectionName) {
  batch.set(doc(db, "_app_meta", collectionName), {
    revision: increment(1),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function setDocument(collectionName, documentId, data, options = {}) {
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();
  batch.set(doc(db, collectionName, documentId), {
    ...data,
    updatedAt: timestamp
  }, options);
  addCollectionRevision(batch, collectionName);
  await batch.commit();
  invalidateCollectionRevision(collectionName);
  return timestamp;
}

export async function updateDocument(collectionName, documentId, data) {
  const batch = writeBatch(db);
  batch.update(doc(db, collectionName, documentId), {
    ...data,
    updatedAt: new Date().toISOString()
  });
  addCollectionRevision(batch, collectionName);
  await batch.commit();
  invalidateCollectionRevision(collectionName);
}

export async function deleteDocument(collectionName, documentId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, collectionName, documentId));
  addCollectionRevision(batch, collectionName);
  await batch.commit();
  invalidateCollectionRevision(collectionName);
}

export async function softDeleteDocument(collectionName, documentId) {
  return updateDocument(collectionName, documentId, {
    isDeleted: true,
    deletedAt: new Date().toISOString()
  });
}

export async function commitTrackedBatch(batch, collectionNames) {
  const uniqueCollections = [...new Set(collectionNames)];
  uniqueCollections.forEach(collectionName => addCollectionRevision(batch, collectionName));
  await batch.commit();
  uniqueCollections.forEach(invalidateCollectionRevision);
}

export async function addTrackedDocument(collectionName, data) {
  const documentRef = doc(collection(db, collectionName));
  await setDocument(collectionName, documentRef.id, data);
  return documentRef.id;
}

export async function addDocument(collectionName, data) {
  const documentRef = await addDoc(collection(db, collectionName), data);
  return documentRef.id;
}