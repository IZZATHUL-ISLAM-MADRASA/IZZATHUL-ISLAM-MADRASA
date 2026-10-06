import { db, getCachedDocs, setDocument, commitTrackedBatch } from "../core/firebase-config.js";
import { collection, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

export const AcademicYearsModule = {
  id: "academic-years",
  title: "Academic Years",
  roles: ["admin"],

  async render(container) {
    const snap = await getCachedDocs(collection(db, "academic_years"), "academic_years");
    const years = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.name.localeCompare(a.name));

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2>Academic Year Management</h2>
          <p style="color:var(--text-muted);font-size:13px;">Manage current and previous operational academic terms.</p>
        </div>
        <button class="btn-primary" id="add-ay-btn">➕ Create Academic Year</button>
      </div>
      <div class="table-wrapper" style="margin-top:16px;">
        <table>
          <thead>
            <tr>
              <th>Year Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${years.map(y => `
              <tr>
                <td><strong>${y.name}</strong></td>
                <td>${y.startDate || "-"}</td>
                <td>${y.endDate || "-"}</td>
                <td>
                  <span class="badge ${y.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                    ${y.status ? y.status.toUpperCase() : 'INACTIVE'}
                  </span>
                </td>
                <td style="text-align:center; white-space:nowrap;">
                  ${y.status !== 'active' ? `<button class="btn-secondary btn-sm set-active-btn" data-id="${y.id}" title="Set as Active">⚡ Set Active</button>` : '<em>Current Active</em>'}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#add-ay-btn").onclick = () => {
      UI.showModal("Create Academic Year", `
        <label>Academic Year Name</label>
        <input type="text" id="ay-name" placeholder="2026-2027" required />
        <label style="margin-top:10px;display:block;">Start Date</label>
        <input type="date" id="ay-start" />
        <label style="margin-top:10px;display:block;">End Date</label>
        <input type="date" id="ay-end" />
      `, async () => {
        const name = document.getElementById("ay-name").value.trim();
        const startDate = document.getElementById("ay-start").value;
        const endDate = document.getElementById("ay-end").value;
        if (!name) throw new Error("Year name required");
        const docId = name.replace(/[^a-zA-Z0-9]/g, "_");
        await setDocument("academic_years", docId, {
          name, startDate, endDate, status: years.length === 0 ? "active" : "inactive"
        });
        UI.toast("Academic year created!");
        AcademicYearsModule.render(container);
      });
    };

    container.querySelectorAll(".set-active-btn").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const batch = writeBatch(db);
        years.forEach(y => {
          batch.update(doc(db, "academic_years", y.id), { status: y.id === id ? "active" : "inactive" });
        });
        await commitTrackedBatch(batch, ["academic_years"]);
        UI.toast("Active Academic Year updated!");
        AcademicYearsModule.render(container);
      };
    });
  }
};