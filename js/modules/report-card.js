import { db, getCachedDocs } from "../core/firebase-config.js";
import { collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { calculateGrade } from "../core/utils.js";

function getSubjectResults(resultRecord, exam) {
  return Object.entries(resultRecord || {})
    .filter(([key, value]) => key.startsWith("marks_") && value && typeof value === "object")
    .map(([key, value]) => {
      const subjectId = value.subjectId || key.slice("marks_".length);
      const schedule = (exam?.schedules || []).find(item => item.subjectId === subjectId);
      const scheduledMax = (schedule?.modes || []).reduce((total, mode) => total + (Number(mode.max) || 0), 0);
      const maxTotal = Number(value.maxTotal) || scheduledMax || 100;
      const total = value.total === "AB" ? 0 : (Number(value.total) || 0);

      return {
        ...value,
        subjectId,
        subjectName: value.subjectName || subjectId,
        maxTotal,
        percentage: value.percentage !== undefined
          ? Number(value.percentage)
          : (value.isAbsent ? 0 : (total / maxTotal) * 100)
      };
    });
}

function getPublicSubjectResults(snapshot, exam) {
  return snapshot.docs.flatMap(resultDoc => {
    const result = resultDoc.data();
    const consolidatedResults = getSubjectResults(result, exam);
    if (consolidatedResults.length > 0) return consolidatedResults;
    if (!result.modeMarks) return [];

    const schedule = (exam?.schedules || []).find(item => item.subjectName === result.subjectName);
    const maxTotal = (schedule?.modes || []).reduce((total, mode) => total + (Number(mode.max) || 0), 0) || 100;
    const total = result.total === "AB" ? 0 : (Number(result.total) || 0);
    return [{
      ...result,
      maxTotal,
      percentage: result.total === "AB" ? 0 : (total / maxTotal) * 100
    }];
  });
}

export const ReportCardModule = {
  id: "report-card",
  title: "Report Card Generator",
  roles: ["admin", "staff"],

  async generateHtml(student, exam, subjectResults, resultRecord = {}) {
    let grandTotal = 0;
    let grandMax = 0;
    let allPassed = true;

    const rowsHtml = subjectResults.map(sr => {
      const modeBreakdown = Object.entries(sr.modeMarks || {})
        .map(([mName, val]) => `${mName}: <strong>${val}</strong>`)
        .join(" | ");

      const totalVal = sr.isAbsent ? "AB" : (sr.total ?? 0);
      grandTotal += sr.isAbsent ? 0 : (parseFloat(totalVal || 0) || 0);
      grandMax += Number(sr.maxTotal) || 0;
      if (!sr.isPassed) allPassed = false;

      return `
        <tr style="text-align:center;">
          <td style="padding:8px; text-align:left;"><strong>${sr.subjectName}</strong></td>
          <td style="padding:8px; font-size:12px; color:#475569;">${modeBreakdown || '-'}</td>
          <td style="padding:8px;">${totalVal} / ${sr.maxTotal}</td>
          <td style="padding:8px;"><span class="badge ${sr.grade==='F'||sr.isAbsent?'badge-inactive':'badge-active'}">${sr.grade}</span></td>
          <td style="padding:8px;">${sr.isAbsent ? "-" : `${Number(sr.percentage || 0).toFixed(1)}%`}</td>
          <td style="padding:8px;">${sr.isAbsent ? 'Absent' : (sr.isPassed ? 'Passed' : 'Failed')}</td>
        </tr>
      `;
    }).join("");
    const overallPercentage = grandMax > 0 ? (grandTotal / grandMax) * 100 : 0;
    const { grade: overallGrade } = calculateGrade(overallPercentage);
    const examAttendance = resultRecord.examAttendance?.status;

    return `
      <div id="report-card-print-area" style="background:#fff; padding:clamp(16px, 4vw, 32px); border:2px solid #065f46; border-radius:8px; width:100%; max-width:900px; margin:0 auto; color:#0f172a;">
        <div style="text-align:center; border-bottom:2px solid #065f46; padding-bottom:12px; margin-bottom:16px;">
          <h2 style="color:#065f46; margin:0; font-size:22px; text-transform:uppercase;">Izzathul Islam Madrasa</h2>
          <p style="font-size:12px; color:#64748b; margin:2px 0;">Affiliated with Samastha Kerala Jam'iyyathul Ulama (Reg No. 9016) | Bengaluru</p>
          <h3 style="margin-top:6px; font-size:16px; color:#d97706;">ANNUAL PROGRESS REPORT CARD</h3>
        </div>

        <table style="width:100%; font-size:13px; margin-bottom:16px; border:none;">
          <tr>
            <td style="border:none;"><strong>Student Name:</strong> ${student.name}</td>
            <td style="border:none;"><strong>Admission No:</strong> ${student.admissionNo}</td>
          </tr>
          <tr>
            <td style="border:none;"><strong>Classroom:</strong> ${student.classroomName || '-'}</td>
            <td style="border:none;"><strong>Mode:</strong> ${(student.mode||'offline').toUpperCase()}</td>
          </tr>
          <tr>
            <td style="border:none;"><strong>Examination:</strong> ${exam ? exam.name : 'Terminal Exam'}</td>
            <td style="border:none;"><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}</td>
          </tr>
          <tr>
            <td style="border:none;"><strong>Exam Attendance:</strong> ${examAttendance ? examAttendance.toUpperCase() : "Not recorded"}</td>
            <td style="border:none;"></td>
          </tr>
        </table>

        <div class="report-table-wrapper" style="overflow-x:auto; margin-bottom:16px;">
        <table style="width:100%; min-width:600px; border-collapse:collapse;" border="1">
          <thead>
            <tr style="background:#f1f5f9; font-size:13px;">
              <th style="padding:8px;">Subject</th>
              <th style="padding:8px;">Assessment Breakdown</th>
              <th style="padding:8px;">Score</th>
              <th style="padding:8px;">Grade</th>
              <th style="padding:8px;">Percentage</th>
              <th style="padding:8px;">Result</th>
            </tr>
          </thead>
          <tbody style="font-size:13px;">
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="6" style="text-align:center;padding:12px;">No subject marks recorded yet.</td></tr>'}
          </tbody>
        </table>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
          <div>Grand Total: <strong>${grandTotal} / ${grandMax}</strong></div>
          <div>Overall Percentage: <strong>${overallPercentage.toFixed(1)}%</strong></div>
          <div>Overall Grade: <strong>${overallGrade}</strong></div>
          <div>Overall Status: <strong style="color:${subjectResults.length > 0 && allPassed ? '#16a34a' : '#dc2626'};">${subjectResults.length > 0 && allPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}</strong></div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:40px; text-align:center; font-size:13px;">
          <div>___________________<br/>Class Teacher</div>
          <div>___________________<br/>Headmaster / Sadar</div>
          <div>___________________<br/>Parent / Guardian</div>
        </div>
      </div>
    `;
  },

  async render(container, user) {
    const [eSnap, sSnap] = await Promise.all([
      getCachedDocs(collection(db, "exams"), "exams"),
      getCachedDocs(collection(db, "students"), "students")
    ]);

    const exams = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const students = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div class="no-print">
        <h2>Report Card Print Center</h2>
        <p style="color:var(--text-muted);font-size:13px;">Generate and print comprehensive multi-subject report cards.</p>

        <div style="display:flex; gap:12px; margin: 16px 0; align-items:flex-end; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <label>Select Examination</label>
            <select id="rc-exam">
              ${exams.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
            </select>
          </div>
          <div style="flex:2; min-width:260px;">
            <label>Select Student</label>
            <select id="rc-student">
              ${students.map(st => `<option value="${st.id}">[${st.admissionNo}] ${st.name} (${st.classroomName})</option>`).join("")}
            </select>
          </div>
          <button class="btn-primary" id="generate-rc-btn">Load Report Card</button>
          <button class="btn-secondary" onclick="window.print()">🖨️ Print Card</button>
        </div>
      </div>

      <div id="report-card-view-target"></div>
    `;

    container.querySelector("#generate-rc-btn").onclick = async () => {
      const examId = document.getElementById("rc-exam").value;
      const studentId = document.getElementById("rc-student").value;
      const target = document.getElementById("report-card-view-target");

      target.innerHTML = "<p>Compiling marksheet...</p>";

      const student = students.find(s => s.id === studentId);
      const exam = exams.find(e => e.id === examId);

      const rSnap = await getCachedDocs(query(
        collection(db, "results"),
        where("examId", "==", examId),
        where("studentId", "==", studentId)
      ), "results", `exam:${examId}:student:${studentId}`);

      const resultRecord = rSnap.empty ? {} : rSnap.docs[0].data();
      const subjectResults = getSubjectResults(resultRecord, exam);
      target.innerHTML = await this.generateHtml(student, exam, subjectResults, resultRecord);
    };
  },

  // Helper used by the Parent Dashboard
  async renderForStudent(container, student) {
    const eSnap = await getCachedDocs(collection(db, "exams"), "exams");
    const exams = eSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.isPublished);

    if (exams.length === 0) {
      container.innerHTML = "<p>No published examination results available yet.</p>";
      return;
    }

    const latestExam = exams[0];
    const rSnap = await getCachedDocs(query(
      collection(db, "public_results"),
      where("admissionNo", "==", student.admissionNo),
      where("dob", "==", student.dob),
      where("examId", "==", latestExam.id)
    ), "public_results", `student:${student.admissionNo}:exam:${latestExam.id}`);
    const resultRecord = rSnap.empty ? {} : rSnap.docs[0].data();
    const subjectResults = getPublicSubjectResults(rSnap, latestExam);
    container.innerHTML = await this.generateHtml(student, latestExam, subjectResults, resultRecord);
  }
};