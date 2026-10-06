import { db, getCachedDocs, setDocument, deleteDocument } from "../core/firebase-config.js";
import { 
  collection
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

export const SettingsModule = {
  id: "settings",
  title: "Settings & Custom Fields",
  roles: ["admin"],

  async render(container) {
    const [nSnap, fSnap] = await Promise.all([
      getCachedDocs(collection(db, "assessment_natures"), "assessment_natures"),
      getCachedDocs(collection(db, "custom_reg_fields"), "custom_reg_fields")
    ]);

    const natures = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fields = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <h2>Global Settings & Configurations</h2>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:16px;">
        
        <!-- Registration Custom Fields Column -->
        <div class="stat-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3>Student Registration Fields</h3>
              <p style="font-size:12px; color:var(--text-muted);">Dynamic fields for Student Form & Excel bulk upload.</p>
            </div>
            <button class="btn-primary btn-sm" id="add-field-btn">+ Add Field</button>
          </div>

          <div class="table-wrapper">
            <table>
              <thead><tr><th>Field Label</th><th>Key</th><th>Type</th><th>Compulsory</th><th>Action</th></tr></thead>
              <tbody>
                ${fields.length === 0 ? `<tr><td colspan="5">No custom fields created.</td></tr>` : ''}
                ${fields.map(f => `
                  <tr>
                    <td><strong>${f.label}</strong></td>
                    <td><code>${f.key}</code></td>
                    <td><span class="badge badge-online">${f.type}</span></td>
                    <td>${f.compulsory ? '✅ Yes' : 'No'}</td>
                    <td><button class="btn-danger btn-sm del-field-btn" data-id="${f.id}">Delete</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Assessment Natures Column -->
        <div class="stat-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3>Assessment Natures Master</h3>
              <p style="font-size:12px; color:var(--text-muted);">Evaluation templates (Oral only, Written, etc.).</p>
            </div>
            <button class="btn-primary btn-sm" id="add-nature-btn">+ Add Nature</button>
          </div>

          <div class="table-wrapper">
            <table>
              <thead><tr><th>Nature Name</th><th>Modes</th><th>Action</th></tr></thead>
              <tbody>
                ${natures.length === 0 ? `<tr><td colspan="3">No natures created.</td></tr>` : ''}
                ${natures.map(n => `
                  <tr>
                    <td><strong>${n.name}</strong></td>
                    <td style="font-size:12px;">${(n.modes||[]).map(m => `${m.name}(${m.max}/${m.pass})`).join(", ")}</td>
                    <td><button class="btn-danger btn-sm del-nature-btn" data-id="${n.id}">Delete</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    // 1. Add Registration Custom Field Modal
    container.querySelector("#add-field-btn").onclick = () => {
      UI.showModal("Add Student Registration Field", `
        <label>Field Label</label>
        <input type="text" id="f-label" placeholder="e.g. Guardian Name, WhatsApp Number" required />

        <label style="margin-top:8px;display:block;">Field Key (Unique variable name)</label>
        <input type="text" id="f-key" placeholder="e.g. guardianName, whatsappNumber" required />

        <label style="margin-top:8px;display:block;">Condition / Field Type</label>
        <select id="f-type">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="phone">Phone / WhatsApp</option>
          <option value="select">Multiple Choice (Dropdown Select)</option>
          <option value="boolean">Yes / No Toggle</option>
        </select>

        <div id="options-block" style="display:none; margin-top:8px;">
          <label>Dropdown Options (comma-separated)</label>
          <input type="text" id="f-options" placeholder="Option 1, Option 2, Option 3" />
        </div>

        <label style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
          <input type="checkbox" id="f-compulsory" style="width:auto;" />
          Is this field Compulsory?
        </label>
      `, async () => {
        const label = document.getElementById("f-label").value.trim();
        const key = document.getElementById("f-key").value.trim().replace(/\s+/g, "");
        const type = document.getElementById("f-type").value;
        const optionsRaw = document.getElementById("f-options").value.trim();
        const compulsory = document.getElementById("f-compulsory").checked;

        if (!label || !key) throw new Error("Label and Key required");

        const options = type === "select" ? optionsRaw.split(",").map(o => o.trim()).filter(Boolean) : [];
        const id = `fld_${key.toLowerCase()}`;

        await setDocument("custom_reg_fields", id, {
          id, label, key, type, options, compulsory, createdAt: new Date().toISOString()
        });

        UI.toast("Custom registration field created!");
        SettingsModule.render(container);
      });

      setTimeout(() => {
        const typeSel = document.getElementById("f-type");
        if (typeSel) {
          typeSel.onchange = () => {
            document.getElementById("options-block").style.display = typeSel.value === "select" ? "block" : "none";
          };
        }
      }, 50);
    };

    // 2. Add Assessment Nature Modal
    container.querySelector("#add-nature-btn").onclick = () => {
      openNatureModal(container);
    };

    container.querySelectorAll(".del-field-btn").forEach(b => {
      b.onclick = async () => {
        if (confirm("Remove this registration field?")) {
          await deleteDocument("custom_reg_fields", b.dataset.id);
          SettingsModule.render(container);
        }
      };
    });

    container.querySelectorAll(".del-nature-btn").forEach(b => {
      b.onclick = async () => {
        if (confirm("Delete this assessment nature?")) {
          await deleteDocument("assessment_natures", b.dataset.id);
          SettingsModule.render(container);
        }
      };
    });
  }
};

export function openNatureModal(container, onComplete = null) {
  UI.showModal("Create Assessment Nature", `
    <label>Nature Name</label>
    <input type="text" id="nat-name" placeholder="e.g. Oral Only (Quran), Terminal Written..." required />

    <div style="margin-top:12px; border:1px solid #cbd5e1; background:#f8fafc; padding:10px; border-radius:6px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <h5 style="font-size:12px;">Evaluation Modes & Marks</h5>
        <button type="button" class="btn-secondary btn-sm" id="add-mode-line-btn">+ Add Mode</button>
      </div>
      <div id="nature-modes-box">
        <div class="m-line" style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:6px; margin-bottom:6px;">
          <input type="text" class="m-name" placeholder="Mode Name (e.g. Oral)" value="Oral" required />
          <input type="number" class="m-max" placeholder="Max" value="100" required />
          <input type="number" class="m-pass" placeholder="Pass" value="40" required />
        </div>
      </div>
    </div>
  `, async () => {
    const name = document.getElementById("nat-name").value.trim();
    if (!name) throw new Error("Nature name is required");

    const lines = document.querySelectorAll(".m-line");
    const modes = [];
    lines.forEach(l => {
      const mName = l.querySelector(".m-name").value.trim();
      const max = parseInt(l.querySelector(".m-max").value || 0, 10);
      const pass = parseInt(l.querySelector(".m-pass").value || 0, 10);
      if (mName && max > 0) modes.push({ name: mName, max, pass });
    });

    if (modes.length === 0) throw new Error("At least one evaluation mode is required.");

    const id = "nat_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const newNature = { id, name, modes, updatedAt: new Date().toISOString() };
    await setDocument("assessment_natures", id, newNature);

    UI.toast("Assessment nature saved!");
    if (onComplete) onComplete(newNature);
    else if (container) SettingsModule.render(container);
  });

  const modalEl = document.getElementById("generic-modal");
  modalEl.querySelector("#add-mode-line-btn").onclick = () => {
    const d = document.createElement("div");
    d.className = "m-line";
    d.style.cssText = "display:grid; grid-template-columns: 2fr 1fr 1fr; gap:6px; margin-bottom:6px;";
    d.innerHTML = `
      <input type="text" class="m-name" placeholder="Mode Name" value="TE" required />
      <input type="number" class="m-max" placeholder="Max" value="60" required />
      <input type="number" class="m-pass" placeholder="Pass" value="24" required />
    `;
    modalEl.querySelector("#nature-modes-box").appendChild(d);
  };
}