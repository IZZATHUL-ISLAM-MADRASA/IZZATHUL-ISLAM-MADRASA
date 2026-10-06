import { db } from "../core/firebase-config.js";
import { collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getCachedDocs, setDocument, deleteDocument } from "../core/firebase-config.js";
import { UI } from "../core/ui.js";

export const ClassesDivisionsModule = {
  id: "classes-divisions",
  title: "Classes & Divisions",
  roles: ["admin"],

  async render(container) {
    const [cSnap, dSnap, crmSnap] = await Promise.all([
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "divisions"), "divisions"),
      getCachedDocs(collection(db, "classrooms"), "classrooms")
    ]);

    const classes = cSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const divisions = dSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    const classrooms = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2>Classes & Divisions Master</h2>
          <p style="color:var(--text-muted);font-size:13px;">Configure classes with dedicated learning modes (Offline or Online) and assign division letters.</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap:24px; margin-top:16px;">
        
        <!-- Classes Card -->
        <div class="stat-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3>Classes</h3>
            <button class="btn-primary btn-sm" id="add-class-btn">➕ Add Class</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Class Name</th>
                  <th>Mode</th>
                  <th>Alias</th>
                  <th style="text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${classes.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No classes configured.</td></tr>` : ''}
                ${classes.map(c => `
                  <tr>
                    <td>${c.order || 1}</td>
                    <td><strong>${c.name}</strong></td>
                    <td><span class="badge ${c.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(c.mode || 'offline').toUpperCase()}</span></td>
                    <td>${c.alias || '-'}</td>
                    <td style="text-align:center; white-space:nowrap;">
                      <button class="btn-secondary btn-sm edit-class-btn" data-id="${c.id}" title="Edit Class">✏️</button>
                      <button class="btn-danger btn-sm del-class-btn" data-id="${c.id}" title="Delete Class">🗑️</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Divisions Card -->
        <div class="stat-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3>Divisions</h3>
            <button class="btn-primary btn-sm" id="add-div-btn">➕ Add Division</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Division Code</th>
                  <th>Alias / Description</th>
                  <th style="text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${divisions.length === 0 ? `<tr><td colspan="3" style="text-align:center;">No divisions configured.</td></tr>` : ''}
                ${divisions.map(d => `
                  <tr>
                    <td><strong>Division ${d.code}</strong></td>
                    <td>${d.alias || '-'}</td>
                    <td style="text-align:center; white-space:nowrap;">
                      <button class="btn-secondary btn-sm edit-div-btn" data-id="${d.id}" title="Edit Division">✏️</button>
                      <button class="btn-danger btn-sm del-div-btn" data-id="${d.id}" title="Delete Division">🗑️</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    // Add Class
    container.querySelector("#add-class-btn").onclick = () => {
      openClassModal(null, classes.length + 1, container);
    };

    // Edit Class
    container.querySelectorAll(".edit-class-btn").forEach(btn => {
      btn.onclick = () => {
        const item = classes.find(c => c.id === btn.dataset.id);
        if (item) openClassModal(item, classes.length + 1, container);
      };
    });

    // Delete Class
    container.querySelectorAll(".del-class-btn").forEach(btn => {
      btn.onclick = async () => {
        const classId = btn.dataset.id;
        const linkedRooms = classrooms.filter(r => r.classId === classId);
        if (linkedRooms.length > 0) {
          UI.toast(`Cannot delete: this class is used in ${linkedRooms.length} classroom(s). Remove those classrooms first.`, "error");
          return;
        }
        if (confirm("Delete this class?")) {
          await deleteDocument("classes", classId);
          UI.toast("Class deleted.");
          ClassesDivisionsModule.render(container);
        }
      };
    });

    // Add Division
    container.querySelector("#add-div-btn").onclick = () => {
      openDivisionModal(null, container);
    };

    // Edit Division
    container.querySelectorAll(".edit-div-btn").forEach(btn => {
      btn.onclick = () => {
        const item = divisions.find(d => d.id === btn.dataset.id);
        if (item) openDivisionModal(item, container);
      };
    });

    // Delete Division
    container.querySelectorAll(".del-div-btn").forEach(btn => {
      btn.onclick = async () => {
        const divId = btn.dataset.id;
        const linkedRooms = classrooms.filter(r => r.divId === divId);
        if (linkedRooms.length > 0) {
          UI.toast(`Cannot delete: this division is allocated in ${linkedRooms.length} classroom(s).`, "error");
          return;
        }
        if (confirm("Delete this division?")) {
          await deleteDocument("divisions", divId);
          UI.toast("Division deleted.");
          ClassesDivisionsModule.render(container);
        }
      };
    });
  }
};

function openClassModal(existing, defaultOrder, container) {
  const isEdit = !!existing;
  UI.showModal(`${isEdit ? "Edit" : "Add"} Class`, `
    <label>Class Name</label>
    <input type="text" id="cl-name" placeholder="Class 5" value="${existing?.name || ''}" required />

    <label style="margin-top:8px;display:block;">Learning Mode</label>
    <select id="cl-mode" ${isEdit ? 'disabled' : ''}>
      <option value="offline" ${existing?.mode === 'offline' ? 'selected' : ''}>Offline (Campus Class)</option>
      <option value="online" ${existing?.mode === 'online' ? 'selected' : ''}>Online (Virtual Class)</option>
    </select>

    <label style="margin-top:8px;display:block;">Alias / Local Name</label>
    <input type="text" id="cl-alias" placeholder="Std 5 / Khamis" value="${existing?.alias || ''}" />

    <label style="margin-top:8px;display:block;">Numeric Display Order</label>
    <input type="number" id="cl-order" value="${existing?.order ?? defaultOrder}" min="1" />
  `, async () => {
    const name = document.getElementById("cl-name").value.trim();
    const mode = document.getElementById("cl-mode").value;
    const alias = document.getElementById("cl-alias").value.trim();
    const order = parseInt(document.getElementById("cl-order").value, 10) || 1;

    if (!name) throw new Error("Class name is required.");

    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const id = isEdit ? existing.id : `cls_${safeName}_${mode}`;

    await setDocument("classes", id, { id, name, mode, alias, order });
    UI.toast(`Class "${name}" saved!`);
    ClassesDivisionsModule.render(container);
  });
}

function openDivisionModal(existing, container) {
  const isEdit = !!existing;
  UI.showModal(`${isEdit ? "Edit" : "Add"} Division`, `
    <label>Division Code (A, B, C...)</label>
    <input type="text" id="div-code" placeholder="A" value="${existing?.code || ''}" required ${isEdit ? 'readonly' : ''} />

    <label style="margin-top:8px;display:block;">Alias / Description</label>
    <input type="text" id="div-alias" placeholder="Boys Wing / Section 1" value="${existing?.alias || ''}" />
  `, async () => {
    const code = document.getElementById("div-code").value.trim().toUpperCase();
    const alias = document.getElementById("div-alias").value.trim();

    if (!code) throw new Error("Division code is required.");

    const id = isEdit ? existing.id : `div_${code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    await setDocument("divisions", id, { id, code, alias });
    UI.toast(`Division ${code} saved!`);
    ClassesDivisionsModule.render(container);
  });
}