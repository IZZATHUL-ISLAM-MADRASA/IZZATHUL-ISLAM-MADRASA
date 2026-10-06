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

export const ResultsModule = {
  id: "results",
  title: "Marks Entry Master",
  roles: ["admin", "staff"],

  async render(container, user) {
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
      allocatedSubjects = allocatedSubjects.filter(cs => cs.teacherId === user.id || cs.teacherName === user.name);
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h2>Marks Entry Master</h2>
          <p style="color:var(--text-muted);font-size:13px;">Enter subject evaluation scores with instant validation against negative marks and excess values.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="bulk-excel-btn">📊 Excel Bulk Upload</button>
        </div>
      </div>

      <!-- Cascading Filter Row -->
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
            <button class="btn-primary" id="load-sheet-btn" style="width:100%; height:38px;">📋 Open Marks Sheet</button>
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
      subSelect.innerHTML = subjectsInCrm.length
        ? subjectsInCrm.map(cs => `<option value="${cs.subjectId}" data-name="${cs.subjectName}">${cs.subjectName}</option>`).join("")
        : `<option value="">-- No subjects found --</option>`;
      subSelect.disabled = subjectsInCrm.length === 0;
      syncNatures();
    };

    const syncNatures = () => {
      const examId = examSelect.value;
      const selectedExam = exams.find(e => e.id === examId);
      const classId = crmSelect.options[crmSelect.selectedIndex]?.dataset.cid;
      const subjectId = subSelect.value;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || "offline").toLowerCase();

      const sched = (selectedExam?.schedules || []).find(s => 
        (s.classId === classId || s.className === classSelect.options[classSelect.selectedIndex]?.text) &&
        s.subjectId === subjectId &&
        (s.mode === "both" || s.mode === crmMode)
      );

      const availableModes = sched?.modes || [];
      natureSelect.innerHTML = `<option value="all">All Natures (Full Mark)</option>` +
        availableModes.map(m => `<option value="${m.name}">${m.name} (Max: ${m.max}, Pass: ${m.pass})</option>`).join("");
    };

    modeSelect.onchange = syncClasses;
    classSelect.onchange = syncClassrooms;
    crmSelect.onchange = syncSubjects;
    subSelect.onchange = syncNatures;
    examSelect.onchange = syncNatures;
    syncClasses();

    // Marks Entry Roster Loader
    container.querySelector("#load-sheet-btn").onclick = async () => {
      const examId = examSelect.value;
      const crmId = crmSelect.value;
      const crmName = crmSelect.options[crmSelect.selectedIndex]?.dataset.name;
      const classId = crmSelect.options[crmSelect.selectedIndex]?.dataset.cid;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || "offline").toLowerCase();
      const subjectId = subSelect.value;
      const subjectName = subSelect.options[subSelect.selectedIndex]?.dataset.name;
      const selectedNature = natureSelect.value;
      const sheetArea = document.getElementById("marks-sheet-area");

      if (!crmId || !subjectId) {
        sheetArea.innerHTML = "<p style='color:red;padding:12px;background:#fff;border-radius:6px;'>Please select a valid classroom and subject.</p>";
        return;
      }

      const selectedExam = exams.find(e => e.id === examId);
      const sched = (selectedExam?.schedules || []).find(s => 
        (s.classId === classId || s.className === classSelect.options[classSelect.selectedIndex]?.text) &&
        s.subjectId === subjectId &&
        (s.mode === "both" || s.mode === crmMode)
      );

      const allModes = sched?.modes || [{ name: "Marks", max: 100, pass: 40 }];
      const activeModes = selectedNature === "all" ? allModes : allModes.filter(m => m.name === selectedNature);
      const totalSubjectMax = allModes.reduce((acc, m) => acc + (m.max || 0), 0);

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
            <strong>${selectedExam.name}</strong> • <u>${subjectName}</u> (${crmName})
            <span class="badge ${crmMode === 'online' ? 'badge-online' : 'badge-offline'}" style="margin-left:8px;">
              ${crmMode.toUpperCase()} (${students.length} Students)
            </span>
          </div>
          <div>
            <strong>Nature Filter:</strong> <span class="badge badge-active">${selectedNature === 'all' ? 'All Natures' : selectedNature}</span> | 
            Total Max: <strong>${totalSubjectMax}</strong>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Adm No</th>
                <th>Student Name</th>
                ${activeModes.map(m => `<th>${m.name} (Max: ${m.max} / Pass:${m.pass})</th>`).join("")}
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
                    <td>${st.name}</td>${activeModes.map(m => {
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
                    <td class="st-grade"><span class="badge ${rec.isAbsent ? 'badge-inactive' : (rec.grade === 'F' ? 'badge-inactive' : 'badge-active')}">${rec.isAbsent ? 'AB' : (rec.grade || 'F')}</span></td>
                    <td class="st-status"><span class="badge ${rec.isPassed ? 'badge-active' : 'badge-inactive'}">${rec.isAbsent ? 'ABSENT' : (rec.isPassed ? 'PASSED' : 'FAILED')}</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <p style="font-size:12px; color:var(--text-muted); margin:0;">
            Type <code>AB</code> or <code>00</code> for Absent. Negative numbers and excess marks will automatically be corrected.
          </p>
          <button class="btn-primary" id="save-marks-btn">💾 Save ${subjectName} Marks</button>
        </div>
      `;

      // Live computation, negative score rejection, excess marks clamping & AB validation
      sheetArea.querySelectorAll("tbody tr").forEach(row => {
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
                UI.toast(`Score exceeded maximum (${maxVal}). Capped automatically.`, "error");
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
                if (numeric < parseFloat(inp.dataset.pass)) passed = false;
              }
            });

            if (isRowAbsent) {
              row.querySelector(".st-total strong").textContent = "AB";
              row.querySelector(".st-grade span").textContent = "AB";
              row.querySelector(".st-grade span").className = "badge badge-inactive";
              row.querySelector(".st-status span").textContent = "ABSENT";
              row.querySelector(".st-status span").className = "badge badge-inactive";
            } else {
              const pct = totalSubjectMax > 0 ? (tot / totalSubjectMax) * 100 : 0;
              const { grade } = calculateGrade(pct);

              row.querySelector(".st-total strong").textContent = tot;
              row.querySelector(".st-grade span").textContent = grade;
              row.querySelector(".st-grade span").className = `badge ${grade === 'F' ? 'badge-inactive' : 'badge-active'}`;
              row.querySelector(".st-status span").textContent = passed ? "PASSED" : "FAILED";
              row.querySelector(".st-status span").className = `badge ${passed ? 'badge-active' : 'badge-inactive'}`;
            }
          };
        });
      });

      // Save Marks to Firestore
      sheetArea.querySelector("#save-marks-btn").onclick = async (e) => {
        e.target.disabled = true;
        e.target.textContent = "Saving...";

        const rows = sheetArea.querySelectorAll("tbody tr");
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

            // Calculate overall subject total based on all modes
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

            const pct = totalSubjectMax > 0 ? (subTotal / totalSubjectMax) * 100 : 0;
            const { grade, remark } = isAbsent ? { grade: "AB", remark: "Absent" } : calculateGrade(pct);

            const subjectPayload = {
              subjectId,
              subjectName,
              modeMarks,
              isAbsent,
              total: isAbsent ? "AB" : subTotal,
              maxTotal: totalSubjectMax,
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
    };

    // Bulk Excel Upload
    container.querySelector("#bulk-excel-btn").onclick = async () => {
      const examId = examSelect.value;
      const crmId = crmSelect.value;
      const crmName = crmSelect.options[crmSelect.selectedIndex]?.dataset.name;
      const classId = crmSelect.options[crmSelect.selectedIndex]?.dataset.cid;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || "offline").toLowerCase();

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
        UI.toast("No scheduled subjects found for this classroom.", "error");
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
            const modesSummary = (sch?.modes || []).map(m => `${m.name}(${m.max})`).join(", ");
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
            <div style="font-size:11px; color:#64748b;">Headers format: <code>{SUB_CODE}_{MODE}</code> (e.g. <code>S01_Oral</code>).</div>
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
            lastUpdated: timestamp
          };

          for (const sub of availableSubjects) {
            const sch = matchedSchedules.find(s => s.subjectId === sub.subjectId);
            const modes = sch?.modes || [{ name: "Marks", max: 100, pass: 40 }];
            const totalMax = modes.reduce((acc, m) => acc + (m.max || 0), 0);
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
              const pct = totalMax > 0 ? (subTotal / totalMax) * 100 : 0;
              const { grade, remark } = isAbsent ? { grade: "AB", remark: "Absent" } : calculateGrade(pct);

              updates[`marks_${sub.subjectId}`] = {
                subjectId: sub.subjectId,
                subjectName: sub.subjectName,
                modeMarks,
                isAbsent,
                total: isAbsent ? "AB" : subTotal,
                maxTotal: totalMax,
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
          const modes = sch?.modes || [{ name: "Marks", max: 100, pass: 40 }];
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
        link.download = `MarksTemplate_${crmName.replace(/\s+/g, "_")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        UI.toast("Sample template downloaded!");
      };
    };
  }
};