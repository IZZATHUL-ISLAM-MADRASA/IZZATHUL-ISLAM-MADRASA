// Calculate overall grade from percentage
export function calculateGrade(pct) {
  if (pct >= 90) return { grade: "A+", points: 10, remark: "Outstanding" };
  if (pct >= 80) return { grade: "A", points: 9, remark: "Excellent" };
  if (pct >= 70) return { grade: "B+", points: 8, remark: "Very Good" };
  if (pct >= 60) return { grade: "B", points: 7, remark: "Good" };
  if (pct >= 50) return { grade: "C+", points: 6, remark: "Satisfactory" };
  if (pct >= 40) return { grade: "C", points: 5, remark: "Pass" };
  if (pct >= 33) return { grade: "D", points: 4, remark: "Needs Improvement" };
  if (pct >= 20) return { grade: "E", points: 2, remark: "Needs Improvement" };
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
  return String(phone || "").replace(/\D/g, "").slice(-15);
}

// Date formatter
export function formatDate(dateVal) {
  if (!dateVal) return "-";
  const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function getmyclassRooms(userOrId, classrooms = [], allocations = []) {
  const user = typeof userOrId === "object" && userOrId !== null
    ? userOrId
    : { id: userOrId, role: "staff" };
  const identities = new Set(
    [user.id, user.uid, user.username, user.name]
      .filter(Boolean)
      .map(value => String(value).trim().toLowerCase())
  );
  const isAdmin = user.role === "admin" || user.role === "superadmin";

  const matchesTeacher = teacher => {
    if (teacher === null || teacher === undefined) return false;
    if (typeof teacher !== "object") {
      return identities.has(String(teacher).trim().toLowerCase());
    }

    return [teacher.id, teacher.uid, teacher.userId, teacher.teacherId, teacher.teacherUid, teacher.staffId, teacher.username, teacher.name]
      .filter(Boolean)
      .some(value => identities.has(String(value).trim().toLowerCase()));
  };

  const assignedClassroomIds = new Set(
    allocations
      .filter(allocation => matchesTeacher({
        id: allocation.teacherId,
        username: allocation.teacherUsername,
        name: allocation.teacherName
      }))
      .map(allocation => allocation.classroomId)
      .filter(Boolean)
  );

  return classrooms
    .map(room => {
      const classId = room.classId || room.class?.id || "";
      const className = room.className || room.class?.name || "";
      const divId = room.divId || room.divisionId || room.division?.id || "";
      const divCode = room.divCode || room.divisionCode || room.division?.code || "";
      const mode = String(room.mode || "offline").toLowerCase();

      return {
        ...room,
        classId,
        className,
        divId,
        divCode,
        mode,
        name: room.name || [className, divCode && `Div ${divCode}`].filter(Boolean).join(" - "),
        class: { ...(room.class || {}), id: classId, name: className },
        division: { ...(room.division || {}), id: divId, code: divCode }
      };
    })
    .filter(room => {
      if (isAdmin || user.role !== "staff") return true;

      const isClassTeacher = (room.classTeachers || []).some(matchesTeacher) ||
        matchesTeacher(room.classTeacherId);
      return isClassTeacher || assignedClassroomIds.has(room.id);
    });
}
