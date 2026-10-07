import { db, getCachedDocs, setDocument } from "../core/firebase-config.js";
import { collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

export const ParentDashboardModule = {
  id: "parent-dashboard",
  title: "Parent & Student Portal",
  roles: ["parent"],

  async render(container, user) {
    container.innerHTML = `
      <div style="text-align:center; padding:50px 0; color:var(--muted);">
        <div style="font-size:28px;">⏳</div>
        <p>Loading children records...</p>
      </div>
    `;

    // 1. Fetch only this parent's students
    const [studentsSnap, classroomsSnap] = await Promise.all([
      getCachedDocs(query(collection(db, "students"), where("parentPhone", "==", user.phone)), "students", `parent:${user.phone}`),
      getCachedDocs(collection(db, "classrooms"), "classrooms")
    ]);

    const children = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classroomsMap = new Map(classroomsSnap.docs.map(d => [d.id, d.data()]));

    if (children.length === 0) {
      container.innerHTML = `
        <div class="stat-card" style="text-align:center; padding:32px 16px;">
          <div style="font-size:36px; margin-bottom:8px;">👨‍👩‍👧</div>
          <h3>No Student Linked</h3>
          <p style="color:var(--muted); font-size:13px; max-width:400px; margin:8px auto 0;">
            No students are currently linked to mobile number <strong>${user.phone}</strong>. Please contact Madrasa administration.
          </p>
        </div>
      `;
      return;
    }

    let activeChildIndex = 0;
    let currentSubTab = "marks"; // marks | marksheet | profile | subjects | attendance | notices
    let openGroups = {
      academics: true,
      student: false,
      classroom: false
    };

    async function renderApp() {
      const child = children[activeChildIndex];
      const classroom = classroomsMap.get(child.classroomId) || {};
      const isOnline = (child.mode || "offline") === "online";

      container.innerHTML = `
        <style>
          .parent-app-layout {
            display: grid;
            grid-template-columns: 260px 1fr;
            gap: 16px;
            align-items: start;
          }
          .parent-sidebar {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
            position: sticky;
            top: 86px;
          }
          .sidebar-group {
            margin-bottom: 2px;
          }
          .sidebar-group-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 9px 12px;
            border: none;
            border-radius: 8px;
            background: transparent;
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            cursor: pointer;
            text-align: left;
            transition: background 0.15s;
          }
          .sidebar-group-header:hover {
            background: #f8fafc;
            color: var(--primary);
          }
          .sidebar-chevron {
            font-size: 10px;
            transition: transform 0.2s ease;
          }
          .sidebar-chevron.open {
            transform: rotate(90deg);
          }
          .sidebar-sub-list {
            list-style: none;
            padding: 0 0 0 16px;
            margin: 2px 0 6px 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .sidebar-sub-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 7px 12px;
            border: 1px solid transparent;
            border-radius: 6px;
            background: transparent;
            font-size: 12.5px;
            font-weight: 500;
            color: #64748b;
            text-align: left;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .sidebar-sub-btn:hover {
            background: #f1f5f9;
            color: var(--primary);
          }
          .sidebar-sub-btn.active {
            background: var(--primary);
            color: #ffffff;
            font-weight: 600;
            box-shadow: 0 2px 5px rgba(6,72,63,0.25);
          }

          @media (max-width: 768px) {
            .parent-app-layout {
              grid-template-columns: 1fr;
            }
            .parent-sidebar {
              position: static;
              flex-direction: row;
              overflow-x: auto;
              padding: 8px;
              gap: 6px;
              -webkit-overflow-scrolling: touch;
            }
            .sidebar-group-header {
              display: none;
            }
            .sidebar-sub-list {
              flex-direction: row;
              padding: 0;
              margin: 0;
            }
            .sidebar-sub-btn {
              white-space: nowrap;
              padding: 7px 11px;
              font-size: 12px;
              width: auto;
            }
          }
        </style>

        <!-- TOP BAR: Selected Child Profile & Sibling Picker -->
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 18px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <span style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Active Student</span>
              <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
                <h3 style="margin:0; font-size:18px; color:var(--primary);">${child.name}</h3>
                <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}">${(child.mode || 'offline').toUpperCase()}</span>
              </div>
              <p style="margin:2px 0 0 0; font-size:12px; color:var(--muted);">
                Adm No: <strong>${child.admissionNo}</strong> • ${child.classroomName || 'Classroom Unassigned'}
              </p>
            </div>

            <!-- Sibling Picker Dropdown -->
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:var(--muted); margin-right:4px;">Switch Child:</label>
              <select id="parent-child-picker" style="padding:7px 12px; border-radius:8px; border:1px solid #cbd5e1; font-weight:600; font-size:13px; background:#f8fafc;">
                ${children.map((c, i) => `
                  <option value="${i}" ${i === activeChildIndex ? 'selected' : ''}>
                    🧒 [${c.admissionNo}]${c.name}
                  </option>
                `).join("")}
              </select>
            </div>
          </div>
        </div>

        <!-- APP WORKSPACE WITH SIDEBAR -->
        <div class="parent-app-layout">
          <!-- Sidebar Navigation with Collapsible Sub-Tabs -->
          <aside class="parent-sidebar">
            
            <!-- Group 1: Academics & Reports -->
            <div class="sidebar-group">
              <button type="button" class="sidebar-group-header" data-group="academics">
                <span>📊 Academics &amp; Reports</span>
                <span class="sidebar-chevron ${openGroups.academics ? 'open' : ''}">▶</span>
              </button>
              <ul class="sidebar-sub-list" id="sub-academics" style="display:${openGroups.academics ? 'flex' : 'none'};">
                <li>
                  <button type="button" class="sidebar-sub-btn ${currentSubTab === 'marks' ? 'active' : ''}" data-sub="marks">
                    <span>📈</span> Marks &amp; Breakdown
                  </button>
                </li>
                <li>
                  <button type="button" class="sidebar-sub-btn ${currentSubTab === 'marksheet' ? 'active' : ''}" data-sub="marksheet">
                    <span>📄</span> Marksheet Viewer (PDF)
                  </button>
                </li>
              </ul>
            </div>

            <!-- Group 2: Student Management -->
            <div class="sidebar-group">
              <button type="button" class="sidebar-group-header" data-group="student">
                <span>👤 Student Management</span>
                <span class="sidebar-chevron ${openGroups.student ? 'open' : ''}">▶</span>
              </button>
              <ul class="sidebar-sub-list" id="sub-student" style="display:${openGroups.student ? 'flex' : 'none'};">
                <li>
                  <button type="button" class="sidebar-sub-btn ${currentSubTab === 'profile' ? 'active' : ''}" data-sub="profile">
                    <span>✏️</span> Edit Profile
                  </button>
                </li>
                <li>
                  <button type="button" class="sidebar-sub-btn ${currentSubTab === 'subjects' ? 'active' : ''}" data-sub="subjects">
                    <span>📚</span> Syllabus &amp; Teachers
                  </button>
                </li>
              </ul>
            </div>

            <!-- Group 3: Classroom & Routine -->
            <div class="sidebar-group">
              <button type="button" class="sidebar-group-header" data-group="classroom">
                <span>🏫 Classroom &amp; Routine</span>
                <span class="sidebar-chevron ${openGroups.classroom ? 'open' : ''}">▶</span>
              </button>
              <ul class="sidebar-sub-list" id="sub-classroom" style="display:${openGroups.classroom ? 'flex' : 'none'};">
                <li>
                  <button type="button" class="sidebar-sub-btn ${currentSubTab === 'attendance' ? 'active' : ''}" data-sub="attendance">
                    <span>📋</span> Attendance Log
                  </button>
                </li>
                <li>
                  <button type="button" class="sidebar-sub-btn ${currentSubTab === 'notices' ? 'active' : ''}" data-sub="notices">
                    <span>🔔</span> Live Class &amp; Notices
                  </button>
                </li>
              </ul>
            </div>

          </aside>

          <!-- Main Content Area -->
          <main id="parent-tab-container"></main>
        </div>
      `;

      // Sibling switcher event
      container.querySelector("#parent-child-picker").onchange = (e) => {
        activeChildIndex = parseInt(e.target.value, 10);
        renderApp();
      };

      // Toggle collapsible sidebar groups
      container.querySelectorAll(".sidebar-group-header").forEach(header => {
        header.onclick = () => {
          const groupKey = header.dataset.group;
          openGroups[groupKey] = !openGroups[groupKey];
          const subList = container.querySelector(`#sub-${groupKey}`);
          const chevron = header.querySelector(".sidebar-chevron");
          if (subList) {
            subList.style.display = openGroups[groupKey] ? "flex" : "none";
          }
          if (chevron) {
            chevron.classList.toggle("open", openGroups[groupKey]);
          }
        };
      });

      // Sub-tab switcher click handlers
      container.querySelectorAll(".sidebar-sub-btn").forEach(btn => {
        btn.onclick = () => {
          currentSubTab = btn.dataset.sub;
          renderApp();
        };
      });

      const tabTarget = container.querySelector("#parent-tab-container");

      // Route to active sub-tab
      switch (currentSubTab) {
        case "marks":
          await renderMarksTab(tabTarget, child);
          break;
        case "marksheet":
          await renderMarksheetPdfTab(tabTarget, child);
          break;
        case "profile":
          renderProfileTab(tabTarget, child);
          break;
        case "subjects":
          await renderSubjectsTab(tabTarget, child);
          break;
        case "attendance":
          await renderAttendanceTab(tabTarget, child);
          break;
        case "notices":
          renderNoticesTab(tabTarget, child, classroom);
          break;
        default:
          await renderMarksTab(tabTarget, child);
      }
    }

    // SUB-TAB 1: MARKS & BREAKDOWN (With dynamic visual graphs)
    async function renderMarksTab(target, child) {
      target.innerHTML = `<p style="padding:20px; text-align:center;">Loading published marks and reports...</p>`;

      const examsSnap = await getCachedDocs(collection(db, "exams"), "exams");
      const publishedExams = examsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.isPublished);

      if (publishedExams.length === 0) {
        target.innerHTML = `
          <div class="stat-card" style="text-align:center; padding:30px;">
            <div style="font-size:32px;">📑</div>
            <h4>No Published Exam Results Yet</h4>
            <p style="color:var(--muted); font-size:13px; margin:4px 0 0 0;">Exam reports will appear once official marks are published by the administration.</p>
          </div>
        `;
        return;
      }

      let selectedExamId = publishedExams[0].id;

      async function updateExamResultsView() {
        const resultSnap = await getCachedDocs(
          query(
            collection(db, "public_results"),
            where("admissionNo", "==", child.admissionNo),
            where("examId", "==", selectedExamId)
          ),
          "public_results",
          `res_${child.admissionNo}_${selectedExamId}`
        );

        if (resultSnap.empty) {
          return `
            <div class="stat-card" style="text-align:center; padding:24px; margin-top:12px;">
              <p style="color:var(--muted); margin:0;">No result sheet found for <strong>${child.name}</strong> in this exam session.</p>
            </div>
          `;
        }

        const rec = resultSnap.docs[0].data();
        const subjects = Object.entries(rec)
          .filter(([k, v]) => k.startsWith("marks_") && v && typeof v === "object")
          .map(([_, v]) => v);

        let grandTotal = 0;
        let grandMax = 0;
        let allPassed = true;

        subjects.forEach(s => {
          const tot = s.isAbsent ? 0 : (parseFloat(s.total) || 0);
          grandTotal += tot;
          grandMax += Number(s.maxTotal) || 0;
          if (!s.isPassed) allPassed = false;
        });

        const overallPct = grandMax > 0 ? (grandTotal / grandMax) * 100 : 0;

        return `
          <!-- Summary Metrics Cards -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin: 14px 0;">
            <div class="stat-card" style="text-align:center;">
              <span style="font-size:11px; font-weight:700; color:var(--muted);">GRAND TOTAL</span>
              <div style="font-size:18px; font-weight:800; color:var(--primary); margin-top:2px;">${grandTotal} / ${grandMax}</div>
            </div>
            <div class="stat-card" style="text-align:center;">
              <span style="font-size:11px; font-weight:700; color:var(--muted);">PERCENTAGE</span>
              <div style="font-size:18px; font-weight:800; color:var(--primary); margin-top:2px;">${overallPct.toFixed(1)}%</div>
            </div>
            <div class="stat-card" style="text-align:center;">
              <span style="font-size:11px; font-weight:700; color:var(--muted);">STATUS</span>
              <div style="margin-top:4px;">
                <span class="badge ${allPassed ? 'badge-active' : 'badge-inactive'}">${allPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}</span>
              </div>
            </div>
          </div>

          <!-- Subject Breakdown with Progress Graphs -->
          <div class="stat-card">
            <h4 style="margin:0 0 12px 0;">Subject Evaluation Breakdown</h4>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${subjects.map(s => {
                const pct = s.isAbsent ? 0 : Math.min(100, (parseFloat(s.total || 0) / (Number(s.maxTotal) || 100)) * 100);
                const breakdown = Object.entries(s.modeMarks || {})
                  .map(([name, val]) => `${name}: <strong>${val}</strong>`)
                  .join(" | ");

                return `
                  <div style="border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:4px;">
                      <div>
                        <strong>${s.subjectName}</strong>
                        <span style="font-size:11px; color:var(--muted); margin-left:6px;">(${breakdown || '-'})</span>
                      </div>
                      <div style="font-weight:700;">
                        ${s.isAbsent ? '<span class="badge badge-inactive">AB</span>' : `${s.total} / ${s.maxTotal} (${pct.toFixed(0)}%)`}
                      </div>
                    </div>
                    <!-- Visual Percentage Bar Graph -->
                    <div style="background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden;">
                      <div style="background:${s.isPassed ? 'var(--dark-green)' : 'var(--danger)'}; width:${pct}%; height:100%; border-radius:4px;"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }

      async function renderExamSection() {
        target.innerHTML = `
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <label style="font-size:12px; font-weight:700; color:var(--muted); display:block; margin-bottom:4px;">Select Examination</label>
                <select id="parent-exam-select" style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; font-weight:600; font-size:13px;">
                  ${publishedExams.map(e => `
                    <option value="${e.id}" ${e.id === selectedExamId ? 'selected' : ''}>${e.name}</option>
                  `).join("")}
                </select>
              </div>

              <!-- Shortcut to View Full Marksheet -->
              <button class="btn btn-primary" id="open-full-pdf-btn" style="font-size:12px;">
                📄 Open Marksheet PDF ↗
              </button>
            </div>

            <div id="exam-results-render-target"></div>
          </div>
        `;

        const examTarget = target.querySelector("#exam-results-render-target");
        examTarget.innerHTML = await updateExamResultsView();

        target.querySelector("#open-full-pdf-btn").onclick = () => {
          window.open(`results-card.html?adm=${encodeURIComponent(child.admissionNo)}&dob=${encodeURIComponent(child.dob || '')}&examId=${encodeURIComponent(selectedExamId)}`, "_blank");
        };

        target.querySelector("#parent-exam-select").onchange = async (e) => {
          selectedExamId = e.target.value;
          await renderExamSection();
        };
      }

      await renderExamSection();
    }

    // SUB-TAB 2: MARKSHEET VIEWER (PDF Direct Embedding & Launch)
    async function renderMarksheetPdfTab(target, child) {
      target.innerHTML = `<p style="padding:20px; text-align:center;">Preparing marksheet...</p>`;

      const examsSnap = await getCachedDocs(collection(db, "exams"), "exams");
      const publishedExams = examsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.isPublished);

      if (publishedExams.length === 0) {
        target.innerHTML = `
          <div class="stat-card" style="text-align:center; padding:30px;">
            <h4>No Published Marksheets Available</h4>
            <p style="color:var(--muted); font-size:13px;">Official progress cards will appear here after examination release.</p>
          </div>
        `;
        return;
      }

      let activeExamId = publishedExams[0].id;
      const sheetUrl = () => `results-card.html?adm=${encodeURIComponent(child.admissionNo)}&dob=${encodeURIComponent(child.dob || '')}&examId=${encodeURIComponent(activeExamId)}`;

      target.innerHTML = `
        <div class="stat-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <div>
              <h3 style="margin:0 0 4px 0; color:var(--primary);">Official Marksheet Viewer</h3>
              <p style="font-size:12px; color:var(--muted); margin:0;">Rendered in print-ready A4 single-page format.</p>
            </div>
            <div style="display:flex; gap:8px;">
              <select id="marksheet-exam-select" style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;">
                ${publishedExams.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
              </select>
              <a href="${sheetUrl()}" target="_blank" class="btn btn-primary" id="open-window-btn" style="font-size:12px;">
                🖨️ Fullscreen / Print
              </a>
            </div>
          </div>

          <!-- Embedded Marksheet Preview Frame -->
          <div style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; background:#fff; height:600px;">
            <iframe id="marksheet-frame" src="${sheetUrl()}" style="width:100%; height:100%; border:none;"></iframe>
          </div>
        </div>
      `;

      target.querySelector("#marksheet-exam-select").onchange = (e) => {
        activeExamId = e.target.value;
        const newUrl = sheetUrl();
        target.querySelector("#marksheet-frame").src = newUrl;
        target.querySelector("#open-window-btn").href = newUrl;
      };
    }

    // SUB-TAB 3: EDIT PROFILE (Editable except parentPhone)
    function renderProfileTab(target, child) {
      target.innerHTML = `
        <div class="stat-card">
          <h3 style="margin:0 0 6px 0; color:var(--primary);">Student Profile Details</h3>
          <p style="font-size:12px; color:var(--muted); margin:0 0 16px 0;">
            Update personal info. Parent mobile number is locked as your official verification key.
          </p>

          <form id="child-profile-edit-form">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:11px; font-weight:700;">Admission Number (Read-only)</label>
                <input type="text" value="${child.admissionNo}" disabled style="background:#f1f5f9; cursor:not-allowed;" />
              </div>
              <div>
                <label style="font-size:11px; font-weight:700;">Full Name</label>
                <input type="text" id="prof-st-name" value="${child.name || ''}" required />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px;">
              <div>
                <label style="font-size:11px; font-weight:700;">Date of Birth</label>
                <input type="date" id="prof-st-dob" value="${child.dob || ''}" required />
              </div>
              <div>
                <label style="font-size:11px; font-weight:700;">Guardian Name</label>
                <input type="text" id="prof-st-guardian" value="${child.guardianName || ''}" required />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px;">
              <div>
                <label style="font-size:11px; font-weight:700;">Parent Mobile (Locked / Login ID)</label>
                <input type="text" value="${child.parentPhone || user.phone}" disabled style="background:#f1f5f9; cursor:not-allowed;" />
              </div>
              <div>
                <label style="font-size:11px; font-weight:700;">WhatsApp Number</label>
                <input type="tel" id="prof-st-wa" value="${child.whatsappNumber || child.parentPhone || ''}" />
              </div>
            </div>

            <div style="margin-top:10px;">
              <label style="font-size:11px; font-weight:700;">Residential Address</label>
              <input type="text" id="prof-st-address" value="${child.address || ''}" placeholder="Street, City, PIN code" />
            </div>

            <button type="submit" class="btn btn-primary" id="save-profile-btn" style="margin-top:18px; width:100%;">
              💾 Save Profile Changes
            </button>
          </form>
        </div>
      `;

      target.querySelector("#child-profile-edit-form").onsubmit = async (e) => {
        e.preventDefault();
        const btn = target.querySelector("#save-profile-btn");
        btn.disabled = true;
        btn.textContent = "Updating...";

        try {
          const updatedData = {
            name: document.getElementById("prof-st-name").value.trim(),
            dob: document.getElementById("prof-st-dob").value,
            guardianName: document.getElementById("prof-st-guardian").value.trim(),
            whatsappNumber: document.getElementById("prof-st-wa").value.trim(),
            address: document.getElementById("prof-st-address").value.trim()
          };

          await setDocument("students", child.id, updatedData, { merge: true });

          Object.assign(child, updatedData);
          UI.toast("Student profile updated successfully!");
          renderApp();
        } catch (err) {
          UI.toast("Failed to update profile: " + err.message, "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "💾 Save Profile Changes";
        }
      };
    }

    // SUB-TAB 4: SYLLABUS & TEACHERS
    async function renderSubjectsTab(target, child) {
      target.innerHTML = `<p style="padding:20px; text-align:center;">Loading subjects & teachers...</p>`;

      const csSnap = await getCachedDocs(
        query(collection(db, "classroom_subjects"), where("classroomId", "==", child.classroomId)),
        "classroom_subjects",
        `cs_${child.classroomId}`
      );

      const subjects = csSnap.docs.map(d => d.data());

      target.innerHTML = `
        <div class="stat-card">
          <h3 style="margin:0 0 4px 0; color:var(--primary);">Classroom Curriculum & Ustadhs</h3>
          <p style="font-size:12px; color:var(--muted); margin:0 0 14px 0;">All subjects taught in <strong>${child.classroomName || 'Class'}</strong></p>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Assigned Ustadh</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No subjects allocated to this classroom yet.</td></tr>' : ''}
                ${subjects.map(s => `
                  <tr>
                    <td><code>${s.subjectCode || '-'}</code></td>
                    <td><strong>${s.subjectName}</strong></td>
                    <td>${s.teacherName || '<em>Ustadh unassigned</em>'}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // SUB-TAB 5: ATTENDANCE LOG
    async function renderAttendanceTab(target, child) {
      target.innerHTML = `<p style="padding:20px; text-align:center;">Fetching student attendance records...</p>`;

      const attSnap = await getCachedDocs(
        query(collection(db, "attendance"), where("classroomId", "==", child.classroomId)),
        "attendance",
        `crm_att_${child.classroomId}`
      );

      const records = [];
      attSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.records && d.records[child.id]) {
          records.push({ date: d.date, status: d.records[child.id] });
        }
      });

      records.sort((a, b) => b.date.localeCompare(a.date));

      const presentCount = records.filter(r => r.status === "present").length;
      const absentCount = records.filter(r => r.status === "absent").length;
      const lateCount = records.filter(r => r.status === "late").length;
      const pct = records.length > 0 ? ((presentCount / records.length) * 100).toFixed(1) : "100.0";

      target.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:14px;">
          <div class="stat-card" style="text-align:center;">
            <span style="font-size:11px; font-weight:700; color:var(--muted);">PERCENTAGE</span>
            <div style="font-size:18px; font-weight:800; color:var(--primary); margin-top:2px;">${pct}%</div>
          </div>
          <div class="stat-card" style="text-align:center;">
            <span style="font-size:11px; font-weight:700; color:var(--muted);">PRESENT</span>
            <div style="font-size:18px; font-weight:800; color:#166534; margin-top:2px;">${presentCount}</div>
          </div>
          <div class="stat-card" style="text-align:center;">
            <span style="font-size:11px; font-weight:700; color:var(--muted);">ABSENT</span>
            <div style="font-size:18px; font-weight:800; color:#991b1b; margin-top:2px;">${absentCount}</div>
          </div>
          <div class="stat-card" style="text-align:center;">
            <span style="font-size:11px; font-weight:700; color:var(--muted);">LATE</span>
            <div style="font-size:18px; font-weight:800; color:#d97706; margin-top:2px;">${lateCount}</div>
          </div>
        </div>

        <div class="stat-card">
          <h4 style="margin:0 0 10px 0;">Attendance Log</h4>
          ${records.length === 0 ? '<p style="color:var(--muted); font-size:12px; margin:0;">No daily attendance records found.</p>' : ''}
          <div class="table-wrapper" style="max-height:260px; overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${records.map(r => `
                  <tr>
                    <td><strong>${r.date}</strong></td>
                    <td>
                      <span class="badge ${r.status === 'present' ? 'badge-active' : (r.status === 'absent' ? 'badge-inactive' : 'badge-offline')}">
                        ${r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // SUB-TAB 6: LIVE CLASS & NOTICES
    function renderNoticesTab(target, child, classroom) {
      const isOnline = (child.mode || "offline") === "online";
      const meetLink = classroom?.onlineLink;

      target.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${isOnline ? `
            <div class="stat-card" style="background:#eff6ff; border-color:#bfdbfe;">
              <h4 style="margin:0 0 4px 0; color:#1e40af;">💻 Virtual Classroom Link</h4>
              <p style="font-size:12px; color:#3b82f6; margin:0 0 10px 0;">
                Live class access for Google Meet / Zoom sessions.
              </p>
              ${meetLink 
                ? `<a href="${meetLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-flex;">🔗 Join Live Class Now</a>`
                : `<p style="font-size:12px; color:#dc2626; margin:0;">No live link set by administration for this classroom.</p>`}
            </div>
          ` : `
            <div class="stat-card" style="background:#f0fdf4; border-color:#bbf7d0;">
              <h4 style="margin:0 0 4px 0; color:#166534;">🏫 Campus Classroom</h4>
              <p style="font-size:12px; color:#15803d; margin:0;">
                Enrolled in offline batch at Bengaluru Campus • ${child.classroomName || 'Classroom Room'}.
              </p>
            </div>
          `}

          <div class="stat-card">
            <h4 style="margin:0 0 8px 0;">📢 Madrasa Notice Board</h4>
            <div style="border-left:3px solid var(--primary); padding-left:12px; margin-top:8px;">
              <strong>Term Examination Guidelines</strong>
              <p style="font-size:12px; color:var(--muted); margin:2px 0 0 0;">
                Please ensure student attends oral and written sessions punctually. Report cards will be accessible in the Academics tab.
              </p>
            </div>
          </div>
        </div>
      `;
    }

    renderApp();
  }
};