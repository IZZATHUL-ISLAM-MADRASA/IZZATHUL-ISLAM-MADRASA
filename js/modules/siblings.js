import { db, getCachedDocs, updateDocument } from "../core/firebase-config.js";
import { collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { cleanPhone } from "../core/utils.js";
import { UI } from "../core/ui.js";

export const SiblingsModule = {
  id: "siblings",
  title: "Link Siblings",
  roles: ["admin"],

  async render(container) {
    const snap = await getCachedDocs(collection(db, "students"), "students");
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Group students by parent phone
    const groups = {};
    students.forEach(s => {
      const p = s.parentPhone || "No Phone";
      if (!groups[p]) groups[p] = [];
      groups[p].push(s);
    });

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2>Sibling Families & Management</h2>
          <p style="color:var(--text-muted);font-size:13px;">Students grouped by shared parent mobile login.</p>
        </div>
        <button class="btn-primary" id="link-sib-btn">+ Link Sibling</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-top:16px;">
        ${Object.keys(groups).map(phone => `
          <div class="stat-card">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
              <strong>Parent: ${phone}</strong>
              <span class="badge ${groups[phone].length > 1 ? 'badge-active' : 'badge-inactive'}">${groups[phone].length} Student(s)</span>
            </div>
            <ul style="list-style:none; margin-top:8px;">
              ${groups[phone].map(child => `
                <li style="padding:4px 0; font-size:14px;">
                  • <strong>[${child.admissionNo}]</strong> ${child.name} — <span style="color:var(--text-muted);">${child.classroomName}</span>
                </li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    `;

    container.querySelector("#link-sib-btn").onclick = () => {
      UI.showModal("Link Student to Parent Phone", `
        <label>Select Student</label>
        <select id="sib-std">
          ${students.map(s => `<option value="${s.id}">[${s.admissionNo}] ${s.name} (${s.parentPhone || 'No Phone'})</option>`).join("")}
        </select>
        <label style="margin-top:8px;display:block;">Target Parent 10-Digit Mobile</label>
        <input type="tel" id="sib-phone" placeholder="9876543210" required />
      `, async () => {
        const studentId = document.getElementById("sib-std").value;
        const targetPhone = cleanPhone(document.getElementById("sib-phone").value);
        if (!targetPhone) throw new Error("Valid mobile required");

        await updateDocument("students", studentId, { parentPhone: targetPhone });
        UI.toast("Sibling linked successfully!");
        SiblingsModule.render(container);
      });
    };
  }
};