// admin-dashboard.js
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp, 
  safeUpdateDoc, 
  getDocs,
  query,
  where
} from "./firebase-config.js";

const uploads = { students: [] };

export function renderAdminDashboard() {
  const app = document.getElementById("app");
  const currentUser = {
    uid: sessionStorage.getItem("portalUserId"),
    role: sessionStorage.getItem("portalRole")
  };

  if (!currentUser.uid || !["admin", "usthad"].includes(currentUser.role)) {
    window.navigate("login");
    return;
  }

  document.title = "Admin Dashboard | Izzathul Islam Madrasa";
  app.className = "min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col";

  app.innerHTML = `
    <!-- Top Bar -->
    <header class="bg-slate-950 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">
            🕌
          </div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Izzathul Islam Madrasa</p>
            <h1 class="text-base font-black tracking-tight">Management Portal</h1>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300 uppercase">${currentUser.role || "Admin"}</span>
          <button id="admin-logout-btn" class="rounded-xl border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition">Sign out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl p-5 lg:p-8 space-y-6 flex-grow">
      
      <!-- Public Shareable Link Tile -->
      <section class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div class="space-y-1">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> Live Registration Link
            </span>
            <h2 class="text-base font-black text-slate-900">Ta'aluf Family Gathering Public Form</h2>
            <p class="text-xs text-slate-500">Share this direct link with students, parents, and WhatsApp community groups.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input id="public-reg-link" readonly class="min-w-0 flex-1 sm:w-80 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-600 outline-none" />
            <button id="btn-copy-reg-link" class="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition">Copy</button>
            <button id="btn-open-reg-link" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Open ↗</button>
          </div>
        </div>
      </section>

      <!-- Navigation Action Cards -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button id="btn-to-meetup-admin" class="text-left rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 shadow-sm border border-emerald-600/20 hover:border-emerald-600/40 hover:shadow-md transition group">
          <span class="text-3xl block mb-2">🎪</span>
          <h2 class="text-base font-black text-emerald-950 group-hover:text-emerald-800">Ta'aluf Meetup Control Center</h2>
          <p class="mt-1 text-xs text-emerald-900/70">Guest lists, bulk family allocations, live verification feed, and color group ranking.</p>
        </button>

        <button class="nav-tab text-left rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 hover:border-emerald-600 hover:shadow-md transition group active-tab" data-target="student-bulk">
          <span class="text-3xl block mb-2">📥</span>
          <h2 class="text-base font-black text-slate-900 group-hover:text-emerald-800">Student Database Importer</h2>
          <p class="mt-1 text-xs text-slate-500">Upload CSV or Excel files containing enrolled students for instant admission matching.</p>
        </button>

        <button class="nav-tab text-left rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 hover:border-emerald-600 hover:shadow-md transition group" data-target="academic">
          <span class="text-3xl block mb-2">🏛️</span>
          <h2 class="text-base font-black text-slate-900 group-hover:text-emerald-800">Academic Structure & Classes</h2>
          <p class="mt-1 text-xs text-slate-500">Configure academic years, online/offline madrasa divisions, and class teacher mappings.</p>
        </button>
      </section>

      <!-- Workspace Panel 1: Student Bulk Upload -->
      <section id="student-bulk" class="portal-panel rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 class="text-lg font-black text-slate-900">Student Enrollment Upload</h2>
            <p class="mt-0.5 text-xs text-slate-500">Required columns: <code class="font-mono bg-slate-100 px-1 py-0.5 rounded text-emerald-700">adNo</code>, <code class="font-mono bg-slate-100 px-1 py-0.5 rounded text-emerald-700">name</code>, <code class="font-mono bg-slate-100 px-1 py-0.5 rounded text-emerald-700">class</code>, <code class="font-mono bg-slate-100 px-1 py-0.5 rounded text-emerald-700">div</code>, <code class="font-mono bg-slate-100 px-1 py-0.5 rounded text-emerald-700">academicYear</code>.</p>
          </div>
          <label class="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition">
            <span>Choose Spreadsheet</span>
            <input id="student-file" class="hidden" type="file" accept=".xlsx,.xls,.csv" />
          </label>
        </div>

        <div id="student-preview" class="overflow-x-auto text-xs min-h-[50px] flex items-center justify-center text-slate-400">
          No file selected. Upload a roster to preview rows.
        </div>

        <div id="upload-actions" class="hidden pt-3 border-t border-slate-100 flex items-center justify-between">
          <span id="preview-row-count" class="text-xs font-bold text-slate-700"></span>
          <button id="student-upload" class="rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-xs text-white hover:bg-emerald-800 transition flex items-center gap-2">
            <span>Import Student Records</span>
            <span id="import-spinner" class="hidden animate-spin">⏳</span>
          </button>
        </div>
      </section>

      <!-- Workspace Panel 2: Academic Setup -->
      <section id="academic" class="portal-panel hidden rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div class="border-b border-slate-100 pb-4">
          <h2 class="text-lg font-black text-slate-900">Academic Division Setup</h2>
          <p class="mt-0.5 text-xs text-slate-500">Add or re-index institutional classes and assign staff identifiers.</p>
        </div>

        <form id="academic-form" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Academic Year</label>
            <input name="academicYear" required placeholder="e.g. 2025-26" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Learning Mode</label>
            <select name="mode" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600">
              <option value="offline">Offline Madrasa</option>
              <option value="online">Online Madrasa</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Class / Standard</label>
            <input name="className" required placeholder="e.g. Class 5" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Division / Section</label>
            <input name="division" required placeholder="e.g. A" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Usthad / Teacher ID</label>
            <input name="classTeacherId" placeholder="Staff Username" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div class="sm:col-span-2 lg:col-span-1 flex items-end">
            <button class="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-xs text-white hover:bg-slate-800 transition">Save Class</button>
          </div>
        </form>
        <p id="academic-status" class="text-xs font-semibold hidden"></p>
      </section>

    </main>
  `;

  attachDashboardEvents(currentUser);
}

function attachDashboardEvents(currentUser) {
  const regUrl = new URL("./index.html?view=register", window.location.href).href;
  const regLinkInput = document.getElementById("public-reg-link");
  regLinkInput.value = regUrl;

  document.getElementById("btn-copy-reg-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(regUrl);
    alert("Public registration link copied to clipboard!");
  });

  document.getElementById("btn-open-reg-link").addEventListener("click", () => {
    window.open(regUrl, "_blank");
  });

  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    sessionStorage.clear();
    window.navigate("login");
  });

  document.getElementById("btn-to-meetup-admin").addEventListener("click", () => {
    window.navigate("meetup-admin");
  });

  // Tab switcher
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.target;
      document.querySelectorAll(".portal-panel").forEach((panel) => panel.classList.add("hidden"));
      document.getElementById(targetId)?.classList.remove("hidden");
    });
  });

  // Bind Student File Upload Parser
  const fileInput = document.getElementById("student-file");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = window.XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (!rows.length) throw new Error("File contains no readable records.");

      // Normalize headers (supports adNo, studentId, student_id)
      uploads.students = rows.map(r => ({
        adNo: String(r.adNo || r.studentId || r["Admission No"] || r["Ad.No"] || "").trim(),
        name: String(r.name || r["Student Name"] || "").trim(),
        class: String(r.class || r.className || r["Class"] || "").trim(),
        div: String(r.div || r.division || r["Division"] || "").trim(),
        academicYear: String(r.academicYear || r["Academic Year"] || "2025-26").trim()
      })).filter(r => r.adNo && r.name);

      renderStudentPreview(file.name);
    } catch (err) {
      alert("Error parsing file: " + err.message);
      fileInput.value = "";
    }
  });

  document.getElementById("student-upload").addEventListener("click", () => executeStudentImport(currentUser));
  document.getElementById("academic-form").addEventListener("submit", (e) => saveAcademicClass(e, currentUser));
}

function renderStudentPreview(filename) {
  const container = document.getElementById("student-preview");
  const actions = document.getElementById("upload-actions");
  const countEl = document.getElementById("preview-row-count");

  if (!uploads.students.length) {
    container.innerHTML = `<p class="text-rose-600 font-semibold">No valid rows found. Ensure 'adNo' and 'name' columns exist.</p>`;
    actions.classList.add("hidden");
    return;
  }

  countEl.textContent = `${uploads.students.length} students ready to import from ${filename}`;
  actions.classList.remove("hidden");

  container.innerHTML = `
    <table class="min-w-full text-left bg-white border border-slate-200 rounded-xl overflow-hidden">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-700">
          <th class="px-3.5 py-2 font-black">Admission No</th>
          <th class="px-3.5 py-2 font-black">Student Name</th>
          <th class="px-3.5 py-2 font-black">Class & Div</th>
          <th class="px-3.5 py-2 font-black">Academic Year</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${uploads.students.slice(0, 5).map(s => `
          <tr>
            <td class="px-3.5 py-2 font-mono font-bold text-emerald-700">${escapeHtml(s.adNo)}</td>
            <td class="px-3.5 py-2 font-bold text-slate-800">${escapeHtml(s.name)}</td>
            <td class="px-3.5 py-2 text-slate-600">${escapeHtml(s.class)} -${escapeHtml(s.div)}</td>
            <td class="px-3.5 py-2 font-mono text-slate-500">${escapeHtml(s.academicYear)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${uploads.students.length > 5 ? `<p class="text-[11px] text-slate-400 mt-2 text-center">... and ${uploads.students.length - 5} more records</p>` : ""}
  `;
}

async function executeStudentImport(currentUser) {
  if (!uploads.students.length) return;
  const btn = document.getElementById("student-upload");
  const sp = document.getElementById("import-spinner");

  btn.disabled = true;
  sp.classList.remove("hidden");

  try {
    let imported = 0;
    for (const s of uploads.students) {
      // Save directly into 'students' collection indexed by adNo
      await setDoc(doc(db, "students", s.adNo), {
        adNo: s.adNo,
        name: s.name,
        class: s.class,
        div: s.div,
        academicYear: s.academicYear,
        isDeleted: false,
        importedBy: currentUser.uid,
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      imported++;
    }

    alert(`Success! Imported ${imported} student profiles.`);
    uploads.students = [];
    document.getElementById("student-preview").innerHTML = "No file selected. Upload a roster to preview rows.";
    document.getElementById("upload-actions").classList.add("hidden");
    document.getElementById("student-file").value = "";
  } catch (err) {
    alert("Import failed: " + err.message);
  } finally {
    btn.disabled = false;
    sp.classList.add("hidden");
  }
}

async function saveAcademicClass(e, currentUser) {
  e.preventDefault();
  const status = document.getElementById("academic-status");
  const formData = Object.fromEntries(new FormData(e.target));
  const classId = `${formData.academicYear}_${formData.mode}_${formData.className}_${formData.division}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  try {
    await setDoc(doc(db, "academicClasses", classId), {
      ...formData,
      isDeleted: false,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    status.textContent = "Class registered successfully.";
    status.className = "text-xs font-bold text-emerald-700 block";
    e.target.reset();
  } catch (err) {
    status.textContent = "Error: " + err.message;
    status.className = "text-xs font-bold text-rose-600 block";
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}
