// admin-dashboard.js
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp, 
  safeUpdateDoc 
} from "./firebase-config.js";

const uploads = { students: [], meetups: [] };

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

  document.title = "Admin Dashboard | Izzathul Islam";
  app.className = "min-h-screen bg-slate-100 text-slate-900";

  app.innerHTML = `
    <header class="bg-slate-950 text-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Izzathul Islam</p>
          <h1 class="mt-1 text-2xl font-black">Admin Dashboard</h1>
        </div>
        <div class="flex items-center gap-4">
          <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">${currentUser.role || ""}</span>
          <button id="admin-logout-btn" class="text-sm font-bold text-slate-300 hover:text-white transition">Sign out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl p-5 lg:p-8 space-y-6">
      <!-- Public Shareable Link Box -->
      <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 class="text-lg font-black text-slate-800">Public Registration Link</h2>
            <p class="mt-0.5 text-xs text-slate-500">Share this link directly on WhatsApp or social media for public registrations.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input id="public-reg-link" readonly class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono w-72" />
            <button id="btn-copy-reg-link" class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">Copy link</button>
            <button id="btn-open-reg-link" class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Open</button>
          </div>
        </div>
      </section>
      
      <!-- Navigation Grid -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ">
        <!-- Public Registration Tile -->
        <button id="btn-goto-public-reg" class="text-left rounded-2xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-100 transition">
          <span class="text-2xl">📝</span>
          <h2 class="mt-3 font-black text-emerald-900">Public registration</h2>
          <p class="mt-1 text-sm text-emerald-700">Open or view the live public sign-up form.</p>
        </button>

        // <button class="nav-tab text-left rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-500 transition d-none" data-target="student-bulk">
        //   <span class="text-2xl">🎓</span>
        //   <h2 class="mt-3 font-black text-slate-800">Student registration</h2>
        //   <p class="mt-1 text-sm text-slate-500">Bulk import student records.</p>
        // </button>

        // <button class="nav-tab text-left rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-500 transition d-none" data-target="academic">
        //   <span class="text-2xl">🏫</span>
        //   <h2 class="mt-3 font-black text-slate-800">Academic setup</h2>
        //   <p class="mt-1 text-sm text-slate-500">Years, modes, classes, divisions.</p>
        // </button>

        // <button class="nav-tab text-left rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-500 transition d-none" data-target="meetup-settings">
        //   <span class="text-2xl">⚙️</span>
        //   <h2 class="mt-3 font-black text-slate-800">Meetup settings</h2>
        //   <p class="mt-1 text-sm text-slate-500">Open registration and configure groups.</p>
        // </button>

        // <button class="nav-tab text-left rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-500 transition d-none" data-target="examination">
        //   <span class="text-2xl">📋</span>
        //   <h2 class="mt-3 font-black text-slate-800">Examination</h2>
        //   <p class="mt-1 text-sm text-slate-500">Reserved for exams and marks.</p>
        // </button>

        <button id="btn-to-meetup-admin" class="text-left rounded-2xl bg-indigo-50 p-5 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100 transition ">
          <span class="text-2xl">🎪</span>
          <h2 class="mt-3 font-black text-indigo-900">Meetup admin panel</h2>
          <p class="mt-1 text-sm text-indigo-700">Registrations, verification, events, and ranking.</p>
        </button>
      </section>

      <!-- Panel 1: Student Bulk Upload -->
      <section id="student-bulk" class="portal-panel rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-xl font-black text-slate-800">Student registration bulk upload</h2>
        <p class="mt-1 text-sm text-slate-500">Upload .xlsx, .xls, or .csv. Required columns: studentId, name, academicYear, mode, className, division.</p>
        <input id="student-file" class="mt-5 block w-full rounded-xl border border-slate-300 p-3 text-sm" type="file" accept=".xlsx,.xls,.csv" />
        <div id="student-preview" class="mt-4 overflow-auto"></div>
        <button id="student-upload" class="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 transition">Import student records</button>
      </section>

      <!-- Panel 2: Academic Structure -->
      <section id="academic" class="portal-panel hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-xl font-black text-slate-800">Academic structure</h2>
        <form id="academic-form" class="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <input name="academicYear" required placeholder="Academic year, e.g. 2026-27" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <select name="mode" class="rounded-xl border border-slate-300 px-4 py-3 text-sm">
            <option value="offline">Offline madrassa</option>
            <option value="online">Online madrassa</option>
          </select>
          <input name="className" required placeholder="Class / Usth, e.g. 5" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input name="division" required placeholder="Division, e.g. A" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input name="classTeacherId" placeholder="Class teacher staff ID" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <button class="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 transition">Save class and division</button>
        </form>
        <p id="academic-status" class="mt-4 text-sm font-semibold"></p>
      </section>

      <!-- Panel 3: Examination -->
      <section id="examination" class="portal-panel hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-xl font-black text-slate-800">Examination workspace</h2>
        <p class="mt-2 text-sm text-slate-600">Reserved for subjects, exam schedules, staff assignments, and marks.</p>
      </section>

      <!-- Panel 4: Meetup Settings -->
      <section id="meetup-settings" class="portal-panel hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-xl font-black text-slate-800">Family Meetup 2026 settings</h2>
        <p class="mt-1 text-sm text-slate-500">Initializes color rotation and toggles public registration.</p>
        <button id="initialize-meetup-settings" class="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 transition">
          Initialize / Open registration
        </button>
        <p id="meetup-settings-status" class="mt-4 text-sm font-semibold"></p>
      </section>
    </main>
  `;

  attachDashboardEvents(currentUser);
}

function attachDashboardEvents(currentUser) {
  // Populate Public Registration Link
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

  document.getElementById("btn-goto-public-reg").addEventListener("click", () => {
    window.navigate("register");
  });

  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    sessionStorage.clear();
    window.navigate("login");
  });

  document.getElementById("btn-to-meetup-admin").addEventListener("click", () => {
    window.navigate("meetup-admin");
  });

  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.target;
      document.querySelectorAll(".portal-panel").forEach((panel) => panel.classList.add("hidden"));
      document.getElementById(targetId)?.classList.remove("hidden");
    });
  });

  bindSpreadsheet("student-file", "student-preview", "students", ["studentId", "name", "academicYear", "mode", "className", "division"]);

  document.getElementById("student-upload").addEventListener("click", () => saveRows("students", "studentRegistrations", currentUser));
  document.getElementById("academic-form").addEventListener("submit", (e) => saveAcademicClass(e, currentUser));
  document.getElementById("initialize-meetup-settings").addEventListener("click", () => initializeMeetupSettings(currentUser));
}

function bindSpreadsheet(inputId, previewId, key, requiredColumns) {
  const el = document.getElementById(inputId);
  if (!el) return;

  el.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    uploads[key] = rows;
    const missing = requiredColumns.filter((col) => !Object.prototype.hasOwnProperty.call(rows[0] || {}, col));
    renderPreview(previewId, rows, missing);
  });
}

function renderPreview(targetId, rows, missing) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (missing.length) {
    target.innerHTML = `<p class="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">Missing columns: ${missing.join(", ")}</p>`;
    return;
  }
  const columns = Object.keys(rows[0] || {});
  target.innerHTML = `
    <p class="mb-2 text-sm font-semibold text-emerald-700">${rows.length} rows ready</p>
    <table class="min-w-full text-left text-xs bg-slate-50 rounded-lg overflow-hidden">
      <thead>
        <tr class="border-b border-slate-200">
          ${columns.map((col) => `<th class="px-3 py-2 font-black">${col}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.slice(0, 5).map((row) => `
          <tr class="border-b border-slate-100">
            ${columns.map((col) => `<td class="px-3 py-2">${String(row[col])}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function saveRows(key, collectionName, currentUser) {
  if (!uploads[key].length || !currentUser?.uid) return alert("Choose a valid spreadsheet first.");
  try {
    for (const row of uploads[key]) {
      await setDoc(doc(collection(db, collectionName)), {
        ...row,
        importedBy: currentUser.uid,
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    alert(`${uploads[key].length} records imported successfully.`);
    uploads[key] = [];
    document.getElementById("student-preview").innerHTML = "";
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  }
}

async function saveAcademicClass(event, currentUser) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  const classId = `${values.academicYear}_${values.mode}_${values.className}_${values.division}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  
  await setDoc(doc(db, "academicClasses", classId), {
    ...values,
    studentIds: [],
    history: [],
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid
  });

  const status = document.getElementById("academic-status");
  status.textContent = "Class and division saved successfully.";
  status.className = "mt-4 text-sm font-semibold text-emerald-700";
  event.target.reset();
}

async function initializeMeetupSettings(currentUser) {
  const status = document.getElementById("meetup-settings-status");
  try {
    await safeUpdateDoc(doc(db, "meetupSettings", "current"), {
      registrationOpen: true,
      colors: ["red", "blue", "green"],
      currentColorIndex: 0,
      year: 2026
    }, currentUser.uid);

    status.textContent = "Meetup settings saved. Online registration is open.";
    status.className = "mt-4 text-sm font-semibold text-emerald-700";
  } catch (error) {
    status.textContent = `Could not save settings: ${error.message}`;
    status.className = "mt-4 text-sm font-semibold text-rose-700";
  }
}
