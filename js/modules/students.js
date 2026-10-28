import { db } from "../core/firebase-config.js";
import { 
  collection, doc, writeBatch, getDocs, query, where, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getCachedDocs, setDocument, deleteDocument, commitTrackedBatch } from "../core/firebase-config.js";
import { getActiveAcademicYear, getNextAdmissionNumber } from "../core/db.js";
import { createOrUpdateParent } from "../core/auth.js";
import { dobToPassword, cleanPhone, padAdmissionNo, calculateGrade } from "../core/utils.js";
import { UI } from "../core/ui.js";

const XLSX_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(cell => cell)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(cell => cell)) rows.push(row);
  return rows;
}

export const StudentsModule = {
  id: "students",
  title: "Students Directory",
  roles: ["admin", "staff"],

  async render(container, user) {
    const currentUser = user || (typeof getSessionUser === "function" ? getSessionUser() : JSON.parse(sessionStorage.getItem("izzath_user") || "null"));
    const isStaff = currentUser?.role === "staff";

    const activeYear = await getActiveAcademicYear();

    const [sSnap, cSnap, fSnap, clSnap, dSnap, csSnap] = await Promise.all([
      getCachedDocs(collection(db, "students"), "students"),
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "custom_reg_fields"), "custom_reg_fields"),
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "divisions"), "divisions"),
      getCachedDocs(collection(db, "classroom_subjects"), "classroom_subjects").catch(() => getDocs(collection(db, "classroom_subjects")))
    ]);

    const allClassrooms = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const customFields = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allClasses = clSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    const divisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.code || "").localeCompare(b.code || ""));
    const classroomSubjects = csSnap.docs ? csSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];

    const isClassInCharge = (crm) => {
      if (!isStaff) return true;
      if (crm.classTeachers && Array.isArray(crm.classTeachers)) {
        return crm.classTeachers.some(t => t.id === currentUser?.id || t.name === currentUser?.name || t.name === currentUser?.username);
      }
      return crm.classTeacherId === currentUser?.id || crm.classTeacherName === currentUser?.name;
    };

    const classChargeClassroomIds = new Set(
      allClassrooms.filter(isClassInCharge).map(c => c.id)
    );

    const taughtClassroomIds = new Set();
    if (isStaff) {
      classChargeClassroomIds.forEach(id => taughtClassroomIds.add(id));
      classroomSubjects.forEach(cs => {
        if (cs.teacherId === currentUser?.id || cs.teacherName === currentUser?.name || cs.teacherName === currentUser?.username) {
          if (cs.classroomId) taughtClassroomIds.add(cs.classroomId);
        }
      });
    }

    const rawStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => parseInt(a.admissionNo || 0, 10) - parseInt(b.admissionNo || 0, 10));

    const allStudents = isStaff 
      ? rawStudents.filter(st => taughtClassroomIds.has(st.classroomId))
      : rawStudents;

    const classrooms = isStaff
      ? allClassrooms.filter(c => taughtClassroomIds.has(c.id))
      : allClassrooms;

    const classes = isStaff
      ? allClasses.filter(cl => classrooms.some(crm => crm.classId === cl.id))
      : allClasses;

    let filteredStudents = [...allStudents];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2>Students Directory ${isStaff ? '<span style="font-size:14px; font-weight:normal; color:#065f46;">(My Classes)</span>' : ''}</h2>
          <p style="color:var(--text-muted);font-size:13px;">Year: <strong>${activeYear ? activeYear.name : 'None Selected'}</strong> | Total: <strong id="total-count-lbl">${allStudents.length}</strong> Students</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-secondary" id="analytics-btn" title="View Detailed Breakdown">📊 Detailed Analytics</button>
          <button class="btn-secondary" id="export-excel-btn">📥 Export Excel</button>
          <button class="btn-secondary" id="download-student-template-btn">📄 Excel Template</button>
          <button class="btn-secondary" id="export-pdf-btn">🖨️ PDF Register</button>
          ${!isStaff ? `<button class="btn-secondary" id="bulk-upload-btn">📤 Bulk Upload</button>` : ''}
          ${!isStaff ? `<button class="btn-primary" id="add-student-btn">➕ Register Student</button>` : ''}
        </div>
      </div>

      <!-- Cascading Filter Toolbar -->
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin:16px 0; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:center;">
        <div>
          <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Search</label>
          <input type="text" id="st-search-input" placeholder="Name, Adm No, Mobile..." style="margin-top:2px;" />
        </div>
        <div>
          <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Learning Mode</label>
          <select id="st-mode-filter" style="margin-top:2px;">
            <option value="all">All Modes</option>
            <option value="offline">Offline Only</option>
            <option value="online">Online Only</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Class</label>
          <select id="st-class-filter" style="margin-top:2px;">
            <option value="all">All Classes</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Gender</label>
          <select id="st-gender-filter" style="margin-top:2px;">
            <option value="all">All Genders</option>
            <option value="male">Boys (Male)</option>
            <option value="female">Girls (Female)</option>
          </select>
        </div>
      </div>

      <!-- Students Table -->
      <div class="table-wrapper">
        <table id="students-table">
          <thead>
            <tr>
              <th>Adm No</th>
              <th>Student Name (Click Details)</th>
              <th>Gender</th>
              <th>Classroom</th>
              <th>Mode</th>
              <th>Guardian Name</th>
              <th>Parent Mobile</th>
              <th style="text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody id="students-table-body"></tbody>
        </table>
      </div>
    `;

    const modeFilter = container.querySelector("#st-mode-filter");
    const classFilter = container.querySelector("#st-class-filter");
    const genderFilter = container.querySelector("#st-gender-filter");

    const refreshClassFilterOptions = () => {
      const mode = modeFilter.value;
      const relevantClasses = mode === "all" ? classes : classes.filter(c => (c.mode || "offline") === mode);
      classFilter.innerHTML = `<option value="all">All Classes</option>` +
        relevantClasses.map(c => `<option value="${c.name}">${c.name} (${(c.mode || 'offline').toUpperCase()})</option>`).join("");
    };

    const renderTableRows = () => {
      const tbody = container.querySelector("#students-table-body");
      document.getElementById("total-count-lbl").textContent = `${filteredStudents.length} (of ${allStudents.length})`;

      if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:16px;">No students match the filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = filteredStudents.map(st => {
        const canEdit = !isStaff || classChargeClassroomIds.has(st.classroomId);
        const canDelete = !isStaff;
        const genderLabel = (st.gender || "male").toLowerCase() === "female" ? "Female" : "Male";
        const isTcIssued = st.status === "tc_issued";

        return `
          <tr style="${isTcIssued ? 'background:#fff1f2;' : ''}">
            <td><strong>${st.admissionNo}</strong></td>
            <td>
              <a href="javascript:void(0)" class="view-st-details-btn" data-id="${st.id}" style="color:var(--primary); font-weight:700; text-decoration:underline;">
                ${st.name} ${isTcIssued ? '<span class="badge badge-inactive" style="font-size:10px;">TC ISSUED</span>' : ''}
              </a>
            </td>
            <td><span class="badge ${genderLabel === 'Female' ? 'badge-online' : 'badge-active'}">${genderLabel}</span></td>
            <td>${st.classroomName || 'Unallocated'}</td>
            <td><span class="badge ${st.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(st.mode || 'offline').toUpperCase()}</span></td>
            <td>${st.guardianName || '-'}</td>
            <td><code>${st.parentPhone || '-'}</code></td>
            <td style="text-align:center; white-space:nowrap;">
              ${canEdit 
                ? `<button class="btn-secondary btn-sm edit-st-btn" data-id="${st.id}" title="Edit Student">✏️</button>` 
                : `<button class="btn-secondary btn-sm" disabled style="opacity:0.4; cursor:not-allowed;" title="Edit allowed only for Class In-Charge">🔒</button>`
              }
              ${canDelete ? `<button class="btn-danger btn-sm del-st-btn" data-id="${st.id}" title="Delete Student">🗑️</button>` : ''}
            </td>
          </tr>
        `;
      }).join("");

      // Open Comprehensive Details Modal on Name Click
      tbody.querySelectorAll(".view-st-details-btn").forEach(link => {
        link.onclick = () => {
          const student = allStudents.find(s => s.id === link.dataset.id);
          if (student) openStudentDetailsTabsModal(student, activeYear, isStaff, canEditStudent(student));
        };
      });

      tbody.querySelectorAll(".edit-st-btn").forEach(b => {
        b.onclick = () => {
          const student = allStudents.find(s => s.id === b.dataset.id);
          if (student) openStudentFormModal(student, classrooms, classes, divisions, customFields, activeYear, container);
        };
      });

      tbody.querySelectorAll(".del-st-btn").forEach(b => {
        b.onclick = async () => {
          if (confirm("Permanently delete this student?")) {
            await deleteDocument("students", b.dataset.id);
            UI.toast("Student removed.");
            StudentsModule.render(container, currentUser);
          }
        };
      });
    };

    const canEditStudent = (student) => !isStaff || classChargeClassroomIds.has(student.classroomId);

    const applyFilters = () => {
      const term = container.querySelector("#st-search-input").value.trim().toLowerCase();
      const selectedClass = classFilter.value;
      const selectedMode = modeFilter.value;
      const selectedGender = genderFilter.value;

      filteredStudents = allStudents.filter(st => {
        const matchesTerm = !term ||
          (st.admissionNo && st.admissionNo.toLowerCase().includes(term)) ||
          (st.name && st.name.toLowerCase().includes(term)) ||
          (st.guardianName && st.guardianName.toLowerCase().includes(term)) ||
          (st.parentPhone && st.parentPhone.includes(term));

        const matchesClass = selectedClass === "all" || (st.className === selectedClass || (st.classroomName && st.classroomName.includes(selectedClass)));
        const matchesMode = selectedMode === "all" || (st.mode || "offline") === selectedMode;
        const matchesGender = selectedGender === "all" || (st.gender || "male").toLowerCase() === selectedGender;

        return matchesTerm && matchesClass && matchesMode && matchesGender;
      });

      renderTableRows();
    };

    modeFilter.onchange = () => {
      refreshClassFilterOptions();
      applyFilters();
    };
    classFilter.onchange = applyFilters;
    genderFilter.onchange = applyFilters;
    container.querySelector("#st-search-input").oninput = applyFilters;

    refreshClassFilterOptions();
    renderTableRows();

    // Template Generator
    const getLookupSheets = () => ({
      "Classrooms": classrooms.map(item => ({
        classroom: item.name,
        class: item.className || classes.find(c => c.id === item.classId)?.name || "",
        division: item.divCode,
        mode: item.mode || "offline"
      })),
      "Classes": classes.map(item => ({
        class: item.name,
        mode: item.mode || "offline",
        alias: item.alias || ""
      })),
      "Divisions": divisions.map(item => ({
        division: item.code,
        alias: item.alias || ""
      }))
    });

    const saveWorkbook = async (sheets, filename) => {
      const XLSX = await import(XLSX_URL);
      const workbook = XLSX.utils.book_new();
      Object.entries(sheets).forEach(([sheetName, rows]) => {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const header = rows[0] ? Object.keys(rows[0]) : [];
        worksheet["!cols"] = header.map(key => ({ wch: Math.min(Math.max(key.length + 4, 16), 32) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
      XLSX.writeFile(workbook, filename);
    };

    container.querySelector("#download-student-template-btn").onclick = async () => {
      const template = [{
        admissionNo: "1001",
        name: "Aisha Maryam",
        gender: "Female",
        dob: "2015-05-12",
        class: classes[0]?.name || "Class 1",
        division: divisions[0]?.code || "A",
        mode: classes[0]?.mode || "offline",
        guardianName: "Muhammad",
        parentPhone: "9876543210",
        whatsappNumber: "9876543210"
      }];
      await saveWorkbook({
        "Students": template,
        ...getLookupSheets()
      }, "Student_Import_Template.xlsx");
      UI.toast("Student template downloaded!");
    };

    // Bulk Upload
    const bulkUploadBtn = container.querySelector("#bulk-upload-btn");
    if (bulkUploadBtn) {
      bulkUploadBtn.onclick = () => {
        UI.showModal("Bulk Student Upload", `
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
            Upload <code>.xlsx</code> or <code>.csv</code>. The class, division, and mode must match an existing classroom exactly.
          </p>
          <input type="file" id="bulk-file-input" accept=".xlsx,.csv,text/csv" />
        `, async () => {
          const file = document.getElementById("bulk-file-input").files[0];
          if (!file) throw new Error("Select a file to upload.");

          let headers = [];
          let rows = [];
          if (file.name.toLowerCase().endsWith(".xlsx")) {
            const XLSX = await import(XLSX_URL);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
            const worksheet = workbook.Sheets.Students || workbook.Sheets[workbook.SheetNames[0]];
            if (!worksheet) throw new Error("Workbook must contain a Students sheet.");
            const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            headers = sheetRows[0] || [];
            rows = sheetRows.slice(1);
          } else {
            const parsed = parseCSV(await file.text());
            headers = parsed[0] || [];
            rows = parsed.slice(1);
          }

          const normalizeHeader = value => String(value).trim().toLowerCase().replace(/[\s_-]/g, "");
          const headerMap = new Map(headers.map((h, i) => [normalizeHeader(h), i]));
          const getVal = (r, ...keys) => {
            const idx = keys.map(normalizeHeader).map(k => headerMap.get(k)).find(v => v !== undefined);
            return idx === undefined ? "" : String(r[idx] ?? "").trim();
          };

          const payloads = [];
          for (const [idx, row] of rows.entries()) {
            if (!row.some(val => String(val).trim())) continue;
            const admissionNo = padAdmissionNo(getVal(row, "admissionNo", "admNo"));
            const name = getVal(row, "name", "studentName");
            const genderRaw = getVal(row, "gender", "sex").toLowerCase();
            const gender = (genderRaw === "f" || genderRaw.includes("fem")) ? "female" : "male";
            const dob = getVal(row, "dob", "dateOfBirth");
            const mode = getVal(row, "mode", "learningMode").toLowerCase();
            const className = getVal(row, "class", "className");
            const divCode = getVal(row, "division", "divCode").toUpperCase();
            const parentPhone = cleanPhone(getVal(row, "parentPhone", "phone"));

            if (!admissionNo || !name || !dob || !parentPhone || !mode || !className || !divCode) {
              throw new Error(`Row ${idx + 2}: Required information missing.`);
            }

            const matchedClass = allClasses.find(c => c.name.toLowerCase() === className.toLowerCase() && (c.mode || "offline") === mode);
            if (!matchedClass) {
              throw new Error(`Row ${idx + 2}: Class "${className}" in ${mode.toUpperCase()} mode not found.`);
            }

            const matchedCrm = allClassrooms.find(crm => crm.classId === matchedClass.id && crm.divCode.toUpperCase() === divCode);
            if (!matchedCrm) {
              throw new Error(`Row ${idx + 2}: Classroom for ${className} Div ${divCode} does not exist.`);
            }

            payloads.push({
              id: `std_${admissionNo}`,
              admissionNo,
              name,
              gender,
              dob,
              guardianName: getVal(row, "guardianName"),
              parentPhone,
              whatsappNumber: cleanPhone(getVal(row, "whatsappNumber")) || parentPhone,
              mode,
              classroomId: matchedCrm.id,
              classroomName: matchedCrm.name,
              classId: matchedClass.id,
              className: matchedClass.name,
              divId: matchedCrm.divId,
              divCode: matchedCrm.divCode,
              status: "active",
              academicYearId: activeYear ? activeYear.id : ""
            });
          }

          for (const st of payloads) {
            await createOrUpdateParent(st.parentPhone, dobToPassword(st.dob));
          }

          for (let offset = 0; offset < payloads.length; offset += 450) {
            const batch = writeBatch(db);
            payloads.slice(offset, offset + 450).forEach(({ id, ...p }) => {
              batch.set(doc(db, "students", id), p, { merge: true });
            });
            await commitTrackedBatch(batch, ["students"]);
          }

          UI.toast(`Successfully imported ${payloads.length} students!`);
          StudentsModule.render(container, currentUser);
        });
      };
    }

    const addStudentBtn = container.querySelector("#add-student-btn");
    if (addStudentBtn) {
      addStudentBtn.onclick = () => {
        openStudentFormModal(null, classrooms, classes, divisions, customFields, activeYear, container);
      };
    }

    // Detailed Analytics Modal
    container.querySelector("#analytics-btn").onclick = () => {
      const offlineCount = allStudents.filter(s => (s.mode || "offline") === "offline").length;
      const onlineCount = allStudents.filter(s => s.mode === "online").length;
      const maleCount = allStudents.filter(s => (s.gender || "male").toLowerCase() !== "female").length;
      const femaleCount = allStudents.filter(s => (s.gender || "male").toLowerCase() === "female").length;

      const detailedMap = {};
      allStudents.forEach(st => {
        const crmId = st.classroomId || "unallocated";
        const crm = allClassrooms.find(c => c.id === crmId) || {};
        const key = `${crm.className || st.className || "Other"}__${crm.divCode || st.divCode || "General"}__${st.mode || crm.mode || "offline"}`;
        
        if (!detailedMap[key]) {
          detailedMap[key] = {
            className: crm.className || st.className || "Unassigned",
            division: crm.divCode || st.divCode || "-",
            mode: (st.mode || crm.mode || "offline").toUpperCase(),
            male: 0,
            female: 0,
            total: 0
          };
        }

        const isFem = (st.gender || "male").toLowerCase() === "female";
        if (isFem) detailedMap[key].female++;
        else detailedMap[key].male++;
        detailedMap[key].total++;
      });

      const reportRows = Object.values(detailedMap).sort((a,b) => {
        const cmpClass = a.className.localeCompare(b.className);
        if (cmpClass !== 0) return cmpClass;
        return a.division.localeCompare(b.division);
      });

      UI.showModal(`Student Analytics & Breakdown Report ${isStaff ? '(Assigned Classes)' : ''}`, `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:18px;">
          <div class="stat-card" style="text-align:center; padding:12px;">
            <div class="stat-val" style="font-size:22px;">${allStudents.length}</div>
            <div class="stat-lbl" style="font-size:11px;">Total Students</div>
          </div>
          <div class="stat-card" style="text-align:center; padding:12px;">
            <div class="stat-val" style="font-size:22px; color:var(--primary);">${offlineCount}</div>
            <div class="stat-lbl" style="font-size:11px;">Offline (Campus)</div>
          </div>
          <div class="stat-card" style="text-align:center; padding:12px;">
            <div class="stat-val" style="font-size:22px; color:#3730a3;">${onlineCount}</div>
            <div class="stat-lbl" style="font-size:11px;">Online (Virtual)</div>
          </div>
          <div class="stat-card" style="text-align:center; padding:12px;">
            <div class="stat-val" style="font-size:22px; color:#0284c7;">${maleCount}</div>
            <div class="stat-lbl" style="font-size:11px;">Boys (Male)</div>
          </div>
          <div class="stat-card" style="text-align:center; padding:12px;">
            <div class="stat-val" style="font-size:22px; color:#db2777;">${femaleCount}</div>
            <div class="stat-lbl" style="font-size:11px;">Girls (Female)</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="margin:0; font-size:14px; color:#0f172a;">Class & Division Breakdown</h4>
          <div style="display:flex; gap:6px;">
            <button class="btn-secondary btn-sm" id="analytics-export-excel-btn">📥 Export Excel</button>
            <button class="btn-secondary btn-sm" id="analytics-export-pdf-btn">🖨️ Print PDF</button>
          </div>
        </div>

        <div class="table-wrapper" style="max-height:300px; overflow-y:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9; position:sticky; top:0; z-index:10;">
                <th style="padding:8px 10px; text-align:left;">Class</th>
                <th style="padding:8px 10px; text-align:center;">Div</th>
                <th style="padding:8px 10px; text-align:center;">Mode</th>
                <th style="padding:8px 10px; text-align:center; color:#0284c7;">Male</th>
                <th style="padding:8px 10px; text-align:center; color:#db2777;">Female</th>
                <th style="padding:8px 10px; text-align:center; font-weight:700;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${reportRows.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:16px;">No student records found.</td></tr>` : ''}
              ${reportRows.map(r => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px 10px; text-align:left;"><strong>${r.className}</strong></td>
                  <td style="padding:8px 10px; text-align:center;"><strong>${r.division}</strong></td>
                  <td style="padding:8px 10px; text-align:center;"><span class="badge ${r.mode === 'ONLINE' ? 'badge-online' : 'badge-offline'}">${r.mode}</span></td>
                  <td style="padding:8px 10px; text-align:center; font-weight:600;">${r.male}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:600;">${r.female}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:700; color:var(--primary);">${r.total}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr style="background:#e2e8f0; font-weight:700;">
                <td colspan="3" style="padding:8px 10px;">Grand Total</td>
                <td style="padding:8px 10px; text-align:center; color:#0284c7;">${maleCount}</td>
                <td style="padding:8px 10px; text-align:center; color:#db2777;">${femaleCount}</td>
                <td style="padding:8px 10px; text-align:center; color:var(--primary); font-size:15px;">${allStudents.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `);

      const modalEl = document.getElementById("generic-modal");

      modalEl.querySelector("#analytics-export-excel-btn").onclick = async () => {
        const rows = reportRows.map(r => ({
          "Class": r.className,
          "Division": r.division,
          "Mode": r.mode,
          "Male (Boys)": r.male,
          "Female (Girls)": r.female,
          "Total Students": r.total
        }));
        rows.push({
          "Class": "TOTAL",
          "Division": "-",
          "Mode": "-",
          "Male (Boys)": maleCount,
          "Female (Girls)": femaleCount,
          "Total Students": allStudents.length
        });
        await saveWorkbook({ "Class_Breakdown": rows }, `Student_Breakdown_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
        UI.toast("Detailed report downloaded as Excel!");
      };

      modalEl.querySelector("#analytics-export-pdf-btn").onclick = () => {
        const printWin = window.open("", "_blank");
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Students Breakdown Report</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
              h2 { margin: 0 0 4px 0; color: #065f46; text-transform: uppercase; }
              p { margin: 0 0 16px 0; color: #64748b; font-size: 13px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; }
              th { background: #f1f5f9; font-weight: 600; }
              tfoot td { background: #f8fafc; font-weight: bold; }
              @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <div style="border-bottom: 2px solid #065f46; padding-bottom: 8px; margin-bottom: 12px;">
              <h2>IZZATHUL ISLAM MADRASA</h2>
              <p>Student Analytics & Detailed Class-Division-Gender Report • Generated on: ${new Date().toLocaleDateString("en-IN")}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="text-align:left;">Class</th>
                  <th>Division</th>
                  <th>Mode</th>
                  <th>Male (Boys)</th>
                  <th>Female (Girls)</th>
                  <th>Total Students</th>
                </tr>
              </thead>
              <tbody>
                ${reportRows.map(r => `
                  <tr>
                    <td style="text-align:left; font-weight:bold;">${r.className}</td>
                    <td>${r.division}</td>
                    <td>${r.mode}</td>
                    <td>${r.male}</td>
                    <td>${r.female}</td>
                    <td style="font-weight:bold;">${r.total}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align:left;">GRAND TOTAL</td>
                  <td>${maleCount}</td>
                  <td>${femaleCount}</td>
                  <td>${allStudents.length}</td>
                </tr>
              </tfoot>
            </table>
            <script>window.onload = function() { window.print(); }</script>
          </body>
          </html>
        `);
        printWin.document.close();
      };
    };

    // PDF Register
    container.querySelector("#export-pdf-btn").onclick = () => {
      const printWin = window.open("", "_blank");
      printWin.document.write(`
        <html><head><title>Student Register</title>
        <style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #ccc;padding:6px;}</style>
        </head><body>
        <h2>Izzathul Islam Madrasa - Student Register ${isStaff ? '(Assigned Classes)' : ''}</h2>
        <table><thead><tr><th>Adm No</th><th>Name</th><th>Gender</th><th>Classroom</th><th>Mode</th><th>Parent Mobile</th></tr></thead>
        <tbody>
          ${filteredStudents.map(s => `<tr><td>${s.admissionNo}</td><td>${s.name}</td><td>${(s.gender||'male').toUpperCase()}</td><td>${s.classroomName||'-'}</td><td>${(s.mode||'offline').toUpperCase()}</td><td>${s.parentPhone||'-'}</td></tr>`).join("")}
        </tbody></table>
        <script>window.onload = () => window.print();</script>
        </body></html>
      `);
      printWin.document.close();
    };

    // Excel Export
    container.querySelector("#export-excel-btn").onclick = async () => {
      const exportRows = filteredStudents.map(s => ({
        "Admission No": s.admissionNo,
        "Student Name": s.name,
        "Gender": (s.gender || "male").toUpperCase(),
        "Classroom": s.classroomName || "",
        "Mode": (s.mode || "offline").toUpperCase(),
        "Guardian": s.guardianName || "",
        "Mobile": s.parentPhone || "",
        "WhatsApp": s.whatsappNumber || "",
        "DOB": s.dob || ""
      }));
      await saveWorkbook({ "Students": exportRows }, `Students_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      UI.toast("Export completed!");
    };
  }
};

// ==========================================
// 360° STUDENT DETAILS TABS MODAL
// Profile | Fee | Academics | Attendance | Issue TC
// ==========================================
async function openStudentDetailsTabsModal(student, activeYear, isStaff, canManage) {
  const modalId = "student-tabs-modal";
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = modalId;
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:850px; width:95%; max-height:92vh; padding:20px 24px;">
      
      <!-- Top Title & Close -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-size:26px;">👤</div>
          <div>
            <h3 style="margin:0; font-size:18px; color:#064e3b;">${student.name}</h3>
            <span style="font-size:12px; color:#64748b;">Admission No: <strong>${student.admissionNo}</strong> | ${student.classroomName || 'Class'} (${(student.mode||'offline').toUpperCase()})</span>
          </div>
        </div>
        <button class="modal-close" id="st-tabs-close-btn" style="background:transparent; font-size:22px; cursor:pointer; border:none;">&times;</button>
      </div>

      <!-- Tab Navigation Buttons -->
      <div style="display:flex; border-bottom:2px solid #e2e8f0; margin:14px 0 16px 0; gap:6px; flex-wrap:wrap;">
        <button class="st-tab-btn active" data-tab="tab-profile">👤 Profile</button>
        <button class="st-tab-btn" data-tab="tab-fee">💳 Fee Ledger</button>
        <button class="st-tab-btn" data-tab="tab-academics">📈 Academic Performance</button>
        <button class="st-tab-btn" data-tab="tab-attendance">📅 Attendance History</button>
        <button class="st-tab-btn" data-tab="tab-tc" style="color:#b91c1c;">📜 Issue TC</button>
      </div>

      <!-- Tab Contents Container -->
      <div id="st-tab-content-area" style="min-height:300px;">
        <p style="text-align:center; color:#64748b;">Loading student details...</p>
      </div>

    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#st-tabs-close-btn").onclick = () => overlay.remove();

  const tabBtns = overlay.querySelectorAll(".st-tab-btn");
  const contentArea = overlay.querySelector("#st-tab-content-area");

  // Style helper for tab buttons
  const setTabActive = (activeBtn) => {
    tabBtns.forEach(btn => {
      btn.style.cssText = "padding:8px 14px; background:transparent; border:none; border-bottom:2px solid transparent; font-weight:500; font-size:13px; color:#64748b; cursor:pointer;";
    });
    activeBtn.style.borderBottom = "2px solid #065f46";
    activeBtn.style.color = "#065f46";
    activeBtn.style.fontWeight = "700";
  };

  // --- TAB 1: PROFILE ---
  const renderProfileTab = () => {
    const isTcIssued = student.status === "tc_issued";
    contentArea.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; font-size:13px;">
        
        <!-- Personal Information -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <h4 style="margin:0 0 10px 0; color:#065f46;">Personal Information</h4>
          <table style="width:100%; border:none;">
            <tr><td style="color:#64748b; padding:4px 0;">Admission No:</td><td><strong>${student.admissionNo}</strong></td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Full Name:</td><td><strong>${student.name}</strong></td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Gender:</td><td><span class="badge ${(student.gender||'male')==='female'?'badge-online':'badge-active'}">${(student.gender||'male').toUpperCase()}</span></td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Date of Birth:</td><td>${student.dob || '-'}</td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Status:</td><td><span class="badge ${isTcIssued?'badge-inactive':'badge-active'}">${isTcIssued?'TC ISSUED':'ACTIVE STUDENT'}</span></td></tr>
          </table>
        </div>

        <!-- Academic & Classroom Allocation -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <h4 style="margin:0 0 10px 0; color:#065f46;">Classroom & Contact</h4>
          <table style="width:100%; border:none;">
            <tr><td style="color:#64748b; padding:4px 0;">Classroom:</td><td><strong>${student.classroomName || 'Unassigned'}</strong></td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Learning Mode:</td><td><span class="badge ${student.mode==='online'?'badge-online':'badge-offline'}">${(student.mode||'offline').toUpperCase()}</span></td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Guardian:</td><td>${student.guardianName || '-'}</td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">Primary Mobile:</td><td><code>${student.parentPhone || '-'}</code></td></tr>
            <tr><td style="color:#64748b; padding:4px 0;">WhatsApp:</td><td><code>${student.whatsappNumber || student.parentPhone || '-'}</code></td></tr>
          </table>
        </div>

      </div>

      <!-- Enrollment History -->
      <div style="margin-top:16px;">
        <h4 style="margin:0 0 8px 0; font-size:13px; color:#0f172a;">Academic Enrollment History</h4>
        <div class="table-wrapper">
          <table style="font-size:12px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th>Academic Year</th>
                <th>Classroom Assigned</th>
                <th>Mode</th>
                <th>Date Logged</th>
              </tr>
            </thead>
            <tbody>
              ${(student.enrollmentHistory && student.enrollmentHistory.length > 0) 
                ? student.enrollmentHistory.map(h => `
                  <tr>
                    <td><strong>${h.academicYear}</strong></td>
                    <td>${h.classroomName}</td>
                    <td>${(h.mode||'offline').toUpperCase()}</td>
                    <td>${h.date ? h.date.split('T')[0] : '-'}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="4" style="text-align:center;">Current Enrollment: ${student.classroomName || 'Initial'}</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // --- TAB 2: FEE LEDGER ---
  const renderFeeTab = async () => {
    contentArea.innerHTML = "<p>Loading fee ledger...</p>";
    const feeSnap = await getDocs(query(collection(db, "fees"), where("studentId", "==", student.id)));
    const feeRecords = feeSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const annualFee = 6000; // Configurable base standard fee
    const paidAmount = feeRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const balance = Math.max(0, annualFee - paidAmount);

    contentArea.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:14px;">
        <div class="stat-card" style="text-align:center; padding:12px;">
          <div class="stat-val" style="font-size:20px;">₹${annualFee}</div>
          <div class="stat-lbl">Annual Term Fee</div>
        </div>
        <div class="stat-card" style="text-align:center; padding:12px;">
          <div class="stat-val" style="font-size:20px; color:#16a34a;">₹${paidAmount}</div>
          <div class="stat-lbl">Total Paid</div>
        </div>
        <div class="stat-card" style="text-align:center; padding:12px;">
          <div class="stat-val" style="font-size:20px; color:${balance > 0 ? '#dc2626' : '#16a34a'};">₹${balance}</div>
          <div class="stat-lbl">${balance === 0 ? 'Fully Cleared' : 'Pending Due'}</div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="margin:0; font-size:13px;">Fee Payment Receipts</h4>
        ${!isStaff ? `<button class="btn-primary btn-sm" id="record-fee-btn">+ Collect Payment</button>` : ''}
      </div>

      <div class="table-wrapper" style="max-height:200px; overflow-y:auto;">
        <table style="font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th>Receipt #</th>
              <th>Date</th>
              <th>Category</th>
              <th>Amount Paid</th>
              <th>Mode</th>
              <th>Collected By</th>
            </tr>
          </thead>
          <tbody>
            ${feeRecords.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:12px;">No payment receipts recorded.</td></tr>` : ''}
            ${feeRecords.map(r => `
              <tr>
                <td><strong>${r.receiptNo || r.id}</strong></td>
                <td>${r.date || '-'}</td>
                <td>${r.category || 'Term Fee'}</td>
                <td style="font-weight:bold; color:#065f46;">₹${r.amount}</td>
                <td>${(r.paymentMethod || 'Cash').toUpperCase()}</td>
                <td>${r.collectedBy || 'Office'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    const recordBtn = contentArea.querySelector("#record-fee-btn");
    if (recordBtn) {
      recordBtn.onclick = () => {
        UI.showModal("Record Fee Payment", `
          <label>Payment Amount (₹)</label>
          <input type="number" id="fee-amount" placeholder="e.g. 2000" min="1" required />
          <label style="margin-top:8px; display:block;">Fee Category</label>
          <select id="fee-cat">
            <option value="Tuition Fee">Tuition Fee</option>
            <option value="Admission / Book Fee">Admission / Book Fee</option>
            <option value="Examination Fee">Examination Fee</option>
          </select>
          <label style="margin-top:8px; display:block;">Payment Mode</label>
          <select id="fee-method">
            <option value="Cash">Cash</option>
            <option value="UPI / Online">UPI / Google Pay</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        `, async () => {
          const amount = parseFloat(document.getElementById("fee-amount").value);
          const category = document.getElementById("fee-cat").value;
          const paymentMethod = document.getElementById("fee-method").value;
          if (!amount || amount <= 0) throw new Error("Enter a valid payment amount.");

          const receiptNo = "REC" + Math.floor(100000 + Math.random() * 900000);
          const feeDocId = `fee_${student.id}_${receiptNo}`;

          await setDoc(doc(db, "fees", feeDocId), {
            id: feeDocId,
            receiptNo,
            studentId: student.id,
            admissionNo: student.admissionNo,
            studentName: student.name,
            amount,
            category,
            paymentMethod,
            collectedBy: currentUser?.name || "Admin",
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });

          UI.toast("Payment receipt generated!");
          renderFeeTab();
        });
      };
    }
  };

  // --- TAB 3: ACADEMICS PERFORMANCE ---
  const renderAcademicsTab = async () => {
    contentArea.innerHTML = "<p>Loading examination records...</p>";
    const resSnap = await getDocs(query(collection(db, "results"), where("studentId", "==", student.id)));
    const examDocs = resSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (examDocs.length === 0) {
      contentArea.innerHTML = `
        <div style="text-align:center; padding:30px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <p style="margin:0; color:#64748b;">No published exam results found for ${student.name}.</p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${examDocs.map(ex => {
          const marksEntries = Object.entries(ex).filter(([k]) => k.startsWith("marks_")).map(([, v]) => v);
          return `
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:8px;">
                <div>
                  <strong style="color:#065f46; font-size:14px;">${ex.examName || 'Examination'}</strong>
                  <span style="font-size:12px; color:#64748b; margin-left:8px;">Updated: ${ex.lastUpdated ? ex.lastUpdated.split('T')[0] : '-'}</span>
                </div>
                <a href="results-card.html?adm=${student.admissionNo}&dob=${student.dob}&examId=${ex.examId}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;">
                  🖨️ View Full Marksheet
                </a>
              </div>
              <div class="table-wrapper">
                <table style="font-size:12px;">
                  <thead>
                    <tr style="background:#f8fafc;">
                      <th>Subject</th>
                      <th>Modes Breakdown</th>
                      <th>Total</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${marksEntries.map(m => `
                      <tr>
                        <td><strong>${m.subjectName}</strong></td>
                        <td style="color:#64748b;">${Object.entries(m.modeMarks||{}).map(([k,v])=>`${k}:${v}`).join(", ")}</td>
                        <td style="font-weight:bold;">${m.total}</td>
                        <td><span class="badge ${m.grade==='F'||m.isAbsent?'badge-inactive':'badge-active'}">${m.grade}</span></td>
                        <td style="font-weight:600; color:${m.isPassed?'#16a34a':'#dc2626'};">${m.isAbsent?'ABSENT':(m.isPassed?'PASSED':'FAILED')}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  };

  // --- TAB 4: ATTENDANCE HISTORY ---
  const renderAttendanceTab = async () => {
    contentArea.innerHTML = "<p>Loading attendance registers...</p>";
    const attSnap = await getDocs(query(collection(db, "attendance"), where("classroomId", "==", student.classroomId || "")));
    const allDays = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let present = 0;
    let absent = 0;
    let total = 0;

    const historyRows = [];
    allDays.forEach(day => {
      const status = (day.records && day.records[student.id]) ? day.records[student.id] : null;
      if (status) {
        total++;
        if (status === "present") present++;
        else absent++;
        historyRows.push({ date: day.date, status });
      }
    });

    const attPct = total > 0 ? Math.round((present / total) * 100) : 100;

    contentArea.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:14px;">
        <div class="stat-card" style="text-align:center; padding:12px;">
          <div class="stat-val" style="font-size:22px; color:#065f46;">${attPct}%</div>
          <div class="stat-lbl">Attendance Rate</div>
        </div>
        <div class="stat-card" style="text-align:center; padding:12px;">
          <div class="stat-val" style="font-size:22px; color:#16a34a;">${present} Days</div>
          <div class="stat-lbl">Days Present</div>
        </div>
        <div class="stat-card" style="text-align:center; padding:12px;">
          <div class="stat-val" style="font-size:22px; color:#dc2626;">${absent} Days</div>
          <div class="stat-lbl">Days Absent</div>
        </div>
      </div>

      <h4 style="margin:0 0 8px 0; font-size:13px;">Daily Attendance Logs</h4>
      <div class="table-wrapper" style="max-height:220px; overflow-y:auto;">
        <table style="font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;"><th>Date</th><th>Session</th><th>Marked Status</th></tr>
          </thead>
          <tbody>
            ${historyRows.length === 0 ? `<tr><td colspan="3" style="text-align:center; padding:12px;">No attendance logged for this classroom yet.</td></tr>` : ''}
            ${historyRows.map(h => `
              <tr>
                <td><strong>${h.date}</strong></td>
                <td>Regular Madrasa Class</td>
                <td><span class="badge ${h.status==='present'?'badge-active':'badge-inactive'}">${h.status.toUpperCase()}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  // --- TAB 5: ISSUE TRANSFER CERTIFICATE (TC) ---
  const renderTcTab = () => {
    const isTcIssued = student.status === "tc_issued";
    contentArea.innerHTML = `
      <div style="background:#fff; border:1px solid #fecdd3; border-radius:8px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h4 style="margin:0; color:#b91c1c; font-size:15px;">Transfer Certificate (TC) Protocol</h4>
            <span style="font-size:12px; color:#64748b;">Generates official Madrasa Leaving Certificate and deactivates active roster.</span>
          </div>
          <span class="badge ${isTcIssued ? 'badge-inactive' : 'badge-active'}">
            ${isTcIssued ? 'TC ALREADY ISSUED' : 'ACTIVE ENROLLMENT'}
          </span>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px;">
          <div>
            <label style="font-weight:600;">Date of Leaving / Issue</label>
            <input type="date" id="tc-date" value="${student.tcDate || new Date().toISOString().split('T')[0]}" />
          </div>
          <div>
            <label style="font-weight:600;">Reason for Leaving</label>
            <input type="text" id="tc-reason" value="${student.tcReason || 'Completed Course / Relocation'}" placeholder="e.g. Course completed / Shifted residence" />
          </div>
        </div>

        <div style="margin-top:12px; font-size:13px;">
          <label style="font-weight:600;">Character & Conduct Remark</label>
          <select id="tc-conduct">
            <option value="Good" ${(student.tcConduct||'Good')==='Good'?'selected':''}>Good (حسن)</option>
            <option value="Very Good" ${(student.tcConduct||'')==='Very Good'?'selected':''}>Very Good (ممتاز)</option>
            <option value="Satisfactory" ${(student.tcConduct||'')==='Satisfactory'?'selected':''}>Satisfactory</option>
          </select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
          <button class="btn-secondary" id="preview-tc-doc-btn">🖨️ Print TC Document</button>
          ${!isStaff ? `
            <button class="btn-danger" id="confirm-issue-tc-btn">
              ${isTcIssued ? 'Update TC Records' : 'Confirm & Issue TC'}
            </button>
          ` : ''}
        </div>
      </div>
    `;

    // Print TC Authenticated Sheet
    contentArea.querySelector("#preview-tc-doc-btn").onclick = () => {
      const tcDate = document.getElementById("tc-date").value;
      const tcReason = document.getElementById("tc-reason").value;
      const tcConduct = document.getElementById("tc-conduct").value;

      const printWin = window.open("", "_blank");
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Transfer Certificate - ${student.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; }
            .tc-box { border: 4px double #065f46; padding: 32px 40px; border-radius: 8px; max-width: 720px; margin: 0 auto; }
            h2 { margin: 0; color: #065f46; text-transform: uppercase; font-size: 22px; }
            h3 { margin: 8px 0; color: #92400e; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
            td { padding: 8px 4px; }
            .tc-lbl { width: 45%; color: #475569; font-weight: 500; }
            .tc-val { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="tc-box">
            <div style="text-align:center; border-bottom: 2px solid #065f46; padding-bottom: 12px;">
              <h2>IZZATHUL ISLAM MADRASA</h2>
              <p style="margin:2px 0; font-size:11px; color:#64748b;">Under Samastha Kerala Jam'iyyathul Ulama (Reg. No. 9016) • Bengaluru</p>
              <h3>TRANSFER CERTIFICATE (T.C.)</h3>
            </div>

            <table>
              <tr><td class="tc-lbl">1. Admission Number:</td><td class="tc-val">${student.admissionNo}</td></tr>
              <tr><td class="tc-lbl">2. Name of the Student:</td><td class="tc-val">${student.name}</td></tr>
              <tr><td class="tc-lbl">3. Name of Parent / Guardian:</td><td class="tc-val">${student.guardianName || '-'}</td></tr>
              <tr><td class="tc-lbl">4. Date of Birth (as per admission register):</td><td class="tc-val">${student.dob}</td></tr>
              <tr><td class="tc-lbl">5. Class & Division in which studying:</td><td class="tc-val">${student.classroomName || 'Standard'}</td></tr>
              <tr><td class="tc-lbl">6. Learning Mode:</td><td class="tc-val">${(student.mode||'offline').toUpperCase()}</td></tr>
              <tr><td class="tc-lbl">7. Date of Leaving Madrasa:</td><td class="tc-val">${tcDate}</td></tr>
              <tr><td class="tc-lbl">8. Reason for Leaving:</td><td class="tc-val">${tcReason}</td></tr>
              <tr><td class="tc-lbl">9. General Conduct & Character:</td><td class="tc-val">${tcConduct}</td></tr>
            </table>

            <div style="display:flex; justify-content:space-between; margin-top: 60px; text-align:center; font-size: 13px;">
              <div>____________________<br/>Prepared By</div>
              <div>____________________<br/>Class Ustadh</div>
              <div>____________________<br/>Sadar Muallim / Seal</div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
      `);
      printWin.document.close();
    };

    // Confirm Issue TC Action
    const confirmBtn = contentArea.querySelector("#confirm-issue-tc-btn");
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const tcDate = document.getElementById("tc-date").value;
        const tcReason = document.getElementById("tc-reason").value;
        const tcConduct = document.getElementById("tc-conduct").value;

        if (!confirm(`Are you sure you want to issue TC for ${student.name}? Status will be set to Inactive/TC Issued.`)) return;

        await setDocument("students", student.id, {
          status: "tc_issued",
          tcDate,
          tcReason,
          tcConduct,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        student.status = "tc_issued";
        student.tcDate = tcDate;
        student.tcReason = tcReason;
        student.tcConduct = tcConduct;

        UI.toast("TC issued and recorded successfully!");
        renderTcTab();
      };
    }
  };

  // Wire Tab Switches
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      setTabActive(btn);
      const tab = btn.dataset.tab;
      if (tab === "tab-profile") renderProfileTab();
      else if (tab === "tab-fee") renderFeeTab();
      else if (tab === "tab-academics") renderAcademicsTab();
      else if (tab === "tab-attendance") renderAttendanceTab();
      else if (tab === "tab-tc") renderTcTab();
    };
  });

  // Load Initial Tab
  setTabActive(tabBtns[0]);
  renderProfileTab();
}

async function openStudentFormModal(existing, classrooms, classes, divisions, customFields, activeYear, container) {
  const isEdit = !!existing;
  const nextAdm = isEdit ? existing.admissionNo : await getNextAdmissionNumber();

  UI.showModal(`${isEdit ? 'Edit' : 'Register'} Student`, `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      <div>
        <label>Admission No</label>
        <input type="text" id="st-adm" value="${nextAdm}" readonly style="background:#f1f5f9;font-weight:700;" />
      </div>
      <div>
        <label>Full Name</label>
        <input type="text" id="st-name" value="${existing?.name || ''}" placeholder="Aisha Maryam" required />
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-top:8px;">
      <div>
        <label>Gender</label>
        <select id="st-gender">
          <option value="male" ${(existing?.gender || 'male') === 'male' ? 'selected' : ''}>Male (Boy)</option>
          <option value="female" ${existing?.gender === 'female' ? 'selected' : ''}>Female (Girl)</option>
        </select>
      </div>
      <div>
        <label>Date of Birth</label>
        <input type="date" id="st-dob" value="${existing?.dob || ''}" required />
      </div>
      <div>
        <label>Learning Mode</label>
        <select id="st-mode">
          <option value="offline" ${existing?.mode === 'offline' ? 'selected' : ''}>Offline</option>
          <option value="online" ${existing?.mode === 'online' ? 'selected' : ''}>Online</option>
        </select>
      </div>
      <div>
        <label>Class</label>
        <select id="st-class"></select>
      </div>
      <div>
        <label>Division</label>
        <select id="st-div"></select>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-top:8px;">
      <div>
        <label>Guardian Name</label>
        <input type="text" id="st-guardian" value="${existing?.guardianName || ''}" placeholder="Father / Mother" required />
      </div>
      <div>
        <label>Parent Mobile</label>
        <input type="tel" id="st-phone" value="${existing?.parentPhone || ''}" placeholder="9876543210" required />
      </div>
      <div>
        <label>WhatsApp Number</label>
        <input type="tel" id="st-wa" value="${existing?.whatsappNumber || existing?.parentPhone || ''}" placeholder="9876543210" />
      </div>
    </div>
  `, async () => {
    const admissionNo = document.getElementById("st-adm").value;
    const name = document.getElementById("st-name").value.trim();
    const gender = document.getElementById("st-gender").value;
    const dob = document.getElementById("st-dob").value;
    const mode = document.getElementById("st-mode").value;
    const classId = document.getElementById("st-class").value;
    const divId = document.getElementById("st-div").value;
    const guardianName = document.getElementById("st-guardian").value.trim();
    const phone = cleanPhone(document.getElementById("st-phone").value);
    const whatsappNumber = cleanPhone(document.getElementById("st-wa").value) || phone;

    const matchedCrm = classrooms.find(c => c.classId === classId && c.divId === divId);
    if (!name || !dob || !phone || !matchedCrm) {
      throw new Error("Fill all required fields and pick a valid class and division.");
    }

    await createOrUpdateParent(phone, dobToPassword(dob));

    const studentId = isEdit ? existing.id : `std_${admissionNo}`;
    const payload = {
      admissionNo,
      name,
      gender,
      dob,
      guardianName,
      parentPhone: phone,
      whatsappNumber,
      mode,
      classroomId: matchedCrm.id,
      classroomName: matchedCrm.name,
      classId: matchedCrm.classId,
      className: matchedCrm.className,
      divId: matchedCrm.divId,
      divCode: matchedCrm.divCode,
      status: existing?.status || "active",
      academicYearId: activeYear ? activeYear.id : ""
    };

    await setDocument("students", studentId, payload, { merge: true });
    UI.toast(`Student ${admissionNo} saved!`);
    StudentsModule.render(container);
  });

  const modalEl = document.getElementById("generic-modal");
  const modeSelect = modalEl.querySelector("#st-mode");
  const classSelect = modalEl.querySelector("#st-class");
  const divisionSelect = modalEl.querySelector("#st-div");

  const syncClasses = () => {
    const mode = modeSelect.value;
    const available = classes.filter(c => (c.mode || "offline") === mode);
    classSelect.innerHTML = available.map(c => `<option value="${c.id}" ${existing?.classId === c.id ? "selected" : ""}>${c.name}</option>`).join("");
    syncDivisions();
  };

  const syncDivisions = () => {
    const selectedClassId = classSelect.value;
    const availableRooms = classrooms.filter(crm => crm.classId === selectedClassId);
    divisionSelect.innerHTML = availableRooms.map(crm => `<option value="${crm.divId}" ${existing?.divId === crm.divId ? "selected" : ""}>Division ${crm.divCode}</option>`).join("");
  };

  modeSelect.onchange = syncClasses;
  classSelect.onchange = syncDivisions;
  syncClasses();
}