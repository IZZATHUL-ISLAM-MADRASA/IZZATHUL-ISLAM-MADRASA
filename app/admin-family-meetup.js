// admin-family-meetup.js
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  sha256, 
  safeUpdateDoc, 
  generateSecureToken 
} from "./firebase-config.js";

const colors = ["red", "blue", "green"];
let registrations = [];
let attendees = [];
let events = [];
let scores = [];
let deskUsers = [];
let pendingUploadRows = [];

export function renderMeetupAdmin() {
  const app = document.getElementById("app");
  const currentUser = { 
    uid: sessionStorage.getItem("portalUserId"), 
    role: sessionStorage.getItem("portalRole") 
  };

  // Route protection
  if (!currentUser.uid || !["admin", "usthad"].includes(currentUser.role)) {
    window.navigate("login");
    return;
  }

  document.title = "Ta'aluf Family Meetup 2026 — Admin Control";
  app.className = "min-h-screen bg-slate-50 text-slate-900 font-sans antialiased";

  app.innerHTML = `
    <!-- Top Navigation -->
    <header class="bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center space-x-3">
          <button id="btn-back-dashboard" class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition">
            <span>←</span> Dashboard
          </button>
          <span class="text-slate-700">|</span>
          <div class="flex items-center space-x-2">
            <span class="text-lg">🎪</span>
            <h1 class="text-base font-black tracking-tight text-white">Ta'aluf Meetup 2026 Admin</h1>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300 uppercase">${currentUser.role || "Admin"}</span>
          <button id="admin-signout-btn" class="rounded-xl border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition">Sign out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">

      <!-- Stats Bar -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Registrations</p>
          <p id="stat-registrations" class="mt-2 text-3xl font-black text-slate-900">0</p>
        </div>
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Distinct Families</p>
          <p id="stat-families" class="mt-2 text-3xl font-black text-slate-900">0</p>
        </div>
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Badges Issued</p>
          <p id="stat-members" class="mt-2 text-3xl font-black text-indigo-600">0</p>
        </div>
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Checked-In Attendees</p>
          <p id="stat-checked-in" class="mt-2 text-3xl font-black text-emerald-600">0</p>
        </div>
      </section>

      <!-- BULK CSV/EXCEL IMPORT STUDIO -->
      <section class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-2">
              <span>📥</span> Guest List Importer
            </div>
            <h2 class="text-xl font-black text-slate-900">Bulk Registration via Spreadsheet</h2>
            <p class="text-xs text-slate-500 mt-1">Upload the consolidated CSV or Excel file to generate families, allocate color groups, and issue attendee badges.</p>
          </div>
          <div class="flex items-center gap-3">
            <label class="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 active:scale-95 transition">
              <span>Choose CSV / Excel File</span>
              <input type="file" id="bulk-csv-input" accept=".csv, .xlsx, .xls" class="hidden" />
            </label>
          </div>
        </div>

        <!-- File Verification & Preview Container -->
        <div id="bulk-preview-area" class="hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <p id="preview-filename" class="text-xs font-bold text-slate-800"></p>
              <p id="preview-stats" class="text-[11px] text-slate-500 mt-0.5"></p>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-cancel-import" class="rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 transition">Cancel</button>
              <button id="btn-execute-import" class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95 transition flex items-center gap-2">
                <span>Start Batch Import</span>
                <span id="import-spinner" class="hidden animate-spin">⏳</span>
              </button>
            </div>
          </div>
          <div id="preview-table" class="overflow-x-auto max-h-56 text-xs"></div>
        </div>
      </section>

      <!-- REGISTRATIONS & CHECKED-IN TABS -->
      <section class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
            <button id="tab-registration" class="rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-sm transition">
              Registration Masterlist
            </button>
            <button id="tab-checked" class="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition">
              Checked-In Live Feed
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <select id="color-filter" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-600">
              <option value="">All Color Groups</option>
              <option value="red">Red Group</option>
              <option value="blue">Blue Group</option>
              <option value="green">Green Group</option>
            </select>
            <button id="btn-refresh" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Refresh</button>
            <button id="btn-print-register" class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition">Print Register</button>
            <button id="btn-download-pdf" class="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition">Download PDF</button>
          </div>
        </div>

        <div id="view-registration-container">
          <div id="registration-table" class="overflow-x-auto"></div>
        </div>

        <div id="view-checked-container" class="hidden">
          <div class="flex justify-end mb-3">
            <button id="btn-print-checked" class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition">Print Checked-in</button>
          </div>
          <div id="checked-in-table" class="overflow-x-auto"></div>
        </div>
      </section>

      <!-- VERIFICATION DESK MANAGEMENT -->
      <section class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-black text-slate-900">Gate Entry Verification Desk</h2>
            <p class="text-xs text-slate-500 mt-1">Issue staff accounts to scan and verify guest badges at reception.</p>
          </div>
          <div class="flex items-center gap-2">
            <input id="desk-link-url" readonly class="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-600 w-64 outline-none" />
            <button id="btn-copy-desk" class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition">Copy</button>
            <button id="btn-open-desk" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Open</button>
          </div>
        </div>

        <form id="desk-user-form" class="grid gap-3 sm:grid-cols-4 pt-2">
          <input name="username" required placeholder="Desk Username" class="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600" />
          <input name="displayName" required placeholder="Staff Full Name" class="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600" />
          <input name="password" required type="password" minlength="6" placeholder="Password (min 6 chars)" class="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600" />
          <button class="rounded-xl bg-slate-950 font-bold text-xs text-white hover:bg-slate-800 transition py-2.5">Add Desk Staff</button>
        </form>
        <p id="desk-status" class="text-xs font-semibold hidden"></p>
        <div id="desk-list" class="overflow-x-auto pt-2"></div>
      </section>

      <!-- EVENTS, SCORING & RANKING -->
      <section class="grid gap-8 lg:grid-cols-3">
        <!-- Event Management & Live Scoring -->
        <div class="lg:col-span-2 rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-black text-slate-900">Events & Live Scoring</h2>
              <p class="text-xs text-slate-500 mt-0.5">Award points to individual attendees or directly to color groups.</p>
            </div>
            <button id="btn-toggle-event" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition">New Event</button>
          </div>

          <form id="event-creation-form" class="hidden grid gap-3 sm:grid-cols-5 p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <input name="name" required placeholder="Event Title" class="sm:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-xs" />
            <select name="eventType" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
              <option value="solo">Solo</option>
              <option value="group">Group</option>
            </select>
            <select name="groupColor" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
              <option value="all">All Groups</option>
              <option value="red">Red Group</option>
              <option value="blue">Blue Group</option>
              <option value="green">Green Group</option>
            </select>
            <input name="maxScore" type="number" min="1" required placeholder="Max Score" class="rounded-xl border border-slate-300 px-3 py-2 text-xs" />
            <button class="sm:col-span-5 rounded-xl bg-slate-950 font-bold text-xs text-white hover:bg-slate-800 py-2.5 transition">Save Event</button>
          </form>

          <div id="event-list" class="space-y-3 pt-2"></div>
        </div>

        <!-- Live Color Group Ranking -->
        <div class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
          <div>
            <h2 class="text-xl font-black text-slate-900">Color Ranking</h2>
            <p class="text-xs text-slate-500 mt-0.5">Live aggregated leaderboard.</p>
          </div>
          <div id="ranking-container" class="space-y-3 pt-2"></div>
        </div>
      </section>

    </main>
  `;

  attachMeetupEvents(currentUser);
  loadMeetupData();
}

function attachMeetupEvents(currentUser) {
  // Navigation
  document.getElementById("btn-back-dashboard").addEventListener("click", () => window.navigate("dashboard"));
  document.getElementById("admin-signout-btn").addEventListener("click", () => {
    sessionStorage.clear();
    window.navigate("login");
  });

  // Desk URL
  const deskUrl = new URL("./index.html?view=verification-desk", window.location.href).href;
  document.getElementById("desk-link-url").value = deskUrl;
  document.getElementById("btn-copy-desk").addEventListener("click", async () => {
    await navigator.clipboard.writeText(deskUrl);
    alert("Verification desk URL copied!");
  });
  document.getElementById("btn-open-desk").addEventListener("click", () => window.open(deskUrl, "_blank"));

  // View actions
  document.getElementById("btn-refresh").addEventListener("click", loadMeetupData);
  document.getElementById("color-filter").addEventListener("change", renderRegistrationTable);
  document.getElementById("btn-print-register").addEventListener("click", () => triggerPrint("registration"));
  document.getElementById("btn-download-pdf").addEventListener("click", downloadRegistrationPdf);
  document.getElementById("tab-registration").addEventListener("click", () => toggleTabs("registration"));
  document.getElementById("tab-checked").addEventListener("click", () => toggleTabs("checked"));
  document.getElementById("btn-print-checked").addEventListener("click", () => triggerPrint("checked"));

  // Event forms
  document.getElementById("btn-toggle-event").addEventListener("click", () => {
    document.getElementById("event-creation-form").classList.toggle("hidden");
  });
  document.getElementById("event-creation-form").addEventListener("submit", (e) => handleSaveEvent(e, currentUser));
  document.getElementById("desk-user-form").addEventListener("submit", (e) => handleCreateDeskUser(e, currentUser));

  // Bulk CSV/Excel Importer Listeners
  document.getElementById("bulk-csv-input").addEventListener("change", handleFileSelected);
  document.getElementById("btn-cancel-import").addEventListener("click", cancelPendingImport);
  document.getElementById("btn-execute-import").addEventListener("click", () => executeBulkImport(currentUser));
}

// -------------------------------------------------------------
// BULK SPREADSHEET PARSER & PREVIEW
// -------------------------------------------------------------
async function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

    if (!rawRows.length) throw new Error("The selected file contains no readable rows.");

    pendingUploadRows = rawRows.filter(r => {
      // Filter out empty rows or total summary lines
      const name = r.familyName || r["Family (Reference Name)"] || r["Family Name"];
      return Boolean(name) && String(name).toLowerCase() !== "total";
    });

    renderImportPreview(file.name);
  } catch (err) {
    alert("Could not parse file: " + err.message);
    e.target.value = "";
  }
}

function renderImportPreview(fileName) {
  const area = document.getElementById("bulk-preview-area");
  const fileNameEl = document.getElementById("preview-filename");
  const statsEl = document.getElementById("preview-stats");
  const tableEl = document.getElementById("preview-table");

  area.classList.remove("hidden");
  fileNameEl.textContent = `File: ${fileName}`;
  statsEl.textContent = `Found ${pendingUploadRows.length} family units ready for import. Default password will be set to the last 6 digits of mobile.`;

  tableEl.innerHTML = `
    <table class="min-w-full text-left bg-white border border-slate-200 rounded-xl overflow-hidden">
      <thead>
        <tr class="bg-slate-100 border-b border-slate-200 text-slate-700">
          <th class="px-3 py-2 font-black">#</th>
          <th class="px-3 py-2 font-black">Family Name</th>
          <th class="px-3 py-2 font-black">Mobile</th>
          <th class="px-3 py-2 font-black">Default Pass (6-dig)</th>
          <th class="px-3 py-2 font-black">Adults (12+)</th>
          <th class="px-3 py-2 font-black">Children (5-12)</th>
          <th class="px-3 py-2 font-black">Infants (&lt;5)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${pendingUploadRows.slice(0, 5).map((r, i) => {
          const rawMobile = String(r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "").replace(/\D/g, "");
          const mobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;
          const familyName = r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family";
          const defaultPassword = mobile.length >= 6 ? mobile.slice(-6) : "123456";
          const adults = r.membersAbove12 || r["Adults (12+ yrs) - Names"] || "";
          const children = r.members5to12 || r["Children (5-12 yrs) - Names"] || "";
          const infants = r.membersBelow5 || r["Infants (below 5 yrs) - Names"] || "";

          return `
            <tr>
              <td class="px-3 py-1.5 font-mono text-slate-500">${i + 1}</td>
              <td class="px-3 py-1.5 font-bold text-slate-800">${escapeHtml(familyName)}</td>
              <td class="px-3 py-1.5 font-mono ${mobile ? 'text-slate-600' : 'text-rose-600 font-bold'}">${mobile || "Missing Phone"}</td>
              <td class="px-3 py-1.5 font-mono text-indigo-600 font-bold">${defaultPassword}</td>
              <td class="px-3 py-1.5 truncate max-w-xs text-slate-500">${escapeHtml(adults)}</td>
              <td class="px-3 py-1.5 truncate max-w-xs text-slate-500">${escapeHtml(children)}</td>
              <td class="px-3 py-1.5 truncate max-w-xs text-slate-500">${escapeHtml(infants)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
    ${pendingUploadRows.length > 5 ? `<p class="text-[10px] text-slate-400 mt-2 text-center">... and ${pendingUploadRows.length - 5} more records</p>` : ""}
  `;
}

function cancelPendingImport() {
  pendingUploadRows = [];
  document.getElementById("bulk-preview-area").classList.add("hidden");
  document.getElementById("bulk-csv-input").value = "";
}

async function executeBulkImport(currentUser) {
  if (!pendingUploadRows.length) return;
  const btn = document.getElementById("btn-execute-import");
  const spinner = document.getElementById("import-spinner");

  btn.disabled = true;
  spinner.classList.remove("hidden");

  try {
    let imported = 0;
    for (const r of pendingUploadRows) {
      const sno = r.sno || r["S.No"] || r["S.No "] || (imported + 1);
      const regNo = String(r.registrationNo || r["Registration No"] || `REG2026-${String(sno).padStart(3, "0")}`).trim();
      
      const rawMobile = String(r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "").replace(/\D/g, "");
      const mobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;

      // Ensure each family has an identity
      if (!mobile) continue;

      const familyName = String(r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family").trim();
      const groupColor = String(r.groupColor || colors[imported % 3]).toLowerCase().trim();
      const defaultPassword = r.defaultPassword ? String(r.defaultPassword).trim() : mobile.slice(-6);

      // 1. Create or overwrite registration record
      const hashedPass = await sha256(defaultPassword);
      await setDoc(doc(db, "meetupRegistrations", regNo), {
        registrationNo: regNo,
        familyName,
        mobileNo: mobile,
        passwordHash: hashedPass,
        dobHash: "",
        groupColor,
        year: 2026,
        status: "confirmed",
        totalAttendees: Number(r.totalAttendees || r["Total Members"] || 0),
        importedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Parse and issue attendee passes
      const categoryMappings = [
        { field: r.membersAbove12 || r["Adults (12+ yrs) - Names"], cat: "above12" },
        { field: r.members5to12 || r["Children (5-12 yrs) - Names"], cat: "age5to12" },
        { field: r.membersBelow5 || r["Infants (below 5 yrs) - Names"], cat: "below5" }
      ];

      for (const { field, cat } of categoryMappings) {
        if (!field) continue;
        const names = String(field).split(/[\n;,]+/).map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          const rawToken = generateSecureToken(24);
          const attRef = doc(collection(db, "meetupAttendees"));
          await setDoc(attRef, {
            registrationId: regNo,
            memberName: name,
            category: cat,
            groupColor,
            status: "pending",
            year: 2026,
            rawToken,
            qrTokenHash: await sha256(rawToken),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
      imported++;
    }

    alert(`Bulk registration complete! Successfully imported ${imported} families.`);
    cancelPendingImport();
    await loadMeetupData();
  } catch (err) {
    alert("Bulk registration error: " + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add("hidden");
  }
}

// -------------------------------------------------------------
// DATA LOADING & RENDERING
// -------------------------------------------------------------
async function loadMeetupData() {
  try {
    const [regSnap, attSnap, evSnap, scSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, "meetupRegistrations"), where("year", "==", 2026))),
      getDocs(query(collection(db, "meetupAttendees"), where("year", "==", 2026))),
      getDocs(query(collection(db, "meetupEvents"), where("year", "==", 2026))),
      getDocs(query(collection(db, "meetupScores"), where("year", "==", 2026))),
      getDocs(collection(db, "users"))
    ]);

    registrations = regSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => !d.isDeleted);

    attendees = attSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => !d.isDeleted);

    events = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    scores = scSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    deskUsers = userSnap.docs
      .filter(d => d.data().role === "verification_desk" && !d.data().isDeleted)
      .map(d => ({ id: d.id, ...d.data() }));

    renderStats();
    renderRegistrationTable();
    renderCheckedInTable();
    renderDeskList();
    renderEvents();
    renderRanking();
  } catch (err) {
    console.error("Meetup data fetch failed:", err);
  }
}

function toggleTabs(activeTab) {
  const regContainer = document.getElementById("view-registration-container");
  const chkContainer = document.getElementById("view-checked-container");
  const tabReg = document.getElementById("tab-registration");
  const tabChk = document.getElementById("tab-checked");

  regContainer.classList.toggle("hidden", activeTab !== "registration");
  chkContainer.classList.toggle("hidden", activeTab !== "checked");

  tabReg.className = activeTab === "registration" 
    ? "rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-sm transition"
    : "rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition";

  tabChk.className = activeTab === "checked" 
    ? "rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-sm transition"
    : "rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition";
}

function renderStats() {
  document.getElementById("stat-registrations").textContent = registrations.length;
  document.getElementById("stat-families").textContent = new Set(registrations.map(r => r.familyName)).size;
  document.getElementById("stat-members").textContent = attendees.length;
  document.getElementById("stat-checked-in").textContent = attendees.filter(a => a.status === "checked_in").length;
}

function renderRegistrationTable() {
  const filter = document.getElementById("color-filter").value;
  const rows = registrations.filter(r => !filter || r.groupColor === filter);
  const rowStats = rows.map(item => ({ item, stats: calculateFamilyStats(item) }));
  const totals = rowStats.reduce((acc, r) => sumStats(acc, r.stats), initEmptyStats());

  const tableHtml = `
    <table class="min-w-full text-left text-xs bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="bg-slate-100/70 border-b border-slate-200 text-slate-700">
          ${["#", "Family Name", "Group", "Below 5", "5-12", "Above 12", "Total (C/T)", "Status", "Action"].map(h => `<th class="px-4 py-3.5 font-black whitespace-nowrap">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${rowStats.map(({ item, stats }, idx) => `
          <tr data-id="${item.id}" class="hover:bg-slate-50 transition">
            <td class="px-4 py-3 font-mono text-slate-400">${idx + 1}</td>
            <td class="px-4 py-3">
              <input data-field="familyName" value="${escapeHtml(item.familyName)}" class="w-44 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600" />
            </td>
            <td class="px-4 py-3">
              <span class="rounded-full px-3 py-1 text-[11px] font-black uppercase ${badgeColor(item.groupColor)}">${escapeHtml(item.groupColor || "")}</span>
            </td>
            <td class="px-4 py-3 font-medium text-slate-600">${stats.below5.checked} /${stats.below5.total}</td>
            <td class="px-4 py-3 font-medium text-slate-600">${stats.age5to12.checked} /${stats.age5to12.total}</td>
            <td class="px-4 py-3 font-medium text-slate-600">${stats.above12.checked} /${stats.above12.total}</td>
            <td class="px-4 py-3 font-black text-indigo-700">${stats.checked} /${stats.total}</td>
            <td class="px-4 py-3">
              <select data-field="status" class="rounded-xl border border-slate-300 px-2.5 py-1 text-xs font-semibold">
                <option value="confirmed" ${item.status === "confirmed" ? "selected" : ""}>confirmed</option>
                <option value="cancelled" ${item.status === "cancelled" ? "selected" : ""}>cancelled</option>
              </select>
            </td>
            <td class="px-4 py-3">
              <button class="btn-save-reg rounded-xl bg-slate-900 px-3.5 py-1.5 font-bold text-white hover:bg-slate-800 transition">Save</button>
            </td>
          </tr>
        `).join("")}
        <tr class="bg-slate-100/90 font-black text-slate-800">
          <td class="px-4 py-3.5" colspan="3">Grand Totals</td>
          <td class="px-4 py-3.5">${totals.below5.checked} / ${totals.below5.total}</td>
          <td class="px-4 py-3.5">${totals.age5to12.checked} / ${totals.age5to12.total}</td>
          <td class="px-4 py-3.5">${totals.above12.checked} / ${totals.above12.total}</td>
          <td class="px-4 py-3.5 text-indigo-800">${totals.checked} / ${totals.total}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  `;

  document.getElementById("registration-table").innerHTML = rows.length 
    ? tableHtml 
    : `<p class="py-12 text-center text-xs font-semibold text-slate-400">No registrations found.</p>`;

  document.querySelectorAll(".btn-save-reg").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      handleInlineSaveRegistration(row.dataset.id, row);
    });
  });
}

function renderCheckedInTable() {
  const checked = attendees.filter(a => a.status === "checked_in");
  const regMap = new Map(registrations.map(r => [r.id, r]));

  const rows = checked.map((att, idx) => {
    const reg = regMap.get(att.registrationId) || {};
    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-4 py-3 font-mono text-slate-400">${idx + 1}</td>
        <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(reg.familyName || "")}</td>
        <td class="px-4 py-3 font-semibold text-slate-700">${escapeHtml(att.memberName || "Guest")}</td>
        <td class="px-4 py-3 text-slate-600">${formatCategory(att.category)}</td>
        <td class="px-4 py-3">
          <span class="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${badgeColor(att.groupColor)}">${escapeHtml(att.groupColor || "")}</span>
        </td>
        <td class="px-4 py-3 font-mono text-slate-500">${formatDate(att.checkedInAt)}</td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(att.checkedInBy || "Gate Staff")}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("checked-in-table").innerHTML = `
    <table class="min-w-full text-left text-xs bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="bg-slate-100/70 border-b border-slate-200 text-slate-700">
          ${["#", "Family", "Attendee Name", "Category", "Group", "Checked-in Time", "Verified By"].map(h => `<th class="px-4 py-3.5 font-black whitespace-nowrap">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${rows || `<tr><td colspan="7" class="px-4 py-12 text-center text-slate-400 font-semibold">No checked-in members recorded yet.</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderDeskList() {
  const container = document.getElementById("desk-list");
  if (!deskUsers.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 font-semibold py-2">No verification desk accounts currently active.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="min-w-full text-left text-xs bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="border-b border-slate-200 text-slate-700">
          <th class="px-3.5 py-2.5 font-black">Username</th>
          <th class="px-3.5 py-2.5 font-black">Staff Member</th>
          <th class="px-3.5 py-2.5 font-black">Assigned Role</th>
          <th class="px-3.5 py-2.5 font-black">Security</th>
          <th class="px-3.5 py-2.5 font-black">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${deskUsers.map(u => `
          <tr data-desk-id="${escapeHtml(u.id)}">
            <td class="px-3.5 py-2.5 font-bold font-mono text-slate-900">${escapeHtml(u.id)}</td>
            <td class="px-3.5 py-2.5 text-slate-700">${escapeHtml(u.displayName || "")}</td>
            <td class="px-3.5 py-2.5 text-slate-500">verification_desk</td>
            <td class="px-3.5 py-2.5 font-mono text-[10px] text-slate-400">Encrypted (SHA-256)</td>
            <td class="px-3.5 py-2.5">
              <button class="btn-reset-desk rounded-xl bg-slate-800 px-3 py-1 font-bold text-white hover:bg-slate-700 transition">Reset Password</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll(".btn-reset-desk").forEach(btn => {
    btn.addEventListener("click", () => {
      const username = btn.closest("tr").dataset.deskId;
      handleResetDeskPassword(username);
    });
  });
}

async function handleResetDeskPassword(username) {
  const newPass = window.prompt(`Enter a new password for '${username}' (min 6 chars):`);
  if (!newPass || newPass.length < 6) return alert("Password must contain at least 6 characters.");
  const currentUid = sessionStorage.getItem("portalUserId");
  await safeUpdateDoc(doc(db, "users", username), {
    passwordHash: await sha256(newPass)
  }, currentUid);
  alert("Password reset successfully.");
}

async function handleCreateDeskUser(e, currentUser) {
  e.preventDefault();
  const status = document.getElementById("desk-status");
  const formData = Object.fromEntries(new FormData(e.target));
  const username = formData.username.trim();

  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    status.textContent = "Username must be 3-30 letters, numbers, or hyphens.";
    status.className = "text-xs font-semibold text-rose-600 block";
    return;
  }

  try {
    const userRef = doc(db, "users", username);
    const existing = await getDoc(userRef);
    if (existing.exists()) throw new Error("That desk username already exists.");

    await setDoc(userRef, {
      displayName: formData.displayName.trim(),
      role: "verification_desk",
      passwordHash: await sha256(formData.password),
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    status.textContent = `Verification account '${username}' created.`;
    status.className = "text-xs font-semibold text-emerald-600 block";
    e.target.reset();
    await loadMeetupData();
  } catch (err) {
    status.textContent = err.message;
    status.className = "text-xs font-semibold text-rose-600 block";
  }
}

async function handleInlineSaveRegistration(id, rowEl) {
  const familyName = rowEl.querySelector('[data-field="familyName"]').value.trim();
  const status = rowEl.querySelector('[data-field="status"]').value;
  const currentUid = sessionStorage.getItem("portalUserId");

  await safeUpdateDoc(doc(db, "meetupRegistrations", id), {
    familyName,
    status
  }, currentUid);

  registrations = registrations.map(r => r.id === id ? { ...r, familyName, status } : r);
  alert("Registration updated.");
}

async function handleSaveEvent(e, currentUser) {
  e.preventDefault();
  const values = Object.fromEntries(new FormData(e.target));
  await setDoc(doc(collection(db, "meetupEvents")), {
    ...values,
    maxScore: Number(values.maxScore),
    year: 2026,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp()
  });
  e.target.reset();
  e.target.classList.add("hidden");
  await loadMeetupData();
}

function renderEvents() {
  const container = document.getElementById("event-list");
  if (!events.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 font-semibold py-2">No competition events scheduled yet.</p>`;
    return;
  }

  container.innerHTML = events.map(ev => {
    const isGroup = ev.eventType === "group";
    const participants = isGroup 
      ? `<select class="score-group rounded-xl border border-slate-300 px-3 py-1.5 text-xs">${colors.map(c => `<option value="${c}" ${ev.groupColor === c ? "selected" : ""}>${c} Group</option>`).join("")}</select>`
      : `<select class="score-attendee rounded-xl border border-slate-300 px-3 py-1.5 text-xs max-w-xs">${attendees.map(a => `<option value="${a.id}">${escapeHtml(a.memberName || a.id)} (${a.groupColor})</option>`).join("")}</select>`;

    return `
      <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-black text-sm text-slate-900">${escapeHtml(ev.name)}</h3>
            <p class="text-[11px] text-slate-500 font-medium">${ev.eventType} event | ${ev.groupColor} group | Max points: ${ev.maxScore}</p>
          </div>
          <button data-ev-id="${ev.id}" class="btn-toggle-score rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition">Award Score</button>
        </div>
        <div id="score-box-${ev.id}" class="mt-3 hidden flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
          ${participants}
          <input class="score-input w-24 rounded-xl border border-slate-300 px-3 py-1.5 text-xs" type="number" min="0" max="${ev.maxScore}" placeholder="Points" />
          <button data-save-ev="${ev.id}" class="btn-commit-score rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition">Save</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".btn-toggle-score").forEach(b => {
    b.addEventListener("click", () => {
      document.getElementById(`score-box-${b.dataset.evId}`).classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".btn-commit-score").forEach(b => {
    b.addEventListener("click", () => handleSaveScore(b.dataset.saveEv, b.parentElement));
  });
}

async function handleSaveScore(eventId, formEl) {
  const score = Number(formEl.querySelector(".score-input").value);
  const ev = events.find(e => e.id === eventId);
  if (!ev || Number.isNaN(score) || score < 0 || score > Number(ev.maxScore)) {
    return alert(`Please enter a valid score between 0 and ${ev.maxScore}.`);
  }

  const isGroup = ev.eventType === "group";
  const attendeeId = isGroup ? "" : formEl.querySelector(".score-attendee").value;
  const attendee = attendeeId ? attendees.find(a => a.id === attendeeId) : null;
  const groupColor = isGroup ? formEl.querySelector(".score-group").value : attendee?.groupColor;

  if (!groupColor || (!isGroup && !attendee)) return alert("Select participant or group.");

  const currentUid = sessionStorage.getItem("portalUserId");
  const scoreId = `${eventId}_${isGroup ? groupColor : attendeeId}`;
  await setDoc(doc(db, "meetupScores", scoreId), {
    eventId,
    eventType: ev.eventType || "solo",
    attendeeId,
    registrationId: attendee?.registrationId || "",
    groupColor,
    score,
    year: 2026,
    recordedBy: currentUid,
    updatedAt: serverTimestamp()
  });

  alert("Score recorded.");
  await loadMeetupData();
}

function renderRanking() {
  const totals = { red: 0, blue: 0, green: 0 };
  scores.forEach(s => {
    if (totals[s.groupColor] !== undefined) totals[s.groupColor] += Number(s.score || 0);
  });

  const ranked = colors.map(c => ({ color: c, score: totals[c] })).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...ranked.map(r => r.score), 1);

  const colorsStyling = {
    red: "bg-rose-50 border-rose-200 text-rose-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900"
  };

  document.getElementById("ranking-container").innerHTML = `
    <div class="space-y-3">
      ${ranked.map((r, i) => `
        <div class="rounded-2xl border p-4.5 ${colorsStyling[r.color]} transition">
          <div class="flex items-center justify-between">
            <span class="font-black text-xs uppercase tracking-wider">#${i + 1}${r.color} Group</span>
            <span class="text-2xl font-black">${r.score} pts</span>
          </div>
          <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-white/70">
            <div class="h-full rounded-full bg-current transition-all" style="width: ${Math.round((r.score / maxScore) * 100)}%"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// -------------------------------------------------------------
// EXPORT & PRINT
// -------------------------------------------------------------
function triggerPrint(view) {
  document.body.dataset.printView = view;
  window.print();
  setTimeout(() => delete document.body.dataset.printView, 500);
}

function downloadRegistrationPdf() {
  if (!window.jspdf?.jsPDF) return alert("PDF library is loading. Use Print register instead.");
  const filter = document.getElementById("color-filter").value;
  const rows = registrations.filter(r => !filter || r.groupColor === filter);
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdf.setFontSize(14);
  pdf.text("Ta'aluf Family Meetup 2026 — Official Register", 10, 12);
  pdf.setFontSize(8);
  pdf.text(`Group filter: ${filter || "All"} | Generated: ${new Date().toLocaleString()}`, 10, 18);

  const columns = ["Sl", "Family Name", "Group", "Below 5", "5-12", "Above 12", "Total (C/T)", "Status"];
  const widths = [12, 60, 24, 28, 28, 28, 30, 28];
  let x = 10;
  let y = 26;

  pdf.setFillColor(15, 23, 42);
  pdf.setTextColor(255, 255, 255);
  columns.forEach((c, idx) => {
    pdf.rect(x, y - 5, widths[idx], 8, "F");
    pdf.text(c, x + 2, y);
    x += widths[idx];
  });

  y += 8;
  pdf.setTextColor(15, 23, 42);

  rows.forEach((item, idx) => {
    const s = calculateFamilyStats(item);
    const vals = [
      idx + 1,
      item.familyName || "",
      item.groupColor || "",
      `${s.below5.checked}/${s.below5.total}`,
      `${s.age5to12.checked}/${s.age5to12.total}`,
      `${s.above12.checked}/${s.above12.total}`,
      `${s.checked}/${s.total}`,
      item.status || ""
    ];

    if (y > 185) { pdf.addPage(); y = 15; }
    x = 10;
    vals.forEach((v, vIdx) => {
      pdf.rect(x, y - 5, widths[vIdx], 8);
      pdf.text(String(v).slice(0, 30), x + 2, y);
      x += widths[vIdx];
    });
    y += 8;
  });

  pdf.save(`taaluf-2026-register-${filter || "all"}.pdf`);
}

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
function initEmptyStats() {
  return { below5: { checked: 0, total: 0 }, age5to12: { checked: 0, total: 0 }, above12: { checked: 0, total: 0 }, checked: 0, total: 0 };
}

function sumStats(target, src) {
  ["below5", "age5to12", "above12"].forEach(cat => {
    target[cat].checked += src[cat].checked;
    target[cat].total += src[cat].total;
  });
  target.checked += src.checked;
  target.total += src.total;
  return target;
}

function calculateFamilyStats(registration) {
  const fMembers = attendees.filter(a => a.registrationId === registration.id);
  const stats = initEmptyStats();
  for (const a of fMembers) {
    const cat = stats[a.category] ? a.category : "above12";
    stats[cat].total += 1;
    stats.total += 1;
    if (a.status === "checked_in") {
      stats[cat].checked += 1;
      stats.checked += 1;
    }
  }
  return stats;
}

function badgeColor(c) {
  return { 
    red: "bg-rose-100 text-rose-700", 
    blue: "bg-blue-100 text-blue-700", 
    green: "bg-emerald-100 text-emerald-700" 
  }[String(c).toLowerCase()] || "bg-slate-100 text-slate-700";
}

function formatCategory(c) {
  return { below5: "Below 5", age5to12: "Age 5-12", above12: "Above 12" }[c] || c || "";
}

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]);
}
