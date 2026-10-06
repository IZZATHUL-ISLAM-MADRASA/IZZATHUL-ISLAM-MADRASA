import { db, getCachedDocs, addTrackedDocument } from "./firebase-config.js";
import { 
  collection, query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Fetch active academic year
export async function getActiveAcademicYear() {
  const q = query(collection(db, "academic_years"), where("status", "==", "active"), limit(1));
  const snap = await getCachedDocs(q, "academic_years", "active");
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Get next 4-digit admission number
export async function getNextAdmissionNumber() {
  const q = query(collection(db, "students"), orderBy("admissionNo", "desc"), limit(1));
  const snap = await getCachedDocs(q, "students", "next-admission-number");
  if (snap.empty) return "1001";
  const highest = parseInt(snap.docs[0].data().admissionNo, 10);
  return String(isNaN(highest) ? 1001 : highest + 1).padStart(4, "0");
}

// Audit log logger
export async function logAction(userEmail, action, details) {
  try {
    await addTrackedDocument("audit_logs", {
      userEmail: userEmail || "anonymous",
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn("Audit log error:", err);
  }
}