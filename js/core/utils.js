// Calculate overall grade from percentage
export function calculateGrade(pct) {
  if (pct >= 90) return { grade: "A+", points: 10, remark: "Outstanding" };
  if (pct >= 80) return { grade: "A", points: 9, remark: "Excellent" };
  if (pct >= 70) return { grade: "B+", points: 8, remark: "Very Good" };
  if (pct >= 60) return { grade: "B", points: 7, remark: "Good" };
  if (pct >= 50) return { grade: "C+", points: 6, remark: "Satisfactory" };
  if (pct >= 40) return { grade: "C", points: 5, remark: "Pass" };
  return { grade: "F", points: 0, remark: "Needs Improvement" };
}

// Format 4-digit admission number string
export function padAdmissionNo(num) {
  const n = parseInt(num, 10);
  return isNaN(n) ? "1001" : String(n).padStart(4, "0");
}

// Convert DOB (YYYY-MM-DD) into DDMMYYYY for password
export function dobToPassword(dobString) {
  if (!dobString) return "01012015";
  const [y, m, d] = dobString.split("-");
  return `${d}${m}${y}`;
}

// Format phone number
export function cleanPhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

// Date formatter
export function formatDate(dateVal) {
  if (!dateVal) return "-";
  const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}