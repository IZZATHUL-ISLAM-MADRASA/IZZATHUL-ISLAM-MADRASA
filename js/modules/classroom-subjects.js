import { db } from "../core/firebase-config.js";
import { 
  collection, doc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getCachedDocs, commitTrackedBatch, deleteDocument } from "../core/firebase-config.js";
import { UI } from "../core/ui.js";

export const ClassroomSubjectsModule = {
  id: "classroom-subjects",
  title: "Classroom Subjects & Ustadhs",
  roles: ["admin"],

  async render(container) {
    const [csSnap, crmSnap, subSnap, uSnap, clSnap] = await Promise.all([
      getCachedDocs(collection(db, "classroom_subjects"), "classroom_subjects"),
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "subjects"), "subjects"),
      getCachedDocs(collection(db, "users"), "users"),
      getCachedDocs(collection(db, "classes"), "classes")
    ]);

    const links = csSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classrooms = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subjects = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const teachers = uSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "staff" && (u.isTeaching === true || u.isTeaching === "true"));

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Classroom Subject Allocations</h2>
          <p style="color:var(--text-muted);font-size:13px;">Assign subjects taught in each classroom and allocate dedicated Ustadhs.</p>
        </div>
        <button class="btn-primary" id="add-crm-sub-btn">➕ Assign Subjects to Classroom</button>
      </div>

      <div class="table-wrapper" style="margin-top:16px;">
        <table>
          <thead>
            <tr>
              <th>Classroom</th>
              <th>Mode</th>
              <th>Subject</th>
              <th>Subject Code</th>
              <th>Assigned Ustadh</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${links.length === 0 ? `<tr><td colspan="6" style="text-align:center;">No subjects allocated yet.</td></tr>` : ''}
            ${links.map(l => `
              <tr>
                <td><strong>${l.classroomName}</strong></td>
                <td><span class="badge ${l.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(l.mode || 'offline').toUpperCase()}</span></td>
                <td><strong>${l.subjectName}</strong></td>
                <td><code>${l.subjectCode || '-'}</code></td>
                <td>${l.teacherName || '<em>Unassigned</em>'}</td>
                <td style="text-align:center;">
                  <button class="btn-danger btn-sm del-cs-btn" data-id="${l.id}" title="Remove Subject">🗑️</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#add-crm-sub-btn").onclick = () => {
      UI.showModal("Assign Subjects to Classroom", `
        <label>1. Learning Mode</label>
        <select id="cs-mode">
          <option value="both">Both (Offline & Online)</option>
          <option value="offline">Offline Only (Campus)</option>
          <option value="online">Online Only (Virtual)</option>
        </select>

        <label style="margin-top:8px;display:block;">2. Class</label>
        <select id="cs-class"></select>

        <div id="cs-crm-wrap" style="margin-top:8px;">
          <label>3. Classroom / Division</label>
          <select id="cs-crm"></select>
          <p id="cs-crm-hint" style="font-size:11px; color:var(--text-muted); margin:3px 0 0 0; display:none;">
            When "Both" is selected, subjects and Ustadhs are saved separately into each matching Offline and Online classroom.
          </p>
        </div>

        <label style="margin-top:12px;display:block;font-weight:600;">Select Subjects & Assign Ustadh</label>
        <div id="cs-subject-selection-box" style="margin-top:6px; max-height:260px; overflow-y:auto; border:1px solid #cbd5e1; padding:8px; border-radius:6px; background:#f8fafc;">
          ${subjects.length === 0 ? '<p style="color:red;font-size:12px;">No subjects found.</p>' : ''}
          ${subjects.map(s => `
            <div class="sub-assign-row" data-sid="${s.id}" data-name="${s.name}" data-code="${s.code}" style="display:grid; grid-template-columns: auto 2fr 3fr; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid #e2e8f0;">
              <input type="checkbox" class="sub-cb" style="width:auto;" />
              <span><strong>${s.code}</strong> -${s.name}</span>
              <select class="sub-teacher" style="font-size:12px;" disabled>
                <option value="">-- Select Ustadh --</option>
                ${teachers.map(t => `<option value="${t.id}" data-name="${t.name}">${t.name} (@${t.username})</option>`).join("")}
              </select>
            </div>
          `).join("")}
        </div>
      `, async () => {
        const mode = document.getElementById("cs-mode").value;
        const classSelect = document.getElementById("cs-class");
        const crmSelect = document.getElementById("cs-crm");

        let targetClassrooms = [];

        if (mode === "both") {
          const selectedClassName = classSelect.options[classSelect.selectedIndex]?.dataset.baseName;
          targetClassrooms = classrooms.filter(crm => (crm.className || "").trim().toLowerCase() === selectedClassName?.toLowerCase());
          
          if (targetClassrooms.length === 0) {
            throw new Error(`No classrooms found for "${selectedClassName}" across offline and online modes.`);
          }
        } else {
          const crmId = crmSelect.value;
          const singleCrm = classrooms.find(c => c.id === crmId);
          if (!singleCrm) throw new Error("Select a valid classroom.");
          targetClassrooms = [singleCrm];
        }

        const rows = document.querySelectorAll(".sub-assign-row");
        const selectedSubjects = [];

        rows.forEach(r => {
          const cb = r.querySelector(".sub-cb");
          if (cb.checked) {
            const tSel = r.querySelector(".sub-teacher");
            const teacherId = tSel.value;
            const teacherName = teacherId ? tSel.options[tSel.selectedIndex].dataset.name : "";
            selectedSubjects.push({
              subjectId: r.dataset.sid,
              subjectName: r.dataset.name,
              subjectCode: r.dataset.code,
              teacherId,
              teacherName
            });
          }
        });

        if (selectedSubjects.length === 0) throw new Error("Check at least one subject to assign.");

        const batch = writeBatch(db);
        let totalCreated = 0;

        // Save records separately for each matched classroom
        for (const crm of targetClassrooms) {
          for (const sub of selectedSubjects) {
            const id = `cs_${crm.id}_${sub.subjectId}`;
            batch.set(doc(db, "classroom_subjects", id), {
              id,
              classroomId: crm.id,
              classroomName: crm.name,
              classId: crm.classId,
              divCode: crm.divCode,
              mode: crm.mode || "offline",
              subjectId: sub.subjectId,
              subjectName: sub.subjectName,
              subjectCode: sub.subjectCode,
              teacherId: sub.teacherId,
              teacherName: sub.teacherName,
              updatedAt: new Date().toISOString()
            });
            totalCreated++;
          }
        }

        await commitTrackedBatch(batch, ["classroom_subjects"]);
        UI.toast(`Successfully saved ${totalCreated} allocation record(s) across ${targetClassrooms.length} classroom(s)!`);
        ClassroomSubjectsModule.render(container);
      });

      const modalEl = document.getElementById("generic-modal");
      const modeSel = modalEl.querySelector("#cs-mode");
      const classSel = modalEl.querySelector("#cs-class");
      const crmSel = modalEl.querySelector("#cs-crm");
      const crmWrap = modalEl.querySelector("#cs-crm-wrap");
      const crmHint = modalEl.querySelector("#cs-crm-hint");

      const updateClasses = () => {
        const mode = modeSel.value;

        if (mode === "both") {
          crmWrap.style.display = "block";
          crmSel.style.display = "none";
          crmHint.style.display = "block";

          // Group classes by base name so "Class 1 (offline)" & "Class 1 (online)" merge into a single option
          const classNames = [...new Set(classes.map(c => c.name.trim()))];
          classSel.innerHTML = classNames.length
            ? classNames.map(name => `<option value="${name}" data-base-name="${name}">${name} (All Modes)</option>`).join("")
            : `<option value="">-- No classes found --</option>`;
          classSel.disabled = classNames.length === 0;
        } else {
          crmWrap.style.display = "block";
          crmSel.style.display = "block";
          crmHint.style.display = "none";

          const relevantClasses = classes.filter(c => (c.mode || "offline") === mode);
          classSel.innerHTML = relevantClasses.length
            ? relevantClasses.map(c => `<option value="${c.id}" data-base-name="${c.name}">${c.name}</option>`).join("")
            : `<option value="">-- No classes in this mode --</option>`;
          classSel.disabled = relevantClasses.length === 0;
          updateClassrooms();
        }
      };

      const updateClassrooms = () => {
        const mode = modeSel.value;
        if (mode === "both") return;

        const classId = classSel.value;
        const matchingCrms = classrooms.filter(c => c.classId === classId && (c.mode || "offline") === mode);
        crmSel.innerHTML = matchingCrms.length
          ? matchingCrms.map(c => `<option value="${c.id}">${c.name}</option>`).join("")
          : `<option value="">-- No classrooms found --</option>`;
        crmSel.disabled = matchingCrms.length === 0;
      };

      modeSel.onchange = updateClasses;
      classSel.onchange = () => {
        if (modeSel.value !== "both") updateClassrooms();
      };
      updateClasses();

      modalEl.querySelectorAll(".sub-assign-row").forEach(r => {
        const cb = r.querySelector(".sub-cb");
        const tSel = r.querySelector(".sub-teacher");
        cb.onchange = () => {
          tSel.disabled = !cb.checked;
          if (!cb.checked) tSel.value = "";
        };
      });
    };

    container.querySelectorAll(".del-cs-btn").forEach(btn => {
      btn.onclick = async () => {
        if (confirm("Remove this subject allocation?")) {
          await deleteDocument("classroom_subjects", btn.dataset.id);
          UI.toast("Subject allocation removed.");
          ClassroomSubjectsModule.render(container);
        }
      };
    });
  }
};