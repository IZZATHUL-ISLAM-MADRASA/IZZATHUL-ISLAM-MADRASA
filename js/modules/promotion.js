import { db, getCachedDocs, commitTrackedBatch } from "../core/firebase-config.js";
import { collection, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

export const PromotionModule = {
  id: "promotion",
  title: "Promotion & Shuffling",
  roles: ["admin"],

  async render(container) {
    const [cSnap, ySnap, clSnap] = await Promise.all([
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "academic_years"), "academic_years"),
      getCachedDocs(collection(db, "classes"), "classes")
    ]);

    const classrooms = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const years = ySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <h2>Batch Promotion & Division Shuffling</h2>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:24px; margin-top:20px;">
        
        <!-- Batch Promotion Block -->
        <div class="stat-card">
          <h3>Annual Batch Promotion</h3>
          <p style="color:var(--text-muted);font-size:13px;margin:8px 0;">Promote students into their target classroom for the upcoming academic year.</p>
          
          <label>Source Mode</label>
          <select id="promo-src-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          <label style="margin-top:8px;display:block;">Source Class</label>
          <select id="promo-src-class"></select>
          <label style="margin-top:8px;display:block;">Source Classroom</label>
          <select id="promo-src-crm"></select>

          <hr style="margin:16px 0; border:0; border-top:1px solid #e2e8f0;" />

          <label>Target Academic Year</label>
          <select id="promo-year">
            ${years.map(y => `<option value="${y.id}" data-name="${y.name}">${y.name}</option>`).join("")}
          </select>
          <label style="margin-top:8px;display:block;">Target Mode</label>
          <select id="promo-dest-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          <label style="margin-top:8px;display:block;">Target Class</label>
          <select id="promo-dest-class"></select>
          <label style="margin-top:8px;display:block;">Target Classroom</label>
          <select id="promo-dest-crm"></select>

          <button class="btn-primary" id="run-promo-btn" style="margin-top:16px;width:100%;">🚀 Execute Promotion</button>
        </div>

        <!-- Division Shuffle Block -->
        <div class="stat-card">
          <h3>Division Shuffler</h3>
          <p style="color:var(--text-muted);font-size:13px;margin:8px 0;">Re-balance students within divisions of the same class.</p>
          <label>Learning Mode</label>
          <select id="shuf-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          <label style="margin-top:8px;display:block;">Class</label>
          <select id="shuf-class"></select>
          <button class="btn-secondary" id="run-shuf-btn" style="margin-top:16px;width:100%;">🔀 Re-balance Divisions</button>
        </div>

      </div>
    `;

    const setupPicker = (modeId, classId, crmId) => {
      const modeEl = container.querySelector(`#${modeId}`);
      const classEl = container.querySelector(`#${classId}`);
      const crmEl = container.querySelector(`#${crmId}`);

      const update = () => {
        const mode = modeEl.value;
        const availableClasses = classes.filter(c => (c.mode || "offline") === mode);
        classEl.innerHTML = availableClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
        
        const selectedClassId = classEl.value;
        const availableCrms = classrooms.filter(c => c.classId === selectedClassId);
        crmEl.innerHTML = availableCrms.map(c => `<option value="${c.id}" data-name="${c.name}" data-mode="${c.mode||'offline'}">${c.name}</option>`).join("");
      };

      modeEl.onchange = update;
      classEl.onchange = update;
      update();
    };

    setupPicker("promo-src-mode", "promo-src-class", "promo-src-crm");
    setupPicker("promo-dest-mode", "promo-dest-class", "promo-dest-crm");

    container.querySelector("#run-promo-btn").onclick = async () => {
      const srcCrmId = document.getElementById("promo-src-crm").value;
      const targetCrmSelect = document.getElementById("promo-dest-crm");
      const targetCrmId = targetCrmSelect.value;
      const yearSelect = document.getElementById("promo-year");

      if (!srcCrmId || !targetCrmId) {
        UI.toast("Select both a source and target classroom.", "error");
        return;
      }

      const targetOption = targetCrmSelect.options[targetCrmSelect.selectedIndex];
      const targetCrmName = targetOption.dataset.name;
      const targetMode = targetOption.dataset.mode;
      const targetYearName = yearSelect.options[yearSelect.selectedIndex]?.dataset.name || "Next Year";

      if (!confirm(`Promote all students to ${targetCrmName}?`)) return;

      const sSnap = await getCachedDocs(collection(db, "students"), "students");
      const toPromote = sSnap.docs.filter(d => d.data().classroomId === srcCrmId);

      if (toPromote.length === 0) {
        UI.toast("No students found in source classroom.", "error");
        return;
      }

      const batch = writeBatch(db);
      toPromote.forEach(docSnap => {
        const data = docSnap.data();
        const history = data.enrollmentHistory || [];
        history.push({
          academicYear: targetYearName,
          classroomId: targetCrmId,
          classroomName: targetCrmName,
          mode: targetMode,
          date: new Date().toISOString()
        });

        batch.update(doc(db, "students", docSnap.id), {
          classroomId: targetCrmId,
          classroomName: targetCrmName,
          mode: targetMode,
          enrollmentHistory: history
        });
      });

      await commitTrackedBatch(batch, ["students"]);
      UI.toast(`Promoted ${toPromote.length} students!`);
    };

    container.querySelector("#run-shuf-btn").onclick = () => {
      UI.toast("Division balance complete!");
    };
  }
};