import { db, getCachedDocs, setDocument, updateDocument, deleteDocument, commitTrackedBatch } from "../core/firebase-config.js";
import { 
  collection, doc, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getActiveAcademicYear } from "../core/db.js";
import { UI } from "../core/ui.js";

async function commitInBatches(operations, collectionName) {
  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(db);
    operations.slice(offset, offset + 450).forEach(operation => operation(batch));
    await commitTrackedBatch(batch, [collectionName]);
  }
}

async function clearPublishedResults(examId, keepIds = []) {
  const snapshot = await getCachedDocs(query(
    collection(db, "public_results"),
    where("examId", "==", examId)
  ), "public_results", `exam:${examId}`);
  const keep = new Set(keepIds);
  const stale = snapshot.docs.filter(result => !keep.has(result.id));
  await commitInBatches(
    stale.map(result => batch => batch.delete(doc(db, "public_results", result.id))),
    "public_results"
  );
}

 function getYearFromDate(dateInput) {
  if (!dateInput) return null;

  // If already a Date object, use getFullYear
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput.getFullYear();
  }

  // Parse string (using split or replacing to avoid UTC timezone day shifts)
  const [year] = String(dateInput).split(/[-/]/);
  const parsedYear = parseInt(year, 10);

  return isNaN(parsedYear) ? null : parsedYear;
}

async function publishExamResults(exam) {
  const [resultsSnap, studentsSnap] = await Promise.all([
    getCachedDocs(query(collection(db, "results"), where("examId", "==", exam.id)), "results", `exam:${exam.id}`),
    getCachedDocs(collection(db, "students"), "students")
  ]);
  const studentsById = new Map(studentsSnap.docs.map(student => [student.id, student.data()]));
  const publishedAt = new Date().toISOString();
  const resultRecords = resultsSnap.docs
    .map(snapshot => snapshot.data())
    .filter(result => Object.keys(result).some(key => key.startsWith("marks_")));

  if (resultRecords.length === 0) {
    throw new Error("Enter marks for at least one student before publishing this exam.");
  }

  const publications = resultRecords.map(result => {
    const student = studentsById.get(result.studentId);
    if (!student) {
      throw new Error(`Student record not found for admission no. ${result.admissionNo || "unknown"}.`);
    }
    if (!result.admissionNo || !student.dob) {
      throw new Error(`Admission number or date of birth is missing for ${student.name || result.studentId}.`);
    }
    const marks = Object.fromEntries(
      Object.entries(result)
        .filter(([key, value]) => key.startsWith("marks_") && value && typeof value === "object")
        .map(([key, value]) => {
          const subjectId = value.subjectId || key.slice("marks_".length);
          const schedule = (exam.schedules || []).find(item => item.subjectId === subjectId);
          const scheduledMax = (schedule?.modes || []).reduce((total, mode) => total + (Number(mode.max) || 0), 0);
          const maxTotal = Number(value.maxTotal) || scheduledMax || 100;
          const total = value.total === "AB" ? 0 : (Number(value.total) || 0);
          const year = getYearFromDate(student.dob);
          return [key, {
            ...value,
            subjectId,
            maxTotal,
            percentage: value.percentage !== undefined
              ? Number(value.percentage)
              : (value.isAbsent ? 0 : (total / maxTotal) * 100)
          }];
        })
    );
    return {
      id: `${exam.id}_${result.admissionNo}`,
      data: {
        examId: exam.id,
        examName: result.examName || exam.name,
        admissionNo: result.admissionNo,
        dob: student.dob,
        dobYear: year,
        studentName: result.studentName || student.name,
        classroomName: result.classroomName || student.classroomName || "",
        mode: student.mode || "offline",
        examAttendance: result.examAttendance || null,
        isPublished: true,
        publishedAt,
        ...marks
      }
    };
  });

  await updateDocument("exams", exam.id, { isPublished: false });
  await commitInBatches(publications.map(publication => batch =>
    batch.set(doc(db, "public_results", publication.id), publication.data)
  ), "public_results");
  await updateDocument("exams", exam.id, { isPublished: true, publishedAt });
  await clearPublishedResults(exam.id, publications.map(publication => publication.id));

  return publications.length;
}

export const ExamsModule = {
  id: "exams",
  title: "Examinations Master",
  roles: ["admin"],

  async render(container) {
    const activeYear = await getActiveAcademicYear();
    const [eSnap, clSnap, dSnap, sSnap, nSnap, crmSnap, csSnap] = await Promise.all([
      getCachedDocs(collection(db, "exams"), "exams"),
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "divisions"), "divisions"),
      getCachedDocs(collection(db, "subjects"), "subjects"),
      getCachedDocs(collection(db, "assessment_natures"), "assessment_natures"),
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "classroom_subjects"), "classroom_subjects")
    ]);

    const exams = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    const divisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.code || "").localeCompare(b.code || ""));
    const subjects = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.code || "").localeCompare(b.code || ""));
    const classrooms = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classroomSubjects = csSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    let natures = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (natures.length === 0) {
      const defaultNatures = ["TE", "CE", "Oral", "OMR", "Practical", "Viva", "Thilawa"];
      for (const name of defaultNatures) {
        const id = "nat_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const obj = { id, name };
        await setDocument("assessment_natures", id, obj);
        natures.push(obj);
      }
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Examination & Schedule Master</h2>
          <p style="color:var(--text-muted);font-size:13px;">Year: <strong>${activeYear ? activeYear.name : 'None Selected'}</strong></p>
        </div>
        <button class="btn-primary" id="add-exam-btn">➕ Create Exam</button>
      </div>

      <div class="table-wrapper" style="margin-top:16px;">
        <table>
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Timetable Entries</th>
              <th>Status</th>
              <th style="text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${exams.length === 0 ? `<tr><td colspan="4" style="text-align:center;">No exams created yet.</td></tr>` : ''}
            ${exams.map(e => `
              <tr>
                <td><strong>${e.name}</strong></td>
                <td>
                  <button class="btn-secondary btn-sm manage-sched-btn" data-id="${e.id}">
                    🗓️ Manage Timetable (${(e.schedules || []).length})
                  </button>
                </td>
                <td>
                  <span class="badge ${e.isPublished ? 'badge-active' : 'badge-inactive'}">
                    ${e.isPublished ? 'PUBLISHED' : 'DRAFT'}
                  </span>
                </td>
                <td style="text-align:center; white-space:nowrap;">
                  <button class="btn-secondary btn-sm toggle-pub-btn" data-id="${e.id}" data-pub="${e.isPublished}" title="${e.isPublished ? 'Unpublish' : 'Publish'}">
                    ${e.isPublished ? '🔒 Unpublish' : '⚡ Publish'}
                  </button>
                  <button class="btn-danger btn-sm del-exam-btn" data-id="${e.id}" title="Delete Exam">🗑️️</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#add-exam-btn").onclick = () => {
      UI.showModal("Create Examination", `
        <label>Exam Session Name</label>
        <input type="text" id="ex-name" placeholder="Mid-Term Examination 2026" required />
      `, async () => {
        const name = document.getElementById("ex-name").value.trim();
        if (!name) throw new Error("Exam name required");

        const id = "ex_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        await setDocument("exams", id, {
          name,
          academicYearId: activeYear ? activeYear.id : "",
          schedules: [],
          isPublished: false,
          createdAt: new Date().toISOString()
        });

        UI.toast("Exam created!");
        ExamsModule.render(container);
      });
    };

    container.querySelectorAll(".manage-sched-btn").forEach(btn => {
      btn.onclick = () => {
        const exam = exams.find(e => e.id === btn.dataset.id);
        renderExamSchedulePage(exam, classes, divisions, subjects, natures, classrooms, classroomSubjects, container);
      };
    });

    container.querySelectorAll(".toggle-pub-btn").forEach(b => {
      b.onclick = async () => {
        const pub = b.dataset.pub === "true";
        const exam = exams.find(item => item.id === b.dataset.id);
        b.disabled = true;
        try {
          if (pub) {
            await updateDocument("exams", b.dataset.id, { isPublished: false });
            await clearPublishedResults(b.dataset.id);
            UI.toast("Exam unpublished. Public results are hidden.");
          } else {
            const count = await publishExamResults(exam);
            UI.toast(`Published results for ${count} students.`);
          }
          ExamsModule.render(container);
        } catch (error) {
          UI.toast(`Unable to ${pub ? "unpublish" : "publish"} exam: ${error.message}`, "error");
          b.disabled = false;
        }
      };
    });

    container.querySelectorAll(".del-exam-btn").forEach(b => {
      b.onclick = async () => {
        if (confirm("Delete this examination session?")) {
          await deleteDocument("exams", b.dataset.id);
          ExamsModule.render(container);
        }
      };
    });
  }
};

function renderExamSchedulePage(exam, classes, divisions, subjects, natures, classrooms, classroomSubjects, container) {
  let schedules = exam.schedules || [];
  let filteredSchedules = [...schedules];
  let editIndex = null;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <div>
        <button class="btn-secondary btn-sm" id="back-to-exams-btn" style="margin-bottom:6px;">⬅️ Back to Exam Sessions</button>
        <h2 style="margin:0;">Timetable Workbench: <span style="color:var(--primary);">${exam.name}</span></h2>
        <p style="color:var(--text-muted);font-size:13px;margin:2px 0 0 0;">Manage timetable slots and assessment evaluation structures.</p>
      </div>
    </div>

    <!-- Live Filters Toolbar -->
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:center;">
      <div>
        <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Search Timetable</label>
        <input type="text" id="sch-search" placeholder="Search Subject or Class..." style="margin-top:2px;" />
      </div>
      <div>
        <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Filter by Mode</label>
        <select id="sch-filter-mode" style="margin-top:2px;">
          <option value="all">All Modes</option>
          <option value="offline">Offline Only</option>
          <option value="online">Online Only</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px; font-weight:600; color:var(--text-muted);">Filter by Class</label>
        <select id="sch-filter-class" style="margin-top:2px;">
          <option value="all">All Classes</option>
          ${[...new Set(classes.map(c => c.name.trim()))].map(name => `<option value="${name}">${name}</option>`).join("")}
        </select>
      </div>
    </div>

    <!-- Timetable List Table -->
    <div class="stat-card" style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3>Scheduled Timetable (<span id="sch-count-lbl">${schedules.length}</span>)</h3>
      </div>
      <div class="table-wrapper" style="max-height:300px; overflow-y:auto;">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Mode</th>
              <th>Divisions</th>
              <th>Subject</th>
              <th>Evaluation Structure</th>
              <th>Total Max</th>
              <th style="text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody id="sch-table-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Inline Builder Form -->
    <div class="stat-card" id="schedule-builder-card" style="border:1px solid #cbd5e1; background:#f8fafc;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h4 id="builder-title" style="margin:0;">➕ Add Timetable Entry</h4>
        <button type="button" class="btn-secondary btn-sm" id="cancel-edit-btn" style="display:none;">Cancel Edit</button>
      </div>

      <div style="display:grid; grid-template-columns: minmax(140px, 1fr) minmax(160px, 1fr) minmax(200px, 1.5fr); gap:12px;">
        <div>
          <label style="font-size:12px; font-weight:600;">1. Delivery Mode</label>
          <select id="sch-mode">
            <option value="both">Both (Offline & Online)</option>
            <option value="offline">Offline Only</option>
            <option value="online">Online Only</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600;">2. Class</label>
          <select id="sch-class"></select>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600;">3. Divisions</label>
          <div id="sch-divisions" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;"></div>
        </div>
      </div>

      <div style="margin-top:14px;">
        <label style="font-size:12px; font-weight:600;">4. Select Subject(s) Assigned to Class</label>
        <div id="sch-subject-container" style="max-height:130px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding:8px; display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:6px; margin-top:4px;">
        </div>
      </div>

      <div style="margin-top:14px; border:1px solid #cbd5e1; background:#fff; border-radius:6px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <label style="font-size:12px; font-weight:600;">5. Evaluation Breakdown (TE, CE, Oral, etc.)</label>
          <button type="button" class="btn-secondary btn-sm" id="add-nature-row-btn">➕ Add Row</button>
        </div>
        
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr auto; gap:8px; font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:6px;">
          <span>Evaluation Nature</span>
          <span>Max Mark</span>
          <span>Pass Mark</span>
          <span></span>
        </div>

        <div id="nature-rows-container"></div>
      </div>

      <button class="btn-primary" id="sch-save-btn" style="margin-top:16px; width:100%; padding:10px;">
        💾 Save Timetable Entry
      </button>
    </div>
  `;

  // Back Button
  container.querySelector("#back-to-exams-btn").onclick = () => {
    ExamsModule.render(container);
  };

  const tbody = container.querySelector("#sch-table-body");
  const modeSelect = container.querySelector("#sch-mode");
  const classSelect = container.querySelector("#sch-class");
  const divisionsContainer = container.querySelector("#sch-divisions");
  const subjectsContainer = container.querySelector("#sch-subject-container");
  const natureRowsContainer = container.querySelector("#nature-rows-container");
  const cancelEditBtn = container.querySelector("#cancel-edit-btn");
  const builderTitle = container.querySelector("#builder-title");

  // Renders the Timetable Table rows
  const renderTableRows = () => {
    container.querySelector("#sch-count-lbl").textContent = `${filteredSchedules.length} of ${schedules.length}`;
    if (filteredSchedules.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px;">No timetable entries matching criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredSchedules.map(s => {
      const actualIdx = schedules.indexOf(s);
      const modesDesc = (s.modes || []).map(m => `${m.name} (${m.max}/${m.pass})`).join(" | ");
      const totalMax = (s.modes || []).reduce((acc, m) => acc + (m.max || 0), 0);
      return `
        <tr>
          <td><strong>${s.className}</strong></td>
          <td><span class="badge ${s.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(s.mode || 'offline').toUpperCase()}</span></td>
          <td>${(s.divisions || []).join(", ") || 'All'}</td>
          <td><strong>${s.subjectName}</strong></td>
          <td style="font-size:12px;">${modesDesc || '-'}</td>
          <td><strong>${totalMax}</strong></td>
          <td style="text-align:center; white-space:nowrap;">
            <button class="btn-secondary btn-sm edit-sch-row" data-idx="${actualIdx}" title="Edit Schedule">✏️</button>
            <button class="btn-danger btn-sm del-sch-row" data-idx="${actualIdx}" title="Delete Schedule">🗑️</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".edit-sch-row").forEach(b => {
      b.onclick = () => {
        startEdit(parseInt(b.dataset.idx, 10));
      };
    });

    tbody.querySelectorAll(".del-sch-row").forEach(b => {
      b.onclick = async () => {
        if (confirm("Delete this schedule entry?")) {
          const idx = parseInt(b.dataset.idx, 10);
          schedules.splice(idx, 1);
          await updateDocument("exams", exam.id, { schedules });
          UI.toast("Timetable entry deleted.");
          applyFilters();
        }
      };
    });
  };

  const applyFilters = () => {
    const term = container.querySelector("#sch-search").value.trim().toLowerCase();
    const mode = container.querySelector("#sch-filter-mode").value;
    const clName = container.querySelector("#sch-filter-class").value;

    filteredSchedules = schedules.filter(s => {
      const matchesTerm = !term || (s.subjectName && s.subjectName.toLowerCase().includes(term)) || (s.className && s.className.toLowerCase().includes(term));
      const matchesMode = mode === "all" || s.mode === mode;
      const matchesClass = clName === "all" || s.className === clName;
      return matchesTerm && matchesMode && matchesClass;
    });

    renderTableRows();
  };

  container.querySelector("#sch-search").oninput = applyFilters;
  container.querySelector("#sch-filter-mode").onchange = applyFilters;
  container.querySelector("#sch-filter-class").onchange = applyFilters;

  // Nature dropdown option builder with "+ Add New Nature..." at the end
  const buildNatureSelectOptions = () => {
    return `
      ${natures.map(n => `<option value="${n.name}">${n.name}</option>`).join("")}
      <option value="__add_new__" style="color:var(--primary); font-weight:700;">+ Add New Nature...</option>
    `;
  };

  const addNatureRow = (defaultName = "TE", defaultMax = 60, defaultPass = 24) => {
    const div = document.createElement("div");
    div.className = "nature-row-item";
    div.style.cssText = "display:grid; grid-template-columns: 2fr 1fr 1fr auto; gap:8px; align-items:center; margin-bottom:6px;";
    div.innerHTML = `
      <select class="row-nature-select" style="font-size:13px;">
        ${buildNatureSelectOptions()}
      </select>
      <input type="number" class="row-max-input" value="${defaultMax}" placeholder="Max" min="1" style="font-size:13px;" />
      <input type="number" class="row-pass-input" value="${defaultPass}" placeholder="Pass" min="0" style="font-size:13px;" />
      <button type="button" class="btn-danger btn-sm remove-row-btn" style="padding:4px 8px;">✕</button>
    `;

    const sel = div.querySelector(".row-nature-select");
    if (Array.from(sel.options).some(o => o.value === defaultName)) {
      sel.value = defaultName;
    }

    sel.onchange = async () => {
      if (sel.value === "__add_new__") {
        const newName = prompt("Enter new Evaluation Nature name (e.g. OMR, Practical, Viva, Thilawa):");
        if (newName && newName.trim()) {
          const cleanName = newName.trim().toUpperCase();
          const id = "nat_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const newObj = { id, name: cleanName };

          await setDocument("assessment_natures", id, newObj);
          natures.push(newObj);

          container.querySelectorAll(".row-nature-select").forEach(otherSel => {
            const currentVal = otherSel === sel ? cleanName : otherSel.value;
            otherSel.innerHTML = buildNatureSelectOptions();
            otherSel.value = currentVal;
          });
          UI.toast(`Evaluation Nature "${cleanName}" created!`);
        } else {
          sel.value = natures[0]?.name || "TE";
        }
      }
    };

    div.querySelector(".remove-row-btn").onclick = () => {
      if (container.querySelectorAll(".nature-row-item").length > 1) {
        div.remove();
      } else {
        UI.toast("At least one evaluation nature is required.", "error");
      }
    };

    natureRowsContainer.appendChild(div);
  };

  container.querySelector("#add-nature-row-btn").onclick = () => {
    addNatureRow("Oral", 20, 8);
  };

  // Sync builder dropdowns
  const refreshSubjectsForClass = (preselectSubId = null) => {
    const mode = modeSelect.value;
    const selectedClassVal = classSelect.value;
    if (!selectedClassVal) {
      subjectsContainer.innerHTML = `<span style="font-size:12px;color:var(--text-muted);padding:8px;">No class selected.</span>`;
      return;
    }

    let relevantClassrooms = [];
    if (mode === "both") {
      const selectedClassName = classSelect.options[classSelect.selectedIndex]?.dataset.name;
      relevantClassrooms = classrooms.filter(c => (c.className || "").trim().toLowerCase() === selectedClassName?.toLowerCase());
    } else {
      relevantClassrooms = classrooms.filter(c => c.classId === selectedClassVal);
    }

    const roomIds = new Set(relevantClassrooms.map(c => c.id));
    const assignedSubIds = new Set(
      classroomSubjects
        .filter(cs => roomIds.has(cs.classroomId))
        .map(cs => cs.subjectId)
    );

    const availableSubs = subjects.filter(s => assignedSubIds.has(s.id));

    if (availableSubs.length === 0) {
      subjectsContainer.innerHTML = `<span style="font-size:12px;color:red;padding:8px;">No subjects allocated to this class in Classroom Subjects Master.</span>`;
      return;
    }

    subjectsContainer.innerHTML = availableSubs.map(s => `
      <label style="font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer;">
        <input type="checkbox" class="sch-sub-cb" value="${s.id}" data-name="${s.name}" ${preselectSubId === s.id ? 'checked' : ''} style="width:auto;" />
        <span><strong>${s.code || ''}</strong> ${s.name}</span>
      </label>
    `).join("");
  };

  const refreshDivisions = (preselectDivs = null) => {
    const mode = modeSelect.value;
    const selectedClassVal = classSelect.value;
    let relevantRooms = [];

    if (mode === "both") {
      const selectedClassName = classSelect.options[classSelect.selectedIndex]?.dataset.name;
      relevantRooms = classrooms.filter(c => (c.className || "").trim().toLowerCase() === selectedClassName?.toLowerCase());
    } else {
      relevantRooms = classrooms.filter(c => c.classId === selectedClassVal);
    }

    const divCodes = [...new Set(relevantRooms.map(r => r.divCode || r.division).filter(Boolean))].sort();

    divisionsContainer.innerHTML = divCodes.length
      ? divCodes.map(code => `
        <label style="font-size:12px; display:flex; align-items:center; gap:4px; background:#fff; padding:3px 8px; border:1px solid #e2e8f0; border-radius:4px; cursor:pointer;">
          <input type="checkbox" class="sch-div-cb" value="${code}" ${!preselectDivs || preselectDivs.includes(code) ? 'checked' : ''} style="width:auto;" />
          Div ${code}
        </label>
      `).join("")
      : `<span style="font-size:12px;color:var(--text-muted);">No divisions configured.</span>`;

    refreshSubjectsForClass();
  };

  const refreshClasses = (preselectClass = null) => {
    const mode = modeSelect.value;

    if (mode === "both") {
      const uniqueNames = [...new Set(classes.map(c => c.name.trim()))];
      classSelect.innerHTML = uniqueNames.length
        ? uniqueNames.map(name => `<option value="${name}" data-name="${name}" ${preselectClass === name ? 'selected' : ''}>${name} (All Modes)</option>`).join("")
        : `<option value="">-- No classes found --</option>`;
    } else {
      const availableClasses = classes.filter(c => (c.mode || "offline") === mode);
      classSelect.innerHTML = availableClasses.length
        ? availableClasses.map(c => `<option value="${c.id}" data-name="${c.name}" ${preselectClass === c.id ? 'selected' : ''}>${c.name}</option>`).join("")
        : `<option value="">-- No classes in this mode --</option>`;
    }

    classSelect.disabled = classSelect.options.length === 0;
    refreshDivisions();
  };

  modeSelect.onchange = () => refreshClasses();
  classSelect.onchange = () => refreshDivisions();

  // Reset form to Add state
  const resetForm = () => {
    editIndex = null;
    builderTitle.textContent = "➕ Add Timetable Entry";
    cancelEditBtn.style.display = "none";
    modeSelect.disabled = false;
    natureRowsContainer.innerHTML = "";
    addNatureRow("TE", 60, 24);
    addNatureRow("CE", 20, 8);
    refreshClasses();
  };

  cancelEditBtn.onclick = resetForm;

  // Edit an existing schedule entry
  const startEdit = (idx) => {
    editIndex = idx;
    const entry = schedules[idx];
    builderTitle.textContent = `✏️ Edit Timetable Entry: ${entry.className} - ${entry.subjectName}`;
    cancelEditBtn.style.display = "inline-block";

    modeSelect.value = entry.mode || "offline";
    refreshClasses(entry.classId);
    refreshDivisions(entry.divisions || []);
    refreshSubjectsForClass(entry.subjectId);

    natureRowsContainer.innerHTML = "";
    (entry.modes || []).forEach(m => {
      addNatureRow(m.name, m.max, m.pass);
    });

    container.querySelector("#schedule-builder-card").scrollIntoView({ behavior: "smooth" });
  };

  // Save Schedule Entry
  container.querySelector("#sch-save-btn").onclick = async (e) => {
    const mode = modeSelect.value;
    const selectedDivs = [];
    container.querySelectorAll(".sch-div-cb:checked").forEach(cb => selectedDivs.push(cb.value));

    if (selectedDivs.length === 0) {
      UI.toast("Select at least one division.", "error");
      return;
    }

    const selectedSubjects = [];
    container.querySelectorAll(".sch-sub-cb:checked").forEach(cb => {
      selectedSubjects.push({ id: cb.value, name: cb.dataset.name });
    });

    if (selectedSubjects.length === 0) {
      UI.toast("Select at least one subject.", "error");
      return;
    }

    const modes = [];
    container.querySelectorAll(".nature-row-item").forEach(r => {
      const name = r.querySelector(".row-nature-select").value;
      const max = parseInt(r.querySelector(".row-max-input").value || 0, 10);
      const pass = parseInt(r.querySelector(".row-pass-input").value || 0, 10);
      if (name && name !== "__add_new__" && max > 0) {
        modes.push({ name, max, pass });
      }
    });

    if (modes.length === 0) {
      UI.toast("Provide valid evaluation marks.", "error");
      return;
    }

    e.target.disabled = true;

    try {
      if (editIndex !== null) {
        // Update single entry
        const entry = schedules[editIndex];
        entry.divisions = selectedDivs;
        entry.modes = modes;
      } else {
        // Create entries (multi-target if both)
        const targetModes = mode === "both" ? ["offline", "online"] : [mode];
        const selectedClassName = classSelect.options[classSelect.selectedIndex]?.dataset.name;

        targetModes.forEach(tMode => {
          const targetClass = classes.find(c => c.name.trim().toLowerCase() === selectedClassName?.toLowerCase() && (c.mode || "offline") === tMode);
          if (!targetClass) return;

          selectedSubjects.forEach(sub => {
            const existingIdx = schedules.findIndex(s => s.classId === targetClass.id && s.subjectId === sub.id && s.mode === tMode);
            const entry = {
              classId: targetClass.id,
              className: targetClass.name,
              mode: tMode,
              divisions: selectedDivs,
              subjectId: sub.id,
              subjectName: sub.name,
              modes: modes
            };

            if (existingIdx >= 0) {
              schedules[existingIdx] = entry;
            } else {
              schedules.push(entry);
            }
          });
        });
      }

      await updateDocument("exams", exam.id, { schedules });
      UI.toast("Timetable saved successfully!");
      resetForm();
      applyFilters();
    } catch (err) {
      UI.toast(err.message, "error");
    } finally {
      e.target.disabled = false;
    }
  };

  resetForm();
  applyFilters();
}
