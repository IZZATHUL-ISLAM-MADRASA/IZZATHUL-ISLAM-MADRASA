import { db } from "../core/firebase-config.js";
import { collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getCachedDocs, setDocument, deleteDocument } from "../core/firebase-config.js";
import { UI } from "../core/ui.js";

export const ClassroomsModule = {
  id: "classrooms",
  title: "Classrooms & Class Teachers",
  roles: ["admin"],

  async render(container) {
    const [crSnap, cSnap, dSnap, uSnap] = await Promise.all([
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "divisions"), "divisions"),
      getCachedDocs(collection(db, "users"), "users")
    ]);

    const classrooms = crSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = cSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    const divisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.code || "").localeCompare(b.code || ""));
    const teachers = uSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "staff" && (u.isTeaching === true || u.isTeaching === "true"));

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Classrooms & Teacher Master</h2>
          <p style="color:var(--text-muted);font-size:13px;">Classrooms bind one Class (inheriting its Mode) with a Division and Assigned Teachers.</p>
        </div>
        <button class="btn-primary" id="add-crm-btn">➕ Create Classroom</button>
      </div>

      <div class="table-wrapper" style="margin-top:16px;">
        <table>
          <thead>
            <tr>
              <th>Classroom</th>
              <th>Mode</th>
              <th>Assigned Ustadhs</th>
              <th>Room / Meeting Link</th>
              <th style="text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${classrooms.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No classrooms created yet.</td></tr>` : ''}
            ${classrooms.map(c => {
              const teacherNames = (c.classTeachers || []).map(t => t.name).join(", ") || (c.classTeacherName || '<em>Unassigned</em>');
              return `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td><span class="badge ${c.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(c.mode || 'offline').toUpperCase()}</span></td>
                  <td>${teacherNames}</td>
                  <td>${c.mode === 'online' ? (c.onlineLink ? `<a href="${c.onlineLink}" target="_blank" style="color:var(--primary);text-decoration:underline;">🔗 Open Meeting</a>` : '-') : (c.roomNo || '-')}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <button class="btn-secondary btn-sm edit-crm-btn" data-id="${c.id}" title="Edit Classroom">✏️</button>
                    <button class="btn-danger btn-sm del-crm-btn" data-id="${c.id}" title="Delete Classroom">🗑️</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#add-crm-btn").onclick = () => {
      openClassroomModal(null, classes, divisions, teachers, classrooms, container);
    };

    container.querySelectorAll(".edit-crm-btn").forEach(btn => {
      btn.onclick = () => {
        const item = classrooms.find(c => c.id === btn.dataset.id);
        openClassroomModal(item, classes, divisions, teachers, classrooms, container);
      };
    });

    container.querySelectorAll(".del-crm-btn").forEach(btn => {
      btn.onclick = async () => {
        if (confirm("Permanently delete this classroom?")) {
          await deleteDocument("classrooms", btn.dataset.id);
          UI.toast("Classroom removed.");
          ClassroomsModule.render(container);
        }
      };
    });
  }
};

function openClassroomModal(existing, classes, divisions, teachers, classrooms, container) {
  const isEdit = !!existing;
  const currentTeachers = existing?.classTeachers || (existing?.classTeacherId ? [{ id: existing.classTeacherId, name: existing.classTeacherName }] : []);

  UI.showModal(`${isEdit ? 'Edit' : 'Create'} Classroom`, `
    <label>1. Learning Mode</label>
    <select id="crm-mode" ${isEdit ? 'disabled' : ''}>
      <option value="offline" ${existing?.mode === 'offline' ? 'selected' : ''}>Offline (Campus)</option>
      <option value="online" ${existing?.mode === 'online' ? 'selected' : ''}>Online (Virtual)</option>
    </select>

    <label style="margin-top:10px;display:block;">2. Class</label>
    <select id="crm-class" ${isEdit ? 'disabled' : ''}></select>

    <label style="margin-top:10px;display:block;">3. Division</label>
    <select id="crm-div" ${isEdit ? 'disabled' : ''}></select>

    <label style="margin-top:12px;display:block;font-weight:600;">Assign Ustadhs (Class Teachers)</label>
    <div style="max-height:130px; overflow-y:auto; border:1px solid #cbd5e1; padding:8px; border-radius:6px; background:#f8fafc;" id="teachers-checkbox-list">
      ${teachers.length === 0 ? '<p style="font-size:12px;color:red;">No teaching staff found.</p>' : ''}
      ${teachers.map(t => {
        const isChecked = currentTeachers.some(ct => ct.id === t.id);
        return `
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:4px; cursor:pointer;">
            <input type="checkbox" class="t-check" value="${t.id}" data-name="${t.name}" ${isChecked ? 'checked' : ''} style="width:auto;" />
            <span>${t.name} (@${t.username})</span>
          </label>
        `;
      }).join("")}
    </div>

    <div id="room-fields" style="margin-top:10px;">
      <label>Room Number / Campus Block</label>
      <input type="text" id="crm-room" placeholder="Room 101" value="${existing?.roomNo || ''}" />
    </div>
    
    <div id="online-fields" style="margin-top:10px; display:none;">
      <label>Google Meet / Zoom URL</label>
      <input type="url" id="crm-link" placeholder="https://meet.google.com/..." value="${existing?.onlineLink || ''}" />
    </div>
  `, async () => {
    const clEl = document.getElementById("crm-class");
    const divEl = document.getElementById("crm-div");
    const mode = document.getElementById("crm-mode").value;
    const roomNo = document.getElementById("crm-room").value.trim();
    const onlineLink = document.getElementById("crm-link").value.trim();

    const selectedTeachers = [];
    document.querySelectorAll(".t-check:checked").forEach(cb => {
      selectedTeachers.push({ id: cb.value, name: cb.dataset.name });
    });

    if (!clEl.value || !divEl.value) {
      throw new Error("Select a valid class and division.");
    }

    const classId = isEdit ? existing.classId : clEl.value;
    const className = isEdit ? existing.className : clEl.options[clEl.selectedIndex].dataset.name;
    const divId = isEdit ? existing.divId : divEl.value;
    const divCode = isEdit ? existing.divCode : divEl.options[divEl.selectedIndex].dataset.code;

    const duplicate = classrooms.some(item =>
      item.id !== existing?.id &&
      item.classId === classId &&
      item.divId === divId
    );
    if (duplicate) throw new Error("A classroom already exists for this class and division.");

    const id = isEdit ? existing.id : `crm_${classId}_${divId}`;
    const name = `${className} - Div ${divCode}`;

    await setDocument("classrooms", id, {
      id,
      classId,
      className,
      classOrder: classes.find(item => item.id === classId)?.order || 0,
      divId,
      divCode,
      name,
      mode,
      roomNo: mode === "offline" ? roomNo : "",
      onlineLink: mode === "online" ? onlineLink : "",
      classTeachers: selectedTeachers,
      updatedAt: new Date().toISOString()
    });

    UI.toast("Classroom saved successfully!");
    ClassroomsModule.render(container);
  });

  const modalEl = document.getElementById("generic-modal");
  const modeSelect = modalEl.querySelector("#crm-mode");
  const classSelect = modalEl.querySelector("#crm-class");
  const divisionSelect = modalEl.querySelector("#crm-div");

  // 1. Only runs when Class changes: updates divisions without wiping out class selection
  const syncDivisions = () => {
    const selectedClassId = classSelect.value;
    const availableDivs = divisions.filter(d => {
      const alreadyTaken = classrooms.some(c => 
        c.classId === selectedClassId && 
        c.divId === d.id && 
        c.id !== existing?.id
      );
      return !alreadyTaken;
    });

    divisionSelect.innerHTML = availableDivs.length
      ? availableDivs.map(d => `<option value="${d.id}" data-code="${d.code}" ${existing?.divId === d.id ? "selected" : ""}>Division ${d.code} ${d.alias ? `(${d.alias})` : ''}</option>`).join("")
      : `<option value="">-- No divisions available --</option>`;
    divisionSelect.disabled = availableDivs.length === 0;
  };

  // 2. Only runs when Mode changes: populates classes and cascades down to syncDivisions()
  const syncClasses = () => {
    const mode = modeSelect.value;
    const availableClasses = classes.filter(c => (c.mode || "offline") === mode);
    
    classSelect.innerHTML = availableClasses.length
      ? availableClasses.map(c => `<option value="${c.id}" data-name="${c.name}" ${existing?.classId === c.id ? "selected" : ""}>${c.name}</option>`).join("")
      : `<option value="">-- No classes in this mode --</option>`;
    classSelect.disabled = availableClasses.length === 0;

    const isOnline = mode === "online";
    modalEl.querySelector("#room-fields").style.display = isOnline ? "none" : "block";
    modalEl.querySelector("#online-fields").style.display = isOnline ? "block" : "none";

    syncDivisions();
  };

  modeSelect.onchange = syncClasses;
  classSelect.onchange = syncDivisions; // Updates divisions ONLY

  syncClasses();
}