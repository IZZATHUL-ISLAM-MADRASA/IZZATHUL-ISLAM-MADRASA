import { db, getCachedDocs, setDocument } from "../core/firebase-config.js";
import { 
  collection, query, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { calculateGrade, padAdmissionNo } from "../core/utils.js";
import { UI } from "../core/ui.js";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && inQuotes && input[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some(cell => cell !== "")) rows.push(row);
  return rows;
}

function getClassroomRoster(students, classroomId) {
  return students
    .filter(student => student.classroomId === classroomId)
    .sort((a, b) => parseInt(a.admissionNo || 0, 10) - parseInt(b.admissionNo || 0, 10));
}

// Helper to determine exact pass mark and max for a given mode (online / offline)
function resolveModeThresholds(natureObj, mode) {
  const isOnline = mode === "online";
  
  // 1. Check if nature has explicit online/offline pass/max overrides
  const max = isOnline 
    ? (natureObj.maxOnline ?? natureObj.max ?? 100)
    : (natureObj.maxOffline ?? natureObj.max ?? 100);
    
  const pass = isOnline
    ? (natureObj.passOnline ?? natureObj.pass ?? (max * 0.4))
    : (natureObj.passOffline ?? natureObj.pass ?? (max * 0.35));

  return {
    name: natureObj.name,
    max: Number(max),
    pass: Number(pass)
  };
}

export const ResultsModule = {
  id: "results",
  title: "Marks & Exam Attendance",
  roles: ["admin", "staff"],

  async render(container, user) {
    const isAdmin = user.role === "admin";

    const [eSnap, cSnap, clSnap, csSnap] = await Promise.all([
      getCachedDocs(collection(db, "exams"), "exams"),
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "classroom_subjects"), "classroom_subjects")
    ]);

    const exams = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classrooms = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    let allocatedSubjects = csSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (user.role === "staff") {
      allocatedSubjects = allocatedSubjects.filter(cs => 
        cs.teacherId === user.id || 
        cs.teacherName === user.name ||
        cs.teacherId === user.username
      );
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h2>Marks &amp; Exam Attendance Master</h2>
          <p style="color:var(--text-muted);font-size:13px;">
            ${isAdmin ? 'Enter marks and track exam attendance. Mode-specific passing rules (Online vs Offline) apply automatically.' : `Logged in as Ustadh: <strong>${user.name || user.username}</strong>. Showing your assigned subjects.`}
          </p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="bulk-excel-btn">📊 Excel Bulk Marks</button>
        </div>
      </div>

      <!-- Filter Controls -->
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap:12px; align-items:flex-end;">
          <div>
            <label style="font-size:12px; font-weight:600;">1. Examination</label>
            <select id="res-exam">
              ${exams.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:600;">2. Mode</label>
            <select id="res-mode-filter">
              <option value="offline">OFFLINE</option>
              <option value="online">ONLINE</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:600;">3. Class</label>
            <select id="res-class-filter"></select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:600;">4. Classroom</label>
            <select id="res-crm"></select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:600;">5. Subject</label>
            <select id="res-sub"></select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:600;">6. Evaluation Nature</label>
            <select id="res-nature-filter">
              <option value="all">All Natures (Full Mark)</option>
            </select>
          </div>

          <div>
            <button class="btn-primary" id="load-sheet-btn" style="width:100%; height:38px;">📋 Open Roster</button>
          </div>
        </div>
      </div>

      <div id="marks-sheet-area"></div>
    `;

    const examSelect = container.querySelector("#res-exam");
    const modeSelect = container.querySelector("#res-mode-filter");
    const classSelect = container.querySelector("#res-class-filter");
    const crmSelect = container.querySelector("#res-crm");
    const subSelect = container.querySelector("#res-sub");
    const natureSelect = container.querySelector("#res-nature-filter");

    const syncClasses = () => {
      const mode = modeSelect.value;
      const relevantClasses = classes.filter(c => (c.mode || "offline") === mode);
      classSelect.innerHTML = relevantClasses.length 
        ? relevantClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join("")
        : `<option value="">-- No classes in this mode --</option>`;
      classSelect.disabled = relevantClasses.length === 0;
      syncClassrooms();
    };

    const syncClassrooms = () => {
      const classId = classSelect.value;
      const rooms = classrooms.filter(c => c.classId === classId);
      crmSelect.innerHTML = rooms.length 
        ? rooms.map(c => `<option value="${c.id}" data-name="${c.name}" data-cid="${c.classId}" data-div="${c.divCode}" data-mode="${c.mode||'offline'}">${c.name}</option>`).join("")
        : `<option value="">-- No classroom --</option>`;
      crmSelect.disabled = rooms.length === 0;
      syncSubjects();
    };

    const syncSubjects = () => {
      const crmId = crmSelect.value;
      const subjectsInCrm = allocatedSubjects.filter(cs => cs.classroomId === crmId);
      
      if (subjectsInCrm.length === 0) {
        subSelect.innerHTML = `<option value="">-- No allocated subjects found --</option>`;
        subSelect.disabled = true;
      } else {
        subSelect.innerHTML = subjectsInCrm.map(cs => `<option value="${cs.subjectId}" data-name="${cs.subjectName}">${cs.subjectName}</option>`).join("");
        subSelect.disabled = false;
      }
      syncNatures();
    };

    const syncNatures = () => {
      const examId = examSelect.value;
      const selectedExam = exams.find(e => e.id === examId);
      const classId = crmSelect.options[crmSelect.selectedIndex]?.dataset.cid;
      const subjectId = subSelect.value;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || modeSelect.value || "offline").toLowerCase();

      // Find schedule matching class, subject and mode[cite: 7]
      const sched = (selectedExam?.schedules || []).find(s => 
        (s.classId === classId || s.className === classSelect.options[classSelect.selectedIndex]?.text) &&
        s.subjectId === subjectId &&
        (s.mode === "both" || s.mode === crmMode)
      );

      const rawModes = sched?.modes || [{ name: "Marks", max: 100, pass: crmMode === 'online' ? 40 : 35 }];
      const resolvedModes = rawModes.map(m => resolveModeThresholds(m, crmMode));

      natureSelect.innerHTML = `<option value="all">All Natures (Full Mark)</option>` +
        resolvedModes.map(m => `<option value="${m.name}">${m.name} (Max: ${m.max}, Pass: ${m.pass})</option>`).join("");
    };

    modeSelect.onchange = syncClasses;
    classSelect.onchange = syncClassrooms;
    crmSelect.onchange = syncSubjects;
    subSelect.onchange = syncNatures;
    examSelect.onchange = syncNatures;
    syncClasses();

    // Roster Loader
    container.querySelector("#load-sheet-btn").onclick = async () => {
      const examId = examSelect.value;
      const crmId = crmSelect.value;
      const crmName = crmSelect.options[crmSelect.selectedIndex]?.dataset.name;
      const classId = crmSelect.options[crmSelect.selectedIndex]?.dataset.cid;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || modeSelect.value || "offline").toLowerCase();
      const subjectId = subSelect.value;
      const subjectName = subSelect.options[subSelect.selectedIndex]?.dataset.name;
      const selectedNature = natureSelect.value;
      const sheetArea = document.getElementById("marks-sheet-area");

      if (!crmId) {
        sheetArea.innerHTML = "<p style='color:red;padding:12px;background:#fff;border-radius:6px;'>Please select a valid classroom.</p>";
        return;
      }

      if (!subjectId && !isAdmin) {
        sheetArea.innerHTML = "<p style='color:red;padding:12px;background:#fff;border-radius:6px;'>You do not have any allocated subjects in this classroom.</p>";
        return;
      }

      const selectedExam = exams.find(e => e.id === examId);
      
      // Look up schedule matching mode[cite: 7]
      const sched = (selectedExam?.schedules || []).find(s => 
        (s.classId === classId || s.className === classSelect.options[classSelect.selectedIndex]?.text) &&
        s.subjectId === subjectId &&
        (s.mode === "both" || s.mode === crmMode)
      );

      const rawModes = sched?.modes || [{ name: "Marks", max: 100, pass: crmMode === 'online' ? 40 : 35 }];
      const allModes = rawModes.map(m => resolveModeThresholds(m, crmMode));
      const activeModes = selectedNature === "all" ? allModes : allModes.filter(m => m.name === selectedNature);
      const totalSubjectMax = allModes.reduce((acc, m) => acc + (m.max || 0), 0);
      const totalSubjectPass = allModes.reduce((acc, m) => acc + (m.pass || 0), 0);

      sheetArea.innerHTML = "<p>Loading students roster...</p>";

      const sSnap = await getCachedDocs(
        query(collection(db, "students"), where("classroomId", "==", crmId)),
        "students",
        `classroom:${crmId}`
      );
      const students = getClassroomRoster(sSnap.docs.map(d => ({ id: d.id, ...d.data() })), crmId);

      if (students.length === 0) {
        sheetArea.innerHTML = `<p style="padding:16px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;">No students enrolled in <strong>${crmName}</strong>.</p>`;
        return;
      }

      const resSnap = await getCachedDocs(
        query(collection(db, "results"), where("examId", "==", examId), where("classroomId", "==", crmId)),
        "results",
        `exam:${examId}:classroom:${crmId}`
      );
      const existingStudentDocs = {};
      resSnap.docs.forEach(d => { existingStudentDocs[d.data().studentId] = d.data(); });

      sheetArea.innerHTML = `
        <div style="background:#fff; border:1px solid #e2e8f0; padding:12px 16px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <strong>${selectedExam.name}</strong> • <u>${subjectName || 'Attendance Overview'}</u> (${crmName})
            <span class="badge ${crmMode === 'online' ? 'badge-online' : 'badge-offline'}" style="margin-left:8px;">
              ${crmMode.toUpperCase()} (${students.length} Students)
            </span>
            <span style="margin-left:8px; font-size:12px; color:#475569;">
              [Pass Mark Threshold: <strong>${totalSubjectPass} / ${totalSubjectMax}</strong>]
            </span>
          </div>
          <div>
            ${isAdmin ? `
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn-primary btn-sm roster-tab-btn" data-tab="marks">✍️ Marks Entry</button>
                <button type="button" class="btn-secondary btn-sm roster-tab-btn" data-tab="attendance">📋 Attendance</button>
              </div>
            ` : `
              <div><strong>Max:</strong> ${totalSubjectMax} \vert{} <strong>Pass:</strong>${totalSubjectPass}</div>
            `}
          </div>
        </div>

        <!-- MARKS ENTRY PANEL -->
        <div id="panel-marks-entry" class="roster-panel">
          ${!subjectId ? `<p style="color:var(--muted);padding:16px;">Select a subject to enter marks.</p>` : `
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Adm No</th>
                    <th>Student Name</th>
                    ${activeModes.map(m => `<th>${m.name} (Max: ${m.max} / Pass: ${m.pass})</th>`).join("")}
                    <th>Total</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${students.map(st => {
                    const docData = existingStudentDocs[st.id] || {};
                    const rec = docData[`marks_${subjectId}`] || { modeMarks: {}, isAbsent: false, total: 0, grade: "F", isPassed: false };
                    return `
                      <tr data-sid="${st.id}" data-adm="${st.admissionNo}" data-name="${st.name}">
                        <td><strong>${st.admissionNo}</strong></td>
                        <td>${st.name}</td>
                        ${activeModes.map(m => {
                          const val = rec.modeMarks ? (rec.modeMarks[m.name] ?? "") : "";
                          return `
                            <td>
                              <input 
                                type="text" 
                                class="mark-input" 
                                data-nature="${m.name}" 
                                data-max="${m.max}" 
                                data-pass="${m.pass}" 
                                value="${rec.isAbsent ? 'AB' : val}" 
                                placeholder="0-${m.max} or AB" 
                                style="width:90px;" 
                              />
                            </td>
                          `;
                        }).join("")}
                        <td class="st-total"><strong>${rec.isAbsent ? 'AB' : (rec.total ?? 0)}</strong></td>
                        <td class="st-grade"><span class="badge ${rec.isAbsent || !rec.isPassed || rec.grade === 'F' ? 'badge-inactive' : 'badge-active'}">${rec.isAbsent ? 'AB' : (rec.grade || 'F')}</span></td>
                        <td class="st-status"><span class="badge ${rec.isPassed ? 'badge-active' : 'badge-inactive'}">${rec.isAbsent ? 'ABSENT' : (rec.isPassed ? 'PASSED' : 'FAILED')}</span></td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>

            <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <p style="font-size:12px; color:var(--muted); margin:0;">
                Mode evaluated: <strong>${crmMode.toUpperCase()}</strong>. Minimum pass score required: <strong>${totalSubjectPass}</strong>.
              </p>
              <button class="btn-primary" id="save-marks-btn">💾 Save ${subjectName} Marks</button>
            </div>
          `}
        </div>

        <!-- ATTENDANCE PANEL -->
        ${isAdmin ? `
          <div id="panel-attendance-entry" class="roster-panel" style="display:none;">
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <strong style="color:#1e40af;">Attendance Entry for ${selectedExam.name}</strong>
                <p style="font-size:12px; color:#3b82f6; margin:2px 0 0 0;">
                  Stored as <code>att_${examId}: { present, total }</code>.
                </p>
              </div>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn-secondary btn-sm" id="download-att-template-btn">📥 Attendance CSV Template</button>
                <label class="btn-secondary btn-sm" style="margin:0; cursor:pointer;">
                  📤 Upload Attendance CSV
                  <input type="file" id="att-csv-file-input" accept=".csv,text/csv" style="display:none;" />
                </label>
              </div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; margin-bottom:12px; display:flex; align-items:center; gap:10px;">
              <span style="font-size:12px; font-weight:600;">Set Working Days for All:</span>
              <input type="number" id="quick-total-days" placeholder="e.g. 46" style="width:100px; padding:4px 8px; font-size:12px;" />
              <button type="button" class="btn-secondary btn-sm" id="apply-quick-total-btn">Apply</button>
            </div>

            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Adm No</th>
                    <th>Student Name</th>
                    <th>Present Days</th>
                    <th>Total Days</th>
                    <th>Percentage</th>
                    <th>Exam Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${students.map(st => {
                    const docData = existingStudentDocs[st.id] || {};
                    const attObj = docData[`att_${examId}`] || docData.examAttendance || {};
                    const present = attObj.present ?? "";
                    const total = attObj.total ?? "";
                    const status = attObj.status || (present !== "" && total !== "" ? "present" : "");
                    const pct = (Number(total) > 0 && present !== "") ? ((Number(present) / Number(total)) * 100).toFixed(1) : "-";

                    return `
                      <tr data-sid="${st.id}" data-adm="${st.admissionNo}" data-name="${st.name}" class="att-row">
                        <td><strong>${st.admissionNo}</strong></td>
                        <td>${st.name}</td>
                        <td>
                          <input type="number" class="att-present-input" value="${present}" min="0" placeholder="e.g. 10" style="width:90px;" />
                        </td>
                        <td>
                          <input type="number" class="att-total-input" value="${total}" min="1" placeholder="e.g. 46" style="width:90px;" />
                        </td>
                        <td class="att-pct-cell"><strong>${pct === "-" ? "-" : `${pct}%`}</strong></td>
                        <td>
                          <select class="att-status-select" style="width:110px; font-size:12px;">
                            <option value="present" ${status === "present" ? "selected" : ""}>Present</option>
                            <option value="absent" ${status === "absent" ? "selected" : ""}>Absent</option>
                            <option value="late" ${status === "late" ? "selected" : ""}>Late</option>
                          </select>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>

            <div style="margin-top:16px; display:flex; justify-content:flex-end;">
              <button class="btn-primary" id="save-attendance-btn">💾 Save Exam Attendance Records</button>
            </div>
          </div>
        ` : ''}
      `;

      // Live computation with mode-based threshold evaluation
      const marksPanel = sheetArea.querySelector("#panel-marks-entry");
      if (marksPanel && subjectId) {
        marksPanel.querySelectorAll("tbody tr").forEach(row => {
          const inputs = row.querySelectorAll(".mark-input");
          inputs.forEach(input => {
            input.oninput = (e) => {
              const rawVal = e.target.value.trim().toUpperCase();
              const maxVal = parseFloat(e.target.dataset.max);
              const isAbsentInput = rawVal === "00" || rawVal === "AB";

              if (!isAbsentInput && rawVal !== "") {
                const num = parseFloat(rawVal);
                if (isNaN(num) || num < 0) {
                  e.target.value = "0";
                  UI.toast("Negative marks are not allowed.", "error");
                } else if (num > maxVal) {
                  e.target.value = maxVal;
                  UI.toast(`Score exceeded mode maximum (${maxVal}). Capped automatically.`, "error");
                }
              }

              let tot = 0;
              let passed = true;
              let isRowAbsent = false;

              inputs.forEach(inp => {
                const valStr = inp.value.trim().toUpperCase();
                if (valStr === "00" || valStr === "AB") {
                  isRowAbsent = true;
                } else {
                  const numeric = parseFloat(valStr || 0);
                  tot += numeric;
                  // Nature-level pass threshold check
                  if (numeric < parseFloat(inp.dataset.pass)) passed = false;
                }
              });

              // Check subject aggregate threshold
              if (tot < totalSubjectPass) passed = false;

              if (isRowAbsent) {
                row.querySelector(".st-total strong").textContent = "AB";
                row.querySelector(".st-grade span").textContent = "AB";
                row.querySelector(".st-grade span").className = "badge badge-inactive";
                row.querySelector(".st-status span").textContent = "ABSENT";
                row.querySelector(".st-status span").className = "badge badge-inactive";
              } else {
                const pct = totalSubjectMax > 0 ? (tot / totalSubjectMax) * 100 : 0;
                let { grade } = calculateGrade(pct);
                
                // If not passed according to mode criteria, force F grade
                if (!passed) grade = "F";

                row.querySelector(".st-total strong").textContent = tot;
                row.querySelector(".st-grade span").textContent = grade;
                row.querySelector(".st-grade span").className = `badge ${grade === 'F' ? 'badge-inactive' : 'badge-active'}`;
                row.querySelector(".st-status span").textContent = passed ? "PASSED" : "FAILED";
                row.querySelector(".st-status span").className = `badge ${passed ? 'badge-active' : 'badge-inactive'}`;
              }
            };
          });
        });

        // Save Marks to Firestore with mode-based metadata
        marksPanel.querySelector("#save-marks-btn").onclick = async (e) => {
          e.target.disabled = true;
          e.target.textContent = "Saving...";

          const rows = marksPanel.querySelectorAll("tbody tr");
          const timestamp = new Date().toISOString();

          try {
            for (const r of rows) {
              const studentId = r.dataset.sid;
              const admissionNo = r.dataset.adm;
              const studentName = r.dataset.name;

              const existingDoc = existingStudentDocs[studentId] || {};
              const prevSubMarks = existingDoc[`marks_${subjectId}`] || { modeMarks: {} };
              const modeMarks = { ...(prevSubMarks.modeMarks || {}) };

              let isAbsent = false;
              let subTotal = 0;
              let isPassed = true;

              const inputs = r.querySelectorAll(".mark-input");
              inputs.forEach(inp => {
                const natureName = inp.dataset.nature;
                const max = parseFloat(inp.dataset.max);
                const pass = parseFloat(inp.dataset.pass);
                const raw = inp.value.trim().toUpperCase();

                if (raw === "00" || raw === "AB") {
                  isAbsent = true;
                  modeMarks[natureName] = "AB";
                  isPassed = false;
                } else {
                  let num = parseFloat(raw || 0);
                  if (isNaN(num) || num < 0) num = 0;
                  if (num > max) num = max;
                  modeMarks[natureName] = num;
                }
              });

              allModes.forEach(m => {
                const val = modeMarks[m.name];
                if (val === "AB") {
                  isAbsent = true;
                  isPassed = false;
                } else {
                  const numeric = parseFloat(val || 0);
                  subTotal += numeric;
                  if (numeric < m.pass) isPassed = false;
                }
              });

              // Final aggregate threshold check
              if (subTotal < totalSubjectPass) isPassed = false;

              const pct = totalSubjectMax > 0 ? (subTotal / totalSubjectMax) * 100 : 0;
              let { grade, remark } = isAbsent ? { grade: "AB", remark: "Absent" } : calculateGrade(pct);
              if (!isPassed && !isAbsent) grade = "F";

              const subjectPayload = {
                subjectId,
                subjectName,
                modeMarks,
                isAbsent,
                total: isAbsent ? "AB" : subTotal,
                maxTotal: totalSubjectMax,
                passMark: totalSubjectPass,
                modeEvaluated: crmMode,
                percentage: isAbsent ? 0 : (totalSubjectMax > 0 ? (subTotal / totalSubjectMax) * 100 : 0),
                grade,
                remark,
                isPassed: isAbsent ? false : isPassed
              };

              await setDocument("results", `${examId}_${studentId}`, {
                examId,
                examName: selectedExam.name,
                studentId,
                admissionNo,
                studentName,
                classroomId: crmId,
                classroomName: crmName,
                mode: crmMode,
                lastUpdated: timestamp,
                [`marks_${subjectId}`]: subjectPayload
              }, { merge: true });
            }

            UI.toast(`Marks successfully saved for ${subjectName}!`);
          } catch (error) {
            UI.toast(`Unable to save marks: ${error.message}`, "error");
          } finally {
            e.target.disabled = false;
            e.target.textContent = `💾 Save ${subjectName} Marks`;
          }
        };
      }

      // Admin Attendance logic
      if (isAdmin) {
        sheetArea.querySelectorAll(".roster-tab-btn").forEach(btn => {
          btn.onclick = () => {
            const tab = btn.dataset.tab;
            sheetArea.querySelectorAll(".roster-tab-btn").forEach(b => {
              b.classList.toggle("btn-primary", b === btn);
              b.classList.toggle("btn-secondary", b !== btn);
            });
            sheetArea.querySelector("#panel-marks-entry").style.display = tab === "marks" ? "block" : "none";
            sheetArea.querySelector("#panel-attendance-entry").style.display = tab === "attendance" ? "block" : "none";
          };
        });

        const quickTotalBtn = sheetArea.querySelector("#apply-quick-total-btn");
        if (quickTotalBtn) {
          quickTotalBtn.onclick = () => {
            const val = sheetArea.querySelector("#quick-total-days").value.trim();
            if (!val || Number(val) <= 0) return UI.toast("Enter a valid number of days", "error");
            sheetArea.querySelectorAll(".att-total-input").forEach(inp => {
              inp.value = val;
              inp.dispatchEvent(new Event("input"));
            });
          };
        }

        sheetArea.querySelectorAll(".att-row").forEach(row => {
          const pInp = row.querySelector(".att-present-input");
          const tInp = row.querySelector(".att-total-input");
          const pctCell = row.querySelector(".att-pct-cell");

          const recalc = () => {
            const p = parseFloat(pInp.value);
            const t = parseFloat(tInp.value);

            if (!isNaN(p) && p < 0) pInp.value = 0;
            if (!isNaN(t) && t < 0) tInp.value = 0;
            if (!isNaN(p) && !isNaN(t) && p > t) {
              pInp.value = t;
              UI.toast("Present days cannot exceed total days.", "error");
            }

            const cleanP = parseFloat(pInp.value);
            const cleanT = parseFloat(tInp.value);
            if (!isNaN(cleanP) && !isNaN(cleanT) && cleanT > 0) {
              pctCell.innerHTML = `<strong>${((cleanP / cleanT) * 100).toFixed(1)}%</strong>`;
            } else {
              pctCell.innerHTML = "<strong>-</strong>";
            }
          };

          pInp.oninput = recalc;
          tInp.oninput = recalc;
        });

        sheetArea.querySelector("#save-attendance-btn").onclick = async (e) => {
          e.target.disabled = true;
          e.target.textContent = "Saving Attendance...";
          const timestamp = new Date().toISOString();

          try {
            const rows = sheetArea.querySelectorAll(".att-row");
            for (const r of rows) {
              const studentId = r.dataset.sid;
              const admissionNo = r.dataset.adm;
              const studentName = r.dataset.name;
              const presentVal = r.querySelector(".att-present-input").value.trim();
              const totalVal = r.querySelector(".att-total-input").value.trim();
              const statusVal = r.querySelector(".att-status-select").value;

              const present = presentVal !== "" ? Number(presentVal) : null;
              const total = totalVal !== "" ? Number(totalVal) : null;
              const percentage = (total > 0 && present !== null) ? Number(((present / total) * 100).toFixed(1)) : null;

              const attRecord = {
                present,
                total,
                percentage,
                status: statusVal || (present !== null && total !== null ? "present" : "recorded"),
                updatedAt: timestamp
              };

              const payload = {
                examId,
                examName: selectedExam.name,
                studentId,
                admissionNo,
                studentName,
                classroomId: crmId,
                classroomName: crmName,
                mode: crmMode,
                lastUpdated: timestamp,
                [`att_${examId}`]: attRecord,
                examAttendance: attRecord
              };

              await setDocument("results", `${examId}_${studentId}`, payload, { merge: true });
            }

            UI.toast("Exam attendance records saved!");
          } catch (err) {
            UI.toast(`Error saving attendance: ${err.message}`, "error");
          } finally {
            e.target.disabled = false;
            e.target.textContent = "💾 Save Exam Attendance Records";
          }
        };

        sheetArea.querySelector("#download-att-template-btn").onclick = () => {
          const headers = ["admissionNo", "studentName", "presentDays", "totalDays"];
          const escapeCSV = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
          const rows = students.map(st => {
            const docData = existingStudentDocs[st.id] || {};
            const attObj = docData[`att_${examId}`] || docData.examAttendance || {};
            const p = attObj.present ?? "";
            const t = attObj.total ?? "";
            return [st.admissionNo, st.name, p, t].map(escapeCSV).join(",");
          });

          const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `ExamAttendance_${crmName.replace(/\s+/g, "_")}.csv`;
          link.click();
          UI.toast("Attendance template downloaded!");
        };

        sheetArea.querySelector("#att-csv-file-input").onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const csvRows = parseCSV(text);
            if (csvRows.length < 2) throw new Error("CSV has no data rows.");

            const rawHeaders = csvRows[0].map(h => h.trim().toLowerCase().replace(/[\s_-]/g, ""));
            const admIdx = rawHeaders.findIndex(h => ["admissionno", "admno", "admission"].includes(h));
            const pIdx = rawHeaders.findIndex(h => ["presentdays", "present", "attended"].includes(h));
            const tIdx = rawHeaders.findIndex(h => ["totaldays", "total", "workingdays"].includes(h));

            if (admIdx === -1) throw new Error("Missing 'admissionNo' column in CSV.");

            let loadedCount = 0;
            const rowsMap = new Map();
            sheetArea.querySelectorAll(".att-row").forEach(r => {
              rowsMap.set(padAdmissionNo(r.dataset.adm), r);
            });

            for (const cols of csvRows.slice(1)) {
              if (!cols[admIdx]) continue;
              const adm = padAdmissionNo(cols[admIdx]);
              const row = rowsMap.get(adm);
              if (row) {
                if (pIdx !== -1 && cols[pIdx] !== undefined) row.querySelector(".att-present-input").value = cols[pIdx].trim();
                if (tIdx !== -1 && cols[tIdx] !== undefined) row.querySelector(".att-total-input").value = cols[tIdx].trim();
                row.querySelector(".att-present-input").dispatchEvent(new Event("input"));
                loadedCount++;
              }
            }

            UI.toast(`Loaded attendance for ${loadedCount} students! Review and save.`);
          } catch (err) {
            UI.toast(`CSV Error: ${err.message}`, "error");
          } finally {
            e.target.value = "";
          }
        };
      }
    };

    // Bulk Excel Marks Upload Handler
    container.querySelector("#bulk-excel-btn").onclick = async () => {
      const examId = examSelect.value;
      const crmId = crmSelect.value;
      const crmName = crmSelect.options[crmSelect.selectedIndex]?.dataset.name;
      const classId = crmSelect.options[crmSelect.selectedIndex]?.dataset.cid;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || modeSelect.value || "offline").toLowerCase();

      if (!crmId) {
        UI.toast("Please select a classroom first.", "error");
        return;
      }

      const selectedExam = exams.find(e => e.id === examId);
      const subjectsInCrm = allocatedSubjects.filter(cs => cs.classroomId === crmId);
      const matchedSchedules = (selectedExam?.schedules || []).filter(s => 
        (s.classId === classId || s.className === classSelect.options[classSelect.selectedIndex]?.text) &&
        (s.mode === "both" || s.mode === crmMode)
      );

      const availableSubjects = subjectsInCrm.filter(cs => 
        matchedSchedules.some(sch => sch.subjectId === cs.subjectId)
      );

      if (availableSubjects.length === 0) {
        UI.toast("No scheduled subjects found for this classroom and mode.", "error");
        return;
      }

      UI.showModal("Bulk Excel Marks Entry", `
        <div style="margin-bottom:12px;">
          <p style="font-size:13px; color:var(--text-muted); margin:0;">
            Classroom: <strong>${crmName}</strong> | Mode: <strong>${crmMode.toUpperCase()}</strong> | Exam: <strong>${selectedExam.name}</strong>
          </p>
        </div>

        <label style="font-weight:600; font-size:13px;">1. Select Subjects for Template / Upload</label>
        <div id="bulk-sub-selector" style="max-height:130px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; padding:8px; margin:6px 0 14px 0;">
          ${availableSubjects.map(sub => {
            const sch = matchedSchedules.find(s => s.subjectId === sub.subjectId);
            const rawModes = sch?.modes || [{ name: "Marks", max: 100, pass: crmMode === 'online' ? 40 : 35 }];
            const modesSummary = rawModes.map(m => {
              const res = resolveModeThresholds(m, crmMode);
              return `${res.name}(Max:${res.max},Pass:${res.pass})`;
            }).join(", ");

            return `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; padding:3px 0; cursor:pointer;">
                <input type="checkbox" class="bulk-sub-cb" value="${sub.subjectId}" data-name="${sub.subjectName}" data-code="${sub.subjectCode || 'SUB'}" checked style="width:auto;" />
                <span><strong>${sub.subjectName}</strong> <small style="color:#64748b;">[${modesSummary}]</small></span>
              </label>
            `;
          }).join("")}
        </div>

        <div style="background:#f1f5f9; padding:12px; border-radius:6px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:600;">Download Pre-Filled Sample Excel</div>
            <div style="font-size:11px; color:#64748b;">Headers format: <code>{SUB_CODE}_{MODE}</code>. Evaluated as: <strong>${crmMode.toUpperCase()}</strong>.</div>
          </div>
          <button type="button" class="btn-secondary btn-sm" id="download-sample-csv-btn">📥 Download Template</button>
        </div>

        <label style="font-weight:600; font-size:13px;">2. Upload Filled Spreadsheet (.csv)</label>
        <input type="file" id="bulk-results-file" accept=".csv, text/csv" style="margin-top:4px;" />
        <p style="font-size:11px; color:#64748b; margin-top:4px;">Supports typing <code>00</code> or <code>AB</code> for Absent.</p>
      `, async () => {
        const fileInput = document.getElementById("bulk-results-file");
        const file = fileInput.files[0];
        if (!file) throw new Error("Please select a CSV file to upload.");

        const csvRows = parseCSV(await file.text());
        if (csvRows.length < 2) throw new Error("CSV has no data rows.");

        const rawHeaders = csvRows[0];
        const sSnap = await getCachedDocs(
          query(collection(db, "students"), where("classroomId", "==", crmId)),
          "students",
          `classroom:${crmId}`
        );
        const students = getClassroomRoster(sSnap.docs.map(d => ({ id: d.id, ...d.data() })), crmId);
        const timestamp = new Date().toISOString();
        let updatedCount = 0;

        for (const cols of csvRows.slice(1)) {
          if (cols.length === 0 || !cols[0]) continue;

          const rowData = {};
          rawHeaders.forEach((h, idx) => {
            rowData[h] = cols[idx] !== undefined ? cols[idx] : "";
            rowData[h.toUpperCase()] = cols[idx] !== undefined ? cols[idx] : "";
          });

          const rawAdm = rowData["admissionNo"] || rowData["ADMISSIONNO"] || cols[0];
          const adm = padAdmissionNo(rawAdm);
          const student = students.find(s => s.admissionNo === adm);
          if (!student) continue;

          const studentId = student.id;
          const updates = {
            examId,
            examName: selectedExam.name,
            studentId,
            admissionNo: adm,
            studentName: student.name,
            classroomId: crmId,
            classroomName: crmName,
            mode: crmMode,
            lastUpdated: timestamp
          };

          for (const sub of availableSubjects) {
            const sch = matchedSchedules.find(s => s.subjectId === sub.subjectId);
            const rawModes = sch?.modes || [{ name: "Marks", max: 100, pass: crmMode === 'online' ? 40 : 35 }];
            const modes = rawModes.map(m => resolveModeThresholds(m, crmMode));
            const totalMax = modes.reduce((acc, m) => acc + (m.max || 0), 0);
            const totalPass = modes.reduce((acc, m) => acc + (m.pass || 0), 0);
            const subCode = (sub.subjectCode || sub.subjectName || "SUB").trim().replace(/\s+/g, "_").toUpperCase();

            const modeMarks = {};
            let subTotal = 0;
            let isPassed = true;
            let isAbsent = false;
            let hasAnyMark = false;

            modes.forEach(m => {
              const key1 = `${subCode}_${m.name}`;
              const key2 = `${subCode}_${m.name}`.toUpperCase();
              const rawVal = rowData[key1] !== undefined ? rowData[key1] : (rowData[key2] !== undefined ? rowData[key2] : undefined);

              if (rawVal !== undefined && String(rawVal).trim() !== "") {
                hasAnyMark = true;
                const valStr = String(rawVal).trim().toUpperCase();
                if (valStr === "00" || valStr === "AB") {
                  isAbsent = true;
                  modeMarks[m.name] = "AB";
                  isPassed = false;
                } else {
                  let num = parseFloat(valStr || 0);
                  if (isNaN(num) || num < 0) num = 0;
                  if (num > m.max) num = m.max;
                  modeMarks[m.name] = num;
                  subTotal += num;
                  if (num < m.pass) isPassed = false;
                }
              }
            });

            if (hasAnyMark) {
              if (subTotal < totalPass) isPassed = false;
              const pct = totalMax > 0 ? (subTotal / totalMax) * 100 : 0;
              let { grade, remark } = isAbsent ? { grade: "AB", remark: "Absent" } : calculateGrade(pct);
              if (!isPassed && !isAbsent) grade = "F";

              updates[`marks_${sub.subjectId}`] = {
                subjectId: sub.subjectId,
                subjectName: sub.subjectName,
                modeMarks,
                isAbsent,
                total: isAbsent ? "AB" : subTotal,
                maxTotal: totalMax,
                passMark: totalPass,
                modeEvaluated: crmMode,
                percentage: isAbsent ? 0 : (totalMax > 0 ? (subTotal / totalMax) * 100 : 0),
                grade,
                remark,
                isPassed: isAbsent ? false : isPassed
              };
            }
          }

          await setDocument("results", `${examId}_${studentId}`, updates, { merge: true });
          updatedCount++;
        }

        if (updatedCount === 0) {
          throw new Error("No matching student records found in CSV.");
        }

        UI.toast(`Bulk marks uploaded for ${updatedCount} students!`);
        ResultsModule.render(container, user);
      });

      document.getElementById("download-sample-csv-btn").onclick = async () => {
        const checkedSubs = [];
        document.querySelectorAll(".bulk-sub-cb:checked").forEach(cb => {
          checkedSubs.push({ id: cb.value, name: cb.dataset.name, code: cb.dataset.code });
        });

        if (checkedSubs.length === 0) {
          UI.toast("Please select at least one subject.", "error");
          return;
        }

        const sSnap = await getCachedDocs(
          query(collection(db, "students"), where("classroomId", "==", crmId)),
          "students",
          `classroom:${crmId}`
        );
        const students = getClassroomRoster(sSnap.docs.map(d => ({ id: d.id, ...d.data() })), crmId);

        const headers = ["admissionNo", "studentName"];
        checkedSubs.forEach(sub => {
          const sch = matchedSchedules.find(s => s.subjectId === sub.id);
          const rawModes = sch?.modes || [{ name: "Marks", max: 100, pass: crmMode === 'online' ? 40 : 35 }];
          const modes = rawModes.map(m => resolveModeThresholds(m, crmMode));
          const subCode = (sub.code || sub.name).trim().replace(/\s+/g, "_").toUpperCase();
          modes.forEach(m => {
            headers.push(`${subCode}_${m.name}`);
          });
        });

        const escapeCSV = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const rows = students.map(st => {
          const row = [st.admissionNo, st.name];
          for (let i = 2; i < headers.length; i++) row.push("");
          return row.map(escapeCSV).join(",");
        });

        const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(","), ...rows].join("\r\n");
        const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `MarksTemplate_${crmName.replace(/\s+/g, "_")}_${crmMode.toUpperCase()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        UI.toast("Sample template downloaded!");
      };
    };
  }
};