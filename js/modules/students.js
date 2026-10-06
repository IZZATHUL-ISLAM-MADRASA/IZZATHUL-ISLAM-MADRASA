import { db } from "../core/firebase-config.js";
import { 
  collection, doc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getCachedDocs, setDocument, deleteDocument, commitTrackedBatch } from "../core/firebase-config.js";
import { getActiveAcademicYear, getNextAdmissionNumber } from "../core/db.js";
import { createOrUpdateParent } from "../core/auth.js";
import { dobToPassword, cleanPhone, padAdmissionNo } from "../core/utils.js";
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

  async render(container) {
    const activeYear = await getActiveAcademicYear();
    // Loaded divisions to eliminate template generation crashes
    const [sSnap, cSnap, fSnap, clSnap, dSnap] = await Promise.all([
      getCachedDocs(collection(db, "students"), "students"),
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "custom_reg_fields"), "custom_reg_fields"),
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "divisions"), "divisions")
    ]);

    const classrooms = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const customFields = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    const divisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.code || "").localeCompare(b.code || ""));
    const allStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => parseInt(a.admissionNo || 0, 10) - parseInt(b.admissionNo || 0, 10));

    let filteredStudents = [...allStudents];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2>Students Directory</h2>
          <p style="color:var(--text-muted);font-size:13px;">Year: <strong>${activeYear ? activeYear.name : 'None Selected'}</strong> | Enrolled: <strong id="total-count-lbl">${allStudents.length}</strong> Students</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-secondary" id="analytics-btn" title="View Statistics">📊 Analytics</button>
          <button class="btn-secondary" id="export-excel-btn">📥 Export Excel</button>
          <button class="btn-secondary" id="download-student-template-btn">📄 Excel Template</button>
          <button class="btn-secondary" id="export-pdf-btn">🖨️ PDF Register</button>
          <button class="btn-secondary" id="bulk-upload-btn">📤 Bulk Upload</button>
          <button class="btn-primary" id="add-student-btn">➕ Register Student</button>
        </div>
      </div>

      <!-- Cascading Filter Toolbar -->
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin:16px 0; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; align-items:center;">
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
      </div>

      <!-- Students Table -->
      <div class="table-wrapper">
        <table id="students-table">
          <thead>
            <tr>
              <th>Adm No</th>
              <th>Student Name</th>
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
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px;">No students match the filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = filteredStudents.map(st => `
        <tr>
          <td><strong>${st.admissionNo}</strong></td>
          <td><strong>${st.name}</strong></td>
          <td>${st.classroomName || 'Unallocated'}</td>
          <td><span class="badge ${st.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(st.mode || 'offline').toUpperCase()}</span></td>
          <td>${st.guardianName || '-'}</td>
          <td><code>${st.parentPhone || '-'}</code></td>
          <td style="text-align:center; white-space:nowrap;">
            <button class="btn-secondary btn-sm edit-st-btn" data-id="${st.id}" title="Edit Student">✏️</button>
            <button class="btn-danger btn-sm del-st-btn" data-id="${st.id}" title="Delete Student">🗑️</button>
          </td>
        </tr>
      `).join("");

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
            StudentsModule.render(container);
          }
        };
      });
    };

    const applyFilters = () => {
      const term = container.querySelector("#st-search-input").value.trim().toLowerCase();
      const selectedClass = classFilter.value;
      const selectedMode = modeFilter.value;

      filteredStudents = allStudents.filter(st => {
        const matchesTerm = !term ||
          (st.admissionNo && st.admissionNo.toLowerCase().includes(term)) ||
          (st.name && st.name.toLowerCase().includes(term)) ||
          (st.guardianName && st.guardianName.toLowerCase().includes(term)) ||
          (st.parentPhone && st.parentPhone.includes(term));

        const matchesClass = selectedClass === "all" || (st.className === selectedClass || (st.classroomName && st.classroomName.includes(selectedClass)));
        const matchesMode = selectedMode === "all" || (st.mode || "offline") === selectedMode;

        return matchesTerm && matchesClass && matchesMode;
      });

      renderTableRows();
    };

    modeFilter.onchange = () => {
      refreshClassFilterOptions();
      applyFilters();
    };
    classFilter.onchange = applyFilters;
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
    container.querySelector("#bulk-upload-btn").onclick = () => {
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
          const dob = getVal(row, "dob", "dateOfBirth");
          const mode = getVal(row, "mode", "learningMode").toLowerCase();
          const className = getVal(row, "class", "className");
          const divCode = getVal(row, "division", "divCode").toUpperCase();
          const parentPhone = cleanPhone(getVal(row, "parentPhone", "phone"));

          if (!admissionNo || !name || !dob || !parentPhone || !mode || !className || !divCode) {
            throw new Error(`Row ${idx + 2}: Required information missing.`);
          }

          const matchedClass = classes.find(c => c.name.toLowerCase() === className.toLowerCase() && (c.mode || "offline") === mode);
          if (!matchedClass) {
            throw new Error(`Row ${idx + 2}: Class "${className}" in ${mode.toUpperCase()} mode not found.`);
          }

          const matchedCrm = classrooms.find(crm => crm.classId === matchedClass.id && crm.divCode.toUpperCase() === divCode);
          if (!matchedCrm) {
            throw new Error(`Row ${idx + 2}: Classroom for ${className} - Div ${divCode} does not exist.`);
          }

          payloads.push({
            id: `std_${admissionNo}`,
            admissionNo,
            name,
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
        StudentsModule.render(container);
      });
    };

    container.querySelector("#add-student-btn").onclick = () => {
      openStudentFormModal(null, classrooms, classes, divisions, customFields, activeYear, container);
    };

    // Analytics
    container.querySelector("#analytics-btn").onclick = () => {
      const offlineCount = allStudents.filter(s => (s.mode || "offline") === "offline").length;
      const onlineCount = allStudents.filter(s => s.mode === "online").length;
      UI.showModal("Students Breakdown", `
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:16px;">
          <div class="stat-card" style="text-align:center;"><div class="stat-val">${allStudents.length}</div><div class="stat-lbl">Total Students</div></div>
          <div class="stat-card" style="text-align:center;"><div class="stat-val" style="color:var(--primary);">${offlineCount}</div><div class="stat-lbl">Offline</div></div>
          <div class="stat-card" style="text-align:center;"><div class="stat-val" style="color:#3730a3;">${onlineCount}</div><div class="stat-lbl">Online</div></div>
        </div>
      `);
    };

    // PDF Register
    container.querySelector("#export-pdf-btn").onclick = () => {
      const printWin = window.open("", "_blank");
      printWin.document.write(`
        <html><head><title>Student Register</title>
        <style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #ccc;padding:6px;}</style>
        </head><body>
        <h2>Izzathul Islam Madrasa - Student Register</h2>
        <table><thead><tr><th>Adm No</th><th>Name</th><th>Classroom</th><th>Mode</th><th>Parent Mobile</th></tr></thead>
        <tbody>
          ${filteredStudents.map(s => `<tr><td>${s.admissionNo}</td><td>${s.name}</td><td>${s.classroomName||'-'}</td><td>${(s.mode||'offline').toUpperCase()}</td><td>${s.parentPhone||'-'}</td></tr>`).join("")}
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

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-top:8px;">
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