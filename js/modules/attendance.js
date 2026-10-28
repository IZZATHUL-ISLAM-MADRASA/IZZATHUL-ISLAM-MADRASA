import { db, getCachedDocs, setDocument } from "../core/firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";
import { getmyclassRooms } from "../core/utils.js";
import { getSessionUser } from "../core/auth.js";

export const AttendanceModule = {
  id: "attendance",
  title: "Attendance Register",
  roles: ["admin", "staff"],

  async render(container) {
    // 1. Resolve current user identity and permissions
    const user = getSessionUser() || JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");

    // 2. Fetch classrooms and subject allocations
    const [crmSnap, csSnap] = await Promise.all([
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "classroom_subjects"), "classroom_subjects")
    ]);

    const allClassrooms = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allocations = csSnap.docs.map(d => d.data());
    const classrooms = getmyclassRooms(user, allClassrooms, allocations);

    // 4. Inject Component Styles
    if (!document.getElementById("att-simple-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "att-simple-styles";
      styleEl.textContent = `
        .att-tabs { display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
        .att-tab-btn { padding: 10px 18px; border: none; background: transparent; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; color: #64748b; font-size: 14px; }
        .att-tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }
        
        .st-clickable-name { color: #2563eb; cursor: pointer; text-decoration: underline; font-weight: 600; }
        .st-clickable-name:hover { color: #1d4ed8; }

        .att-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; color: #fff; }
        .att-present { background-color: #16a34a !important; color: #fff !important; }
        .att-absent { background-color: #dc2626 !important; color: #fff !important; }
        .att-halfday { background-color: #d97706 !important; color: #fff !important; }
        .att-late { background-color: #2563eb !important; color: #fff !important; }

        .att-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .att-modal-box { background: #fff; border-radius: 8px; padding: 24px; max-width: 600px; width: 95%; max-height: 90vh; overflow-y: auto; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center; margin-top: 10px; }
        .cal-header { font-weight: bold; padding: 6px 0; color: #475569; font-size: 13px; background: #f8fafc; border-radius: 4px; }
        .cal-cell { min-height: 48px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; border: 1px solid #f1f5f9; }
        .cal-cell.empty { background: transparent; border: none; }
        .cal-status-pill { font-size: 10px; margin-top: 2px; padding: 1px 4px; border-radius: 3px; font-weight: bold; }

        .register-sheet-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
        .register-sheet-table th, .register-sheet-table td { border: 1px solid #94a3b8; padding: 4px 2px; text-align: center; }
        .register-sheet-table th.st-col, .register-sheet-table td.st-col { text-align: left; padding-left: 6px; white-space: nowrap; }
        .reg-absent { background-color: #fee2e2; color: #b91c1c; font-weight: bold; }
        .reg-present { color: #15803d; font-weight: bold; }
        .reg-hd { background-color: #fef3c7; color: #b45309; font-weight: bold; }
        .reg-late { background-color: #dbeafe; color: #1d4ed8; font-weight: bold; }

        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 5. Build HTML Markup
    container.innerHTML = `
      <h2>Attendance Register & Reports</h2>
      <div class="att-tabs no-print">
        <button class="att-tab-btn active" data-tab="mark">✍️ Mark Attendance</button>
        <button class="att-tab-btn" data-tab="monthly-reg">📋 Monthly Register (Day-by-Day)</button>
        <button class="att-tab-btn" data-tab="class-report">📊 Range Summary</button>
      </div>

      <!-- TAB 1: MARK ATTENDANCE -->
      <div id="tab-mark" class="tab-content">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin: 16px 0; align-items:end;">
          <div>
            <label>Date</label>
            <input type="date" id="att-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div>
            <label>Learning Mode</label>
            <select id="att-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          </div>
          <div><label>Classroom</label><select id="att-crm"></select></div>
          <button class="btn-primary" id="load-att-btn">📋 Load Roster</button>
        </div>
        <div id="attendance-roster-area"></div>
      </div>

      <!-- TAB 2: MONTHLY DAY-WISE REGISTER -->
      <div id="tab-monthly-reg" class="tab-content" style="display:none;">
        <div class="no-print" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin: 16px 0; align-items:end;">
          <div>
            <label>Month</label>
            <input type="month" id="reg-month" value="${new Date().toISOString().slice(0, 7)}" />
          </div>
          <div>
            <label>Learning Mode</label>
            <select id="reg-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          </div>
          <div><label>Classroom</label><select id="reg-crm"></select></div>
          <button class="btn-primary" id="load-reg-btn">📄 View Monthly Register</button>
        </div>
        <div id="monthly-register-area"></div>
      </div>

      <!-- TAB 3: DATE RANGE SUMMARY -->
      <div id="tab-class-report" class="tab-content" style="display:none;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin: 16px 0; align-items:end;">
          <div>
            <label>From Date</label>
            <input type="date" id="rep-from-date" value="${new Date(new Date().setDate(1)).toISOString().split('T')[0]}" />
          </div>
          <div>
            <label>To Date</label>
            <input type="date" id="rep-to-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div>
            <label>Learning Mode</label>
            <select id="rep-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          </div>
          <div><label>Classroom</label><select id="rep-crm"></select></div>
          <button class="btn-primary" id="gen-rep-btn">📈 View Summary</button>
        </div>
        <div id="class-report-area"></div>
      </div>

      <div id="student-modal-container"></div>
    `;

    // 6. Tab Navigation Logic
    container.querySelectorAll(".att-tab-btn").forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll(".att-tab-btn").forEach(b => b.classList.remove("active"));
        container.querySelectorAll(".tab-content").forEach(tc => tc.style.display = "none");
        btn.classList.add("active");
        container.querySelector(`#tab-${btn.dataset.tab}`).style.display = "block";
      };
    });

    // 7. Bind Mode & Classroom Selectors
    const bindModeAndClassrooms = (modeId, crmId) => {
      const modeSel = container.querySelector(modeId);
      const crmSel = container.querySelector(crmId);

      const updateCrms = () => {
        const mode = modeSel.value;
        const filtered = classrooms.filter(c => (c.mode || "offline") === mode);

        if (filtered.length === 0) {
          crmSel.innerHTML = `<option value="">-- No Classrooms Available --</option>`;
          crmSel.disabled = true;
        } else {
          crmSel.innerHTML = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
          crmSel.disabled = false;
        }
      };

      modeSel.onchange = updateCrms;
      updateCrms();
    };

    bindModeAndClassrooms("#att-mode", "#att-crm");
    bindModeAndClassrooms("#reg-mode", "#reg-crm");
    bindModeAndClassrooms("#rep-mode", "#rep-crm");

    // 8. Student Calendar Modal (Triggered on Name Click in Reports)
    const openStudentModal = async (student, crmId, defaultMonthStr) => {
      const modalHost = container.querySelector("#student-modal-container");
      const currentMonth = defaultMonthStr || new Date().toISOString().slice(0, 7);

      const renderCal = async (monthStr) => {
        const [year, month] = monthStr.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${monthStr}-01`;
        const endDate = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

        const aSnap = await getDocs(
          query(collection(db, "attendance"), where("classroomId", "==", crmId), where("date", ">=", startDate), where("date", "<=", endDate))
        );

        const statusMap = {};
        let counts = { present: 0, absent: 0, halfday: 0, late: 0, recordedDays: 0 };

        aSnap.docs.forEach(doc => {
          const data = doc.data();
          const st = data.records?.[student.id];
          if (st) {
            statusMap[data.date] = st;
            if (counts[st] !== undefined) counts[st]++;
            counts.recordedDays++;
          }
        });

        const weighted = counts.present + counts.late + counts.halfday * 0.5;
        const pct = counts.recordedDays > 0 ? ((weighted / counts.recordedDays) * 100).toFixed(1) : "0.0";

        const firstDayIndex = new Date(year, month - 1, 1).getDay();
        const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        let cellsHtml = weekdays.map(w => `<div class="cal-header">${w}</div>`).join("");
        for (let i = 0; i < firstDayIndex; i++) cellsHtml += `<div class="cal-cell empty"></div>`;

        for (let d = 1; d <= daysInMonth; d++) {
          const dStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const st = statusMap[dStr];

          let style = "background:#fff;";
          let badge = "";
          if (st === "present") {
            style = "background:#dcfce7; border-color:#86efac; color:#14532d;";
            badge = `<span class="cal-status-pill att-present">P</span>`;
          } else if (st === "absent") {
            style = "background:#fee2e2; border-color:#fca5a5; color:#7f1d1d;";
            badge = `<span class="cal-status-pill att-absent">A</span>`;
          } else if (st === "halfday") {
            style = "background:#fef3c7; border-color:#fde68a; color:#78350f;";
            badge = `<span class="cal-status-pill att-halfday">HD</span>`;
          } else if (st === "late") {
            style = "background:#dbeafe; border-color:#bfdbfe; color:#1e3a8a;";
            badge = `<span class="cal-status-pill att-late">L</span>`;
          }

          cellsHtml += `<div class="cal-cell" style="${style}"><strong>${d}</strong>${badge}</div>`;
        }

        modalHost.innerHTML = `
          <div class="att-modal-overlay" id="modal-bg">
            <div class="att-modal-box">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <h3 style="margin:0;">${student.name}</h3>
                  <div style="font-size:13px; color:#64748b;">Adm No: ${student.admissionNo || "-"}</div>
                </div>
                <button id="close-modal-btn" style="border:none; background:transparent; font-size:20px; cursor:pointer;">&times;</button>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin:14px 0 10px 0;">
                <input type="month" id="modal-month-pick" value="${monthStr}" style="padding:4px 8px;" />
                <span class="att-tag" style="background:${pct >= 80 ? '#16a34a' : (pct >= 60 ? '#d97706' : '#dc2626')}; font-size:13px;">
                  ${pct}% Attendance
                </span>
              </div>

              <div style="font-size:12px; color:#475569; margin-bottom:10px;">
                Recorded Days: <strong>${counts.recordedDays}</strong> | 
                <span style="color:#16a34a;">Present: <strong>${counts.present}</strong></span> | 
                <span style="color:#dc2626;">Absent: <strong>${counts.absent}</strong></span> | 
                <span style="color:#d97706;">Half Day: <strong>${counts.halfday}</strong></span>
              </div>

              <div class="cal-grid">${cellsHtml}</div>
            </div>
          </div>
        `;

        modalHost.querySelector("#close-modal-btn").onclick = () => { modalHost.innerHTML = ""; };
        modalHost.querySelector("#modal-bg").onclick = (e) => {
          if (e.target.id === "modal-bg") modalHost.innerHTML = "";
        };
        modalHost.querySelector("#modal-month-pick").onchange = (e) => renderCal(e.target.value);
      };

      renderCal(currentMonth);
    };

    // 9. Load Roster and Mark Attendance
    container.querySelector("#load-att-btn").onclick = async () => {
      const date = document.getElementById("att-date").value;
      const crmId = container.querySelector("#att-crm").value;
      const rosterArea = document.getElementById("attendance-roster-area");

      if (!crmId) {
        UI.toast("Select a classroom first.", "error");
        return;
      }

      const sSnap = await getCachedDocs(
        query(collection(db, "students"), where("classroomId", "==", crmId)),
        "students",
        `classroom:${crmId}`
      );
      const students = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (students.length === 0) {
        rosterArea.innerHTML = "<p>No students enrolled in this classroom.</p>";
        return;
      }

      const attDocId = `att_${crmId}_${date}`;
      const existingSnap = await getCachedDocs(
        query(collection(db, "attendance"), where("date", "==", date), where("classroomId", "==", crmId)),
        "attendance",
        `${date}:classroom:${crmId}`
      );
      const existingData = existingSnap.empty ? {} : (existingSnap.docs[0].data().records || {});

      rosterArea.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin: 14px 0;">
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-sm" id="btn-all-present" style="background:#16a34a; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">✓ All Present</button>
            <button type="button" class="btn-sm" id="btn-all-absent" style="background:#dc2626; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">✗ All Absent</button>
          </div>
          <button class="btn-primary" id="save-att-btn">💾 Save Attendance</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Adm No</th>
                <th>Student Name</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(st => {
                const status = existingData[st.id] || "present";
                return `
                  <tr data-sid="${st.id}">
                    <td>${st.admissionNo || "-"}</td>
                    <td><strong>${st.name}</strong></td>
                    <td><span class="badge ${st.mode === 'online' ? 'badge-online' : 'badge-offline'}">${(st.mode || 'offline').toUpperCase()}</span></td>
                    <td>
                      <select class="att-status" style="width:130px; font-weight:600;">
                        <option value="present" ${status === 'present' ? 'selected' : ''} style="color:#16a34a;">Present</option>
                        <option value="absent" ${status === 'absent' ? 'selected' : ''} style="color:#dc2626;">Absent</option>
                        <option value="halfday" ${status === 'halfday' ? 'selected' : ''} style="color:#d97706;">Half Day</option>
                        <option value="late" ${status === 'late' ? 'selected' : ''} style="color:#2563eb;">Late</option>
                      </select>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      rosterArea.querySelector("#btn-all-present").onclick = () => rosterArea.querySelectorAll(".att-status").forEach(s => s.value = "present");
      rosterArea.querySelector("#btn-all-absent").onclick = () => rosterArea.querySelectorAll(".att-status").forEach(s => s.value = "absent");

      rosterArea.querySelector("#save-att-btn").onclick = async (e) => {
        e.target.disabled = true;
        const records = {};
        rosterArea.querySelectorAll("tbody tr").forEach(row => {
          records[row.dataset.sid] = row.querySelector(".att-status").value;
        });

        await setDocument("attendance", attDocId, {
          date,
          classroomId: crmId,
          records,
          updatedAt: new Date().toISOString()
        });

        UI.toast("Attendance recorded successfully!");
        e.target.disabled = false;
      };
    };

    // 10. Generate Monthly Day-Wise Register (Full Month Matrix)
    container.querySelector("#load-reg-btn").onclick = async () => {
      const monthStr = container.querySelector("#reg-month").value;
      const crmId = container.querySelector("#reg-crm").value;
      const targetArea = container.querySelector("#monthly-register-area");

      if (!crmId) {
        UI.toast("Select a classroom first", "error");
        return;
      }

      targetArea.innerHTML = "<p>Loading monthly register...</p>";

      const [year, month] = monthStr.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = `${monthStr}-01`;
      const endDate = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

      const [sSnap, aSnap] = await Promise.all([
        getCachedDocs(query(collection(db, "students"), where("classroomId", "==", crmId)), "students", `classroom:${crmId}`),
        getDocs(query(collection(db, "attendance"), where("classroomId", "==", crmId), where("date", ">=", startDate), where("date", "<=", endDate)))
      ]);

      const students = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const attendanceDocs = aSnap.docs.map(d => d.data());

      if (students.length === 0) {
        targetArea.innerHTML = "<p>No students enrolled.</p>";
        return;
      }

      const dayRecords = {};
      attendanceDocs.forEach(doc => {
        dayRecords[doc.date] = doc.records || {};
      });

      targetArea.innerHTML = `
        <div id="print-area">
          <div style="display:flex; justify-content:space-between; align-items:center; margin:16px 0;">
            <div>
              <h3 style="margin:0;">Monthly Attendance Register - ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <p style="margin:4px 0 0; color:#64748b; font-size:12px;"><strong>X</strong> = Present &nbsp;|&nbsp; <strong style="color:#b91c1c;">A</strong> = Absent &nbsp;|&nbsp; <strong>HD</strong> = Half Day &nbsp;|&nbsp; <strong>L</strong> = Late</p>
            </div>
            <button class="btn-primary no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
          </div>

          <div style="overflow-x:auto;">
            <table class="register-sheet-table">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="width:28px;">#</th>
                  <th class="st-col">Student Name</th>
                  ${Array.from({ length: daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join("")}
                  <th style="background:#dcfce7; color:#14532d;">P</th>
                  <th style="background:#fee2e2; color:#7f1d1d;">A</th>
                  <th style="background:#fef3c7; color:#78350f;">HD</th>
                  <th style="background:#e2e8f0;">%</th>
                </tr>
              </thead>
              <tbody>
                ${students.map((st, idx) => {
                  let p = 0, a = 0, hd = 0, l = 0;

                  const daysCells = Array.from({ length: daysInMonth }, (_, i) => {
                    const dayNum = i + 1;
                    const dStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const status = dayRecords[dStr]?.[st.id];

                    if (!dayRecords[dStr]) return `<td style="color:#cbd5e1;">-</td>`;
                    if (status === "present") { p++; return `<td class="reg-present">X</td>`; }
                    if (status === "absent") { a++; return `<td class="reg-absent">A</td>`; }
                    if (status === "halfday") { hd++; return `<td class="reg-hd">HD</td>`; }
                    if (status === "late") { l++; return `<td class="reg-late">L</td>`; }
                    return `<td>-</td>`;
                  }).join("");

                  const totalActiveDays = p + a + hd + l;
                  const weighted = p + l + (hd * 0.5);
                  const pct = totalActiveDays > 0 ? ((weighted / totalActiveDays) * 100).toFixed(0) : 0;

                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td class="st-col">
                        <span class="st-clickable-name" data-id="${st.id}">${st.name}</span>
                      </td>
                      ${daysCells}
                      <td style="font-weight:bold; background:#f0fdf4; color:#15803d;">${p}</td>
                      <td style="font-weight:bold; background:#fef2f2; color:#dc2626;">${a}</td>
                      <td style="font-weight:bold; background:#fffbeb; color:#b45309;">${hd}</td>
                      <td style="font-weight:bold; background:#f8fafc;">${pct}%</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;

      targetArea.querySelectorAll(".st-clickable-name").forEach(el => {
        el.onclick = () => {
          const st = students.find(s => s.id === el.dataset.id);
          openStudentModal(st, crmId, monthStr);
        };
      });
    };

    // 11. Generate Range Summary Report
    container.querySelector("#gen-rep-btn").onclick = async () => {
      const fromDate = container.querySelector("#rep-from-date").value;
      const toDate = container.querySelector("#rep-to-date").value;
      const crmId = container.querySelector("#rep-crm").value;
      const reportArea = container.querySelector("#class-report-area");

      if (!crmId) {
        UI.toast("Please select a classroom", "error");
        return;
      }
      if (fromDate > toDate) {
        UI.toast("Start Date cannot be after End Date", "error");
        return;
      }

      reportArea.innerHTML = "<p>Calculating attendance...</p>";

      const [sSnap, aSnap] = await Promise.all([
        getCachedDocs(query(collection(db, "students"), where("classroomId", "==", crmId)), "students", `classroom:${crmId}`),
        getDocs(query(collection(db, "attendance"), where("classroomId", "==", crmId), where("date", ">=", fromDate), where("date", "<=", toDate)))
      ]);

      const students = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const attendanceDocs = aSnap.docs.map(d => d.data());
      const totalDays = attendanceDocs.length;

      if (students.length === 0) {
        reportArea.innerHTML = "<p>No students found for this classroom.</p>";
        return;
      }

      const stats = {};
      students.forEach(st => {
        stats[st.id] = { present: 0, absent: 0, halfday: 0, late: 0 };
      });

      attendanceDocs.forEach(att => {
        const records = att.records || {};
        students.forEach(st => {
          const stStatus = records[st.id];
          if (stStatus && stats[st.id][stStatus] !== undefined) {
            stats[st.id][stStatus]++;
          }
        });
      });

      reportArea.innerHTML = `
        <div style="margin: 15px 0; background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <strong>Total Working / Recorded Days: ${totalDays}</strong> (From ${fromDate} to ${toDate})
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Adm No</th>
                <th>Student Name (Click for Calendar)</th>
                <th style="color:#16a34a;">Present</th>
                <th style="color:#dc2626;">Absent</th>
                <th style="color:#d97706;">Half Day</th>
                <th style="color:#2563eb;">Late</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(st => {
                const s = stats[st.id];
                const weightedDays = s.present + s.late + (s.halfday * 0.5);
                const percent = totalDays > 0 ? ((weightedDays / totalDays) * 100).toFixed(1) : "0.0";
                const badgeColor = percent >= 80 ? '#16a34a' : (percent >= 60 ? '#d97706' : '#dc2626');

                return `
                  <tr>
                    <td>${st.admissionNo || "-"}</td>
                    <td><span class="st-clickable-name" data-id="${st.id}">${st.name}</span></td>
                    <td><strong style="color:#16a34a;">${s.present}</strong></td>
                    <td><strong style="color:#dc2626;">${s.absent}</strong></td>
                    <td><strong style="color:#d97706;">${s.halfday}</strong></td>
                    <td><strong style="color:#2563eb;">${s.late}</strong></td>
                    <td><span class="att-tag" style="background-color:${badgeColor}; font-size:13px;">${percent}%</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      reportArea.querySelectorAll(".st-clickable-name").forEach(el => {
        el.onclick = () => {
          const st = students.find(s => s.id === el.dataset.id);
          openStudentModal(st, crmId, fromDate.slice(0, 7));
        };
      });
    };
  }
};