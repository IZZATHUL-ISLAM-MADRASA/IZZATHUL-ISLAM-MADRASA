import { db, getCachedDocs, setDocument } from "../core/firebase-config.js";
import { collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

export const AttendanceModule = {
  id: "attendance",
  title: "Attendance Register",
  roles: ["admin", "staff"],

  async render(container) {
    const [cSnap, clSnap] = await Promise.all([
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "classes"), "classes")
    ]);
    const classrooms = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));

    container.innerHTML = `
      <h2>Daily Attendance</h2>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin: 16px 0; align-items:end;">
        <div>
          <label>Select Date</label>
          <input type="date" id="att-date" value="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div>
          <label>Learning Mode</label>
          <select id="att-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
        </div>
        <div><label>Class</label><select id="att-class"></select></div>
        <div><label>Classroom</label><select id="att-crm"></select></div>
        <button class="btn-primary" id="load-att-btn">📋 Load Roster</button>
      </div>
      <div id="attendance-roster-area"></div>
    `;

    const modeSelect = container.querySelector("#att-mode");
    const classSelect = container.querySelector("#att-class");
    const classroomSelect = container.querySelector("#att-crm");

    const refreshClasses = () => {
      const mode = modeSelect.value;
      const filtered = classes.filter(c => (c.mode || "offline") === mode);
      classSelect.innerHTML = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      refreshClassrooms();
    };

    const refreshClassrooms = () => {
      const classId = classSelect.value;
      const rooms = classrooms.filter(r => r.classId === classId);
      classroomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
      classroomSelect.disabled = rooms.length === 0;
    };

    modeSelect.onchange = refreshClasses;
    classSelect.onchange = refreshClassrooms;
    refreshClasses();

    container.querySelector("#load-att-btn").onclick = async () => {
      const date = document.getElementById("att-date").value;
      const crmId = classroomSelect.value;
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
                    <td>${st.admissionNo}</td>
                    <td><strong>${st.name}</strong></td>
                    <td><span class="badge ${st.mode==='online'?'badge-online':'badge-offline'}">${(st.mode||'offline').toUpperCase()}</span></td>
                    <td>
                      <select class="att-status" style="width:130px;">
                        <option value="present" ${status==='present'?'selected':''}>Present</option>
                        <option value="absent" ${status==='absent'?'selected':''}>Absent</option>
                        <option value="late" ${status==='late'?'selected':''}>Late</option>
                      </select>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div style="margin-top:16px; display:flex; justify-content:flex-end;">
          <button class="btn-primary" id="save-att-btn">💾 Save Attendance</button>
        </div>
      `;

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

        UI.toast("Attendance recorded!");
        e.target.disabled = false;
      };
    };
  }
};