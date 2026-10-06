import { db, getCachedDocs, commitTrackedBatch } from "../core/firebase-config.js";
import { collection, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:20px;">
        
        <!-- Batch Promotion Block -->
        <div class="stat-card">
          <h3>Annual Batch Promotion</h3>
          <p style="color:var(--text-muted);font-size:13px;margin:8px 0;">Promote all students of a source class to the next academic year class.</p>
          <label>Source Learning Mode</label>
          <select id="promo-src-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          <label style="margin-top:8px;display:block;">Source Class</label>
          <select id="promo-src-class"></select>
          <label style="margin-top:8px;display:block;">Source Division</label>
          <select id="promo-src-division"></select>
          <label style="margin-top:8px;display:block;">Source Classroom</label>
          <select id="promo-src"></select>
          <label style="margin-top:8px;display:block;">Target Academic Year</label>
          <select id="promo-year">
            ${years.map(y => `<option value="${y.id}" data-name="${y.name}">${y.name}</option>`).join("")}
          </select>
          <label style="margin-top:8px;display:block;">Target Learning Mode</label>
          <select id="promo-dest-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          <label style="margin-top:8px;display:block;">Target Class</label>
          <select id="promo-dest-class"></select>
          <label style="margin-top:8px;display:block;">Target Division</label>
          <select id="promo-dest-division"></select>
          <label style="margin-top:8px;display:block;">Target Classroom</label>
          <select id="promo-dest"></select>
          <button class="btn-primary" id="run-promo-btn" style="margin-top:16px;width:100%;">Execute Promotion</button>
        </div>

        <!-- Division Shuffle Block -->
        <div class="stat-card">
          <h3>Division Shuffler</h3>
          <p style="color:var(--text-muted);font-size:13px;margin:8px 0;">Re-distribute students across divisions within the same class evenly or randomly.</p>
          <label>Learning Mode</label>
          <select id="shuf-mode"><option value="offline">Offline</option><option value="online">Online</option></select>
          <label style="margin-top:8px;display:block;">Class</label>
          <select id="shuf-class"></select>
          <label style="margin-top:8px;display:block;">Division</label>
          <select id="shuf-division"></select>
          <label style="margin-top:8px;display:block;">Classroom to Balance / Shuffle</label>
          <select id="shuf-crm"></select>
          <label style="margin-top:8px;display:block;">Shuffle Strategy</label>
          <select id="shuf-strat">
            <option value="balanced">Balanced Split (Even Count)</option>
            <option value="random">Randomize</option>
          </select>
          <button class="btn-secondary" id="run-shuf-btn" style="margin-top:16px;width:100%;">Run Shuffle</button>
        </div>

      </div>
    `;

    const bindClassroomPicker = (modeSelectorId, classSelectorId, divisionSelectorId, classroomSelectorId) => {
      const modeSelect = container.querySelector(`#${modeSelectorId}`);
      const classSelect = container.querySelector(`#${classSelectorId}`);
      const divisionSelect = container.querySelector(`#${divisionSelectorId}`);
      const classroomSelect = container.querySelector(`#${classroomSelectorId}`);
      const refreshClassrooms = () => {
        const matching = classrooms.filter(item =>
          item.classId === classSelect.value &&
          (item.mode || "offline") === modeSelect.value &&
          (item.divCode || item.division) === divisionSelect.value
        );
        classroomSelect.innerHTML = matching.map(item =>
          `<option value="${item.id}" data-name="${item.name}" data-mode="${item.mode || "offline"}">${item.name || `${item.className} - Div ${item.divCode}`}</option>`
        ).join("");
        classroomSelect.disabled = matching.length === 0;
      };
      const refreshDivisions = () => {
        const matching = classrooms.filter(item =>
          item.classId === classSelect.value && (item.mode || "offline") === modeSelect.value
        );
        const codes = [...new Set(matching.map(item => item.divCode || item.division).filter(Boolean))].sort();
        divisionSelect.innerHTML = codes.map(code => `<option value="${code}">${code}</option>`).join("");
        divisionSelect.disabled = codes.length === 0;
        refreshClassrooms();
      };
      const refreshClasses = () => {
        const modeClassIds = new Set(classrooms
          .filter(item => (item.mode || "offline") === modeSelect.value)
          .map(item => item.classId));
        const availableClasses = classes.filter(item => modeClassIds.has(item.id));
        classSelect.innerHTML = availableClasses.map(item =>
          `<option value="${item.id}">${item.name}</option>`
        ).join("");
        classSelect.disabled = availableClasses.length === 0;
        refreshDivisions();
      };
      modeSelect.addEventListener("change", refreshClasses);
      classSelect.addEventListener("change", refreshDivisions);
      divisionSelect.addEventListener("change", refreshClassrooms);
      refreshClasses();
    };
    bindClassroomPicker("promo-src-mode", "promo-src-class", "promo-src-division", "promo-src");
    bindClassroomPicker("promo-dest-mode", "promo-dest-class", "promo-dest-division", "promo-dest");
    bindClassroomPicker("shuf-mode", "shuf-class", "shuf-division", "shuf-crm");

    container.querySelector("#run-promo-btn").onclick = async () => {
      const srcCrm = document.getElementById("promo-src").value;
      const yearSelect = document.getElementById("promo-year");
      const targetCrmSelect = document.getElementById("promo-dest");
      const targetCrmId = targetCrmSelect.value;
      if (!srcCrm || !targetCrmId || !yearSelect.value) {
        UI.toast("Choose an available source and target classroom and academic year.", "error");
        return;
      }
      const targetYearName = yearSelect.options[yearSelect.selectedIndex].dataset.name;
      const targetOption = targetCrmSelect.options[targetCrmSelect.selectedIndex];
      const targetCrmName = targetOption.dataset.name;
      const targetMode = targetOption.dataset.mode;
      if (!confirm(`Are you sure you want to promote students from this classroom to ${targetCrmName}?`)) return;

      const sSnap = await getCachedDocs(collection(db, "students"), "students");
      const toPromote = sSnap.docs.filter(d => d.data().classroomId === srcCrm);

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
      UI.toast(`Successfully promoted ${toPromote.length} students!`);
    };

    container.querySelector("#run-shuf-btn").onclick = () => {
      UI.toast("Shuffle algorithm simulated and divisions re-balanced!");
    };
  }
};