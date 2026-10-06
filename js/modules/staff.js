import { db, getCachedDocs, deleteDocument, updateDocument } from "../core/firebase-config.js";
import { collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { createStaffUser } from "../core/auth.js";
import { UI } from "../core/ui.js";

export const StaffModule = {
  id: "staff",
  title: "Staff & Ustadhs",
  roles: ["admin"],

  async render(container) {
    const snap = await getCachedDocs(collection(db, "users"), "users");
    const staffList = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "staff");

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2>Staff Directory</h2>
          <p style="color:var(--text-muted);font-size:13px;">Ustadh login accounts managed directly in the <code>users</code> collection.</p>
        </div>
        <button class="btn-primary" id="add-staff-btn">+ Add Staff Member</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Password</th>
              <th>Type</th>
              <th>Mobile</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staffList.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td><code>${s.username}</code></td>
                <td><input type="text" class="pass-edit-input" data-id="${s.id}" value="${s.password}" style="width:110px;padding:4px;" /></td>
                <td><span class="badge ${s.isTeaching ? 'badge-active' : 'badge-inactive'}">${s.isTeaching ? 'Teaching' : 'Non-Teaching'}</span></td>
                <td>${s.phone || '-'}</td>
                <td>
                  <button class="btn-secondary btn-sm save-pass-btn" data-id="${s.id}">Save Password</button>
                  <button class="btn-danger btn-sm del-staff-btn" data-id="${s.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    // Save edited password
    container.querySelectorAll(".save-pass-btn").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const newPass = container.querySelector(`.pass-edit-input[data-id="${id}"]`).value.trim();
        if (!newPass) return UI.toast("Password cannot be blank", "error");

        await updateDocument("users", id, { password: newPass });
        UI.toast("Password updated successfully!");
      };
    });

    container.querySelector("#add-staff-btn").onclick = () => {
      UI.showModal("Add Staff Member", `
        <label>Full Name</label><input type="text" id="st-name" placeholder="Ustadh Ahmad" required />
        <label style="margin-top:8px;display:block;">Username (Login ID)</label><input type="text" id="st-user" placeholder="ahmad" required />
        <label style="margin-top:8px;display:block;">Password</label><input type="text" id="st-pass" placeholder="staff123" required />
        <label style="margin-top:8px;display:block;">Category</label>
        <select id="st-teaching">
          <option value="true">Teaching Staff</option>
          <option value="false">Non-Teaching Staff</option>
        </select>
        <label style="margin-top:8px;display:block;">Mobile Number</label><input type="tel" id="st-phone" placeholder="9876543210" />
      `, async () => {
        const name = document.getElementById("st-name").value.trim();
        const username = document.getElementById("st-user").value.trim();
        const pass = document.getElementById("st-pass").value.trim();
        const isTeaching = document.getElementById("st-teaching").value === "true";
        const phone = document.getElementById("st-phone").value.trim();

        if (!name || !username || !pass) throw new Error("Name, username, and password required.");

        await createStaffUser(username, pass, name, isTeaching, phone);
        UI.toast("Staff profile created in users collection!");
        StaffModule.render(container);
      });
    };

    container.querySelectorAll(".del-staff-btn").forEach(b => {
      b.onclick = async () => {
        if (confirm("Delete this staff member?")) {
          await deleteDocument("users", b.dataset.id);
          StaffModule.render(container);
        }
      };
    });
  }
};