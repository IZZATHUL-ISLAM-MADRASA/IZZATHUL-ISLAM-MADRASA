import { db, getCachedDocs, setDocument, updateDocument } from "./firebase-config.js";
import { 
  collection, query, where, doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { cleanPhone } from "./utils.js";

// Verify credentials directly against the Firestore `users` collection
export async function loginUser(role, identifier, password) {
  const usersRef = collection(db, "users");
  let q;

  if (role === "admin") {
    const cleanUser = identifier.trim().toLowerCase();
    q = query(usersRef, where("role", "==", "admin"), where("username", "==", cleanUser));
  } else if (role === "staff") {
    const cleanUser = identifier.trim().toLowerCase();
    q = query(usersRef, where("role", "==", "staff"), where("username", "==", cleanUser));
  } else {
    // Parent login by 10-digit mobile number
    const phone = cleanPhone(identifier);
    q = query(usersRef, where("role", "==", "parent"), where("phone", "==", phone));
  }

  const snap = await getCachedDocs(q, "users");

  // Auto-bootstrap master admin on the very first run if collection is empty
  if (snap.empty && role === "admin" && identifier.trim().toLowerCase() === "admin" && password === "admin123") {
    const adminRef = doc(usersRef, "admin_master");
    const adminData = {
      username: "admin",
      password: "admin123",
      role: "admin",
      name: "Super Administrator / Headmaster",
      createdAt: new Date().toISOString()
    };
    await setDocument("users", adminRef.id, adminData);
    return { id: "admin_master", ...adminData };
  }

  if (snap.empty) {
    throw new Error(`No ${role} profile found with identifier: "${identifier}".`);
  }

  const userDoc = snap.docs[0];
  const userData = userDoc.data();

  if (userData.password !== password) {
    throw new Error("Invalid password. Please check your credentials.");
  }

  return { id: userDoc.id, ...userData };
}

// Register or fetch parent record in Firestore `users`
export async function createOrUpdateParent(phone, defaultPassword) {
  const clean = cleanPhone(phone);
  const q = query(collection(db, "users"), where("role", "==", "parent"), where("phone", "==", clean));
  const snap = await getCachedDocs(q, "users");

  if (snap.empty) {
    const docId = `parent_${clean}`;
    const parentData = {
      phone: clean,
      password: defaultPassword, // e.g. Child's DOB in DDMMYYYY
      role: "parent",
      createdAt: new Date().toISOString()
    };
    await setDocument("users", docId, parentData);
    return docId;
  }
  return snap.docs[0].id;
}

// Register a staff member directly in Firestore `users`
export async function createStaffUser(username, password, name, isTeaching, phone = "") {
  const cleanUser = username.trim().toLowerCase();
  const q = query(collection(db, "users"), where("username", "==", cleanUser));
  const snap = await getCachedDocs(q, "users");

  if (!snap.empty) {
    throw new Error(`Username "${cleanUser}" already exists.`);
  }

  const docId = `staff_${cleanUser}`;
  const staffData = {
    username: cleanUser,
    password,
    name,
    role: "staff",
    isTeaching,
    phone,
    createdAt: new Date().toISOString()
  };
  await setDocument("users", docId, staffData);
  return docId;
}

// User password change
export async function updateUserPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }
  await updateDocument("users", userId, {
    password: newPassword,
    updatedAt: new Date().toISOString()
  });
}

// Read logged-in session
export function getSessionUser() {
  const raw = sessionStorage.getItem("izzath_user");
  return raw ? JSON.parse(raw) : null;
}

// End session
export function logout() {
  sessionStorage.removeItem("izzath_user");
  window.location.href = "login.html";
}