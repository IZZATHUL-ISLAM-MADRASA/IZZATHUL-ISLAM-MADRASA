import { db, getCachedDocs, setDocument, deleteDocument } from "../core/firebase-config.js";
import { 
  collection, doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

function getNextSubjectCode(subjects) {
  let nextNum = 1;
  subjects.forEach(s => {
    if (s.code && s.code.startsWith("S")) {
      const num = parseInt(s.code.substring(1), 10);
      if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
    }
  });
  return `S${String(nextNum).padStart(2, "0")}`;
}

function openSubjectModal(existing, container, subjects) {
  const isEdit = !!existing;
  const code = existing ? existing.code : getNextSubjectCode(subjects);
  const modalTitle = isEdit ? "Edit Subject Master" : "Add Subject Master";

  UI.showModal(modalTitle, `
    <label>Subject Code</label>
    <input type="text" id="sub-code" value="${code}" readonly style="background:#f1f5f9; font-weight:700;" />

    <label style="margin-top:8px;display:block;">Subject Name</label>
    <input type="text" id="sub-name" value="${existing ? existing.name : ""}" placeholder="Holy Quran / Fiqh / Duroos" required />

    <label style="margin-top:8px;display:block;">Arabic Alias / Malayalam Name</label>
    <input type="text" id="sub-alias" value="${existing ? (existing.alias || "") : ""}" placeholder="القرآن الكريم / ഫിഖ്ഹ്" />
  `, async () => {
    const selectedCode = document.getElementById("sub-code").value.trim();
    const name = document.getElementById("sub-name").value.trim();
    const alias = document.getElementById("sub-alias").value.trim();
    if (!name) throw new Error("Subject name is required");

    const id = isEdit ? existing.id : `sub_${selectedCode.toLowerCase()}`;
    const payload = {
      id,
      code: selectedCode,
      name,
      alias,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDocument("subjects", id, payload);

    UI.toast(isEdit ? `Subject ${selectedCode} updated!` : `Subject ${selectedCode} - ${name} added!`);
    SubjectsModule.render(container);
  });
}

export const SubjectsModule = {
  id: "subjects",
  title: "Subjects Master",
  roles: ["admin"],

  async render(container) {
    const snap = await getCachedDocs(collection(db, "subjects"), "subjects");
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (a.code || "").localeCompare(b.code || ""));

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2>Subjects Master</h2>
          <p style="color:var(--text-muted);font-size:13px;">Subject codes auto-increment (<code>S01</code>, <code>S02</code>) for human readability.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-secondary" id="export-subjects-btn">📥 Export Excel</button>
          <button class="btn-primary" id="add-sub-btn">+ Add Master Subject</button>
        </div>
      </div>

      <div class="table-wrapper" style="margin-top:16px;">
        <table>
          <thead>
            <tr>
              <th>Sub Code</th>
              <th>Subject Name</th>
              <th>Arabic / Local Alias</th>
              <th>Created Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No subjects registered.</td></tr>` : ''}
            ${subjects.map(s => `
              <tr>
                <td><strong style="color:var(--primary);">${s.code}</strong></td>
                <td><strong>${s.name}</strong></td>
                <td>${s.alias || '-'}</td>
                <td style="font-size:12px;color:var(--text-muted);">${s.createdAt ? s.createdAt.split('T')[0] : '-'}</td>
                <td style="display:flex; gap:6px;">
                  <button class="btn-secondary btn-sm edit-sub-btn" data-id="${s.id}">Edit</button>
                  <button class="btn-danger btn-sm del-sub-btn" data-id="${s.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#add-sub-btn").onclick = () => {
      openSubjectModal(null, container, subjects);
    };

    container.querySelector("#export-subjects-btn").onclick = () => {
      const escapeCSV = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const headers = ["Subject Code", "Subject Name", "Arabic / Local Alias", "Created Date"];
      const rows = subjects.map(subject => [
        subject.code,
        subject.name,
        subject.alias || "",
        subject.createdAt ? subject.createdAt.split("T")[0] : ""
      ]);
      const csv = "\uFEFF" + [headers, ...rows]
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Subjects_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      UI.toast("Subjects Excel/CSV downloaded!");
    };

    container.querySelectorAll(".edit-sub-btn").forEach(btn => {
      btn.onclick = () => {
        const item = subjects.find(s => s.id === btn.dataset.id);
        if (item) openSubjectModal(item, container, subjects);
      };
    });

    container.querySelectorAll(".del-sub-btn").forEach(btn => {
      btn.onclick = async () => {
        if (confirm("Delete this subject?")) {
          await deleteDocument("subjects", btn.dataset.id);
          SubjectsModule.render(container);
        }
      };
    });
  }
};