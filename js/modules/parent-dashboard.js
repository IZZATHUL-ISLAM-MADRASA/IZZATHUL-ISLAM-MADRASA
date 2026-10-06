import { db, getCachedDocs } from "../core/firebase-config.js";
import { collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ReportCardModule } from "./report-card.js";

export const ParentDashboardModule = {
  id: "parent-dashboard",
  title: "My Children & Siblings",
  roles: ["parent"],

  async render(container, user) {
    container.innerHTML = "<p>Loading your children's records...</p>";

    // Fetch all students matching this parent's phone number
    const [snap, classroomSnap] = await Promise.all([
      getCachedDocs(query(collection(db, "students"), where("parentPhone", "==", user.phone)), "students", `parent:${user.phone}`),
      getCachedDocs(collection(db, "classrooms"), "classrooms")
    ]);
    const children = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classrooms = new Map(classroomSnap.docs.map(d => [d.id, d.data()]));

    if (children.length === 0) {
      container.innerHTML = `
        <div class="stat-card">
          <h3>No Student Records Found</h3>
          <p style="color:var(--text-muted);margin-top:8px;">No students are currently linked to mobile number <strong>${user.phone}</strong>. Please contact Madrasa administration.</p>
        </div>
      `;
      return;
    }

    let activeIndex = 0;

    function renderView() {
      const currentChild = children[activeIndex];
      const classroom = classrooms.get(currentChild.classroomId);
      const onlineLink = classroom?.onlineLink;

      container.innerHTML = `
        <h2>Parent & Student Portal</h2>
        
        <!-- Sibling Switcher Tabs -->
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin: 16px 0; border-bottom: 2px solid var(--border); padding-bottom: 8px;">
          ${children.map((c, idx) => `
            <button class="btn-sm ${idx === activeIndex ? 'btn-primary' : 'btn-secondary'} child-tab-btn" data-idx="${idx}">
              🧒 [${c.admissionNo}]${c.name}
            </button>
          `).join("")}
        </div>

        <!-- Selected Child Details Card -->
        <div class="stat-card" style="margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h3 style="color:var(--primary);">${currentChild.name}</h3>
              <p style="color:var(--text-muted);font-size:13px;">Admission No: <strong>${currentChild.admissionNo}</strong> | Classroom: <strong>${currentChild.classroomName || 'Unassigned'}</strong></p>
            </div>
            <div>
              <span class="badge ${currentChild.mode === 'online' ? 'badge-online' : 'badge-offline'}">
                ${(currentChild.mode || 'offline').toUpperCase()} LEARNING
              </span>
            </div>
          </div>

          ${currentChild.mode === 'online' ? `
            <div style="margin-top:16px; background:#eff6ff; padding:12px; border-radius:6px; border:1px solid #bfdbfe;">
              <strong>💻 Virtual Classroom Access</strong>
              <p style="font-size:13px; color:#1e40af; margin-top:4px;">Join live Madrasa classes using your classroom link:</p>
              ${onlineLink
                ? `<a href="${onlineLink}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm" style="display:inline-block; margin-top:8px;">Open Google Meet / Zoom</a>`
                : `<p style="font-size:13px; color:#1e40af; margin-top:8px;">Please contact the madrasa for the current class link.</p>`}
            </div>
          ` : `
            <div style="margin-top:16px; background:#f0fdf4; padding:12px; border-radius:6px; border:1px solid #bbf7d0;">
              <strong>🏫 Campus Details</strong>
              <p style="font-size:13px; color:#166534; margin-top:4px;">Classroom: ${currentChild.classroomName} • Bengaluru Campus</p>
            </div>
          `}
        </div>

        <div id="child-report-area"></div>
      `;

      // Render Progress Card for the selected child
      const reportArea = container.querySelector("#child-report-area");
      ReportCardModule.renderForStudent(reportArea, currentChild);

      // Handle sibling tab switches
      container.querySelectorAll(".child-tab-btn").forEach(btn => {
        btn.onclick = () => {
          activeIndex = parseInt(btn.dataset.idx, 10);
          renderView();
        };
      });
    }

    renderView();
  }
};