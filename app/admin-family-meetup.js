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
  softDeleteDoc,
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

  if (!currentUser.uid || !["admin", "usthad"].includes(currentUser.role)) {
    window.navigate("login");
    return;
  }

  document.title = "Ta'aluf Gathering Control Center | Admin";
  app.className = "min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col";

  app.innerHTML = `
    <!-- Sticky Header -->
    <header class="bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center space-x-3">
          <button id="btn-back-dashboard" class="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition">
            <span>←</span> Dashboard
          </button>
          <span class="text-slate-700">|</span>
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center justify-center">
  <img src="taaluf.png" alt="Madrasa Icon" class="w-20 h-20 object-contain rounded-xl" />
</span><h1 class="text-sm sm:text-base font-black tracking-tight text-white">Ta'aluf Family Gathering 2026</h1>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300 uppercase">${currentUser.role || "Admin"}</span>
          <button id="admin-signout-btn" class="rounded-xl border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition">Sign out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl space-y-6 p-6 lg:p-8 flex-grow">
<!-- REGISTRATION OPEN / CLOSE STATUS TOGGLE -->
      <section class="rounded-3xl bg-white p-5 lg:p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span id="reg-status-indicator" class="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
            <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">Public Portal Status</h2>
          </div>
          <p id="reg-status-desc" class="text-xs text-slate-500">Checking current online registration status...</p>
        </div>
        <div class="flex items-center gap-3">
          <span id="reg-status-pill" class="rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600">Loading...</span>
          <button id="btn-toggle-reg-status" class="rounded-xl px-4 py-2 text-xs font-bold text-white transition shadow-sm bg-slate-900 hover:bg-slate-800">
            Toggle Status
          </button>
        </div>
      </section>
      <!-- Live KPI Stats Grid -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Registrations</p>
          <p id="stat-registrations" class="mt-2 text-3xl font-black text-slate-900">0</p>
        </div>
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Unique Families</p>
          <p id="stat-families" class="mt-2 text-3xl font-black text-slate-900">0</p>
        </div>
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Badges Generated</p>
          <p id="stat-members" class="mt-2 text-3xl font-black text-emerald-700">0</p>
        </div>
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">Checked-in At Gate</p>
          <p id="stat-checked-in" class="mt-2 text-3xl font-black text-teal-600">0</p>
        </div>
      </section>

      <!-- BULK CSV / EXCEL GUEST LIST IMPORT -->
<section class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-2">
        <span>📥</span> Guest List Importer
      </span>
      <h2 class="text-xl font-black text-slate-900">Bulk Registration via Spreadsheet</h2>
      <p class="text-xs text-slate-500 mt-1">Upload the consolidated attendee list to assign color groups and generate secure badges.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <button 
        type="button" 
        id="btn-download-sample-csv" 
        class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-3 text-xs font-bold text-slate-700 transition"
      >
        <span>📄</span> Download Sample CSV
      </button>
      <label class="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-800 shadow transition">
        <span>Choose Excel / CSV File</span>
        <input type="file" id="bulk-csv-input" accept=".csv, .xlsx, .xls" class="hidden" />
      </label>
    </div>
  </div>

  <!-- Column Reference & Demo Data Container -->
  <div class="rounded-2xl border border-emerald-900/10 bg-[#f9fbf9] p-4 sm:p-5 space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/10 pb-3">
      <div>
        <h3 class="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
          <span>📋</span> Required Column Names & Accepted Headers
        </h3>
        <p class="text-[11px] text-slate-500 mt-0.5">Names can be separated by commas (<code>,</code>) or line breaks within the cell.</p>
      </div>
      <div class="flex flex-wrap gap-1.5 text-[10px] font-mono font-bold">
        <span class="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-800">Family Name *</span>
        <span class="bg-white border border-slate-200 px-2 py-0.5 rounded text-emerald-800">Mobile *</span>
        <span class="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">Adults (12+)</span>
        <span class="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">Children (5-12)</span>
        <span class="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">Infants (&lt;5)</span>
        <span class="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">Group Color</span>
      </div>
    </div>

    <!-- Demo Data Table -->
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full text-left text-xs">
        <thead class="bg-slate-50 border-b border-slate-200 text-slate-700">
          <tr>
            <th class="px-3 py-2 font-black">Family Name</th>
            <th class="px-3 py-2 font-black">Mobile</th>
            <th class="px-3 py-2 font-black">Adults (12+ yrs) - Names</th>
            <th class="px-3 py-2 font-black">Children (5-12 yrs) - Names</th>
            <th class="px-3 py-2 font-black">Infants (below 5 yrs) - Names</th>
            <th class="px-3 py-2 font-black">Group Color</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-mono text-[11px] text-slate-600">
          <tr>
            <td class="px-3 py-2 font-bold text-slate-800 font-sans">Al-Farhan Family</td>
            <td class="px-3 py-2 text-emerald-700 font-bold">9876543210</td>
            <td class="px-3 py-2 font-sans">Farhan, Ayesha</td>
            <td class="px-3 py-2 font-sans">Zaid, Maryam</td>
            <td class="px-3 py-2 font-sans">Hamza</td>
            <td class="px-3 py-2 font-sans font-bold text-rose-600">red</td>
          </tr>
          <tr>
            <td class="px-3 py-2 font-bold text-slate-800 font-sans">Noor Family</td>
            <td class="px-3 py-2 text-emerald-700 font-bold">9845012345</td>
            <td class="px-3 py-2 font-sans">Abdul Noor, Fatima</td>
            <td class="px-3 py-2 font-sans">Bilal</td>
            <td class="px-3 py-2 font-sans italic text-slate-400">none</td>
            <td class="px-3 py-2 font-sans font-bold text-blue-600">blue</td>
          </tr>
          <tr>
            <td class="px-3 py-2 font-bold text-slate-800 font-sans">Hidaya Family</td>
            <td class="px-3 py-2 text-emerald-700 font-bold">9741234567</td>
            <td class="px-3 py-2 font-sans">Musthafa, Khadija</td>
            <td class="px-3 py-2 font-sans italic text-slate-400">none</td>
            <td class="px-3 py-2 font-sans">Zayan</td>
            <td class="px-3 py-2 font-sans font-bold text-emerald-600">green</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- File Preview Panel -->
  <div id="bulk-preview-area" class="hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
      <div>
        <p id="preview-filename" class="text-xs font-bold text-slate-800"></p>
        <p id="preview-stats" class="text-[11px] text-slate-500 mt-0.5"></p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-cancel-import" class="rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 transition">Cancel</button>
        <button id="btn-execute-import" class="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow transition flex items-center gap-2">
          <span>Start Batch Import</span>
          <span id="import-spinner" class="hidden animate-spin">⏳</span>
        </button>
      </div>
    </div>
    <div id="preview-table" class="overflow-x-auto max-h-56 text-xs"></div>
  </div>
</section>

      <!-- REGISTRATIONS & LIVE GATE FEED -->
      <section class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
            <button id="tab-registration" class="rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-sm transition">
              Master Registration List
            </button>
            <button id="tab-checked" class="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition">
              Checked-in Live Feed
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <select id="color-filter" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600">
              <option value="">All Color Groups</option>
              <option value="red">Red Team</option>
              <option value="blue">Blue Team</option>
              <option value="green">Green Team</option>
            </select>
            <button id="btn-refresh" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Refresh</button>
            <button id="btn-download-pdf" class="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition">Export PDF</button>
          </div>
        </div>

        <div id="view-registration-container">
          <div id="registration-table" class="overflow-x-auto"></div>
        </div>

        <div id="view-checked-container" class="hidden">
          <div id="checked-in-table" class="overflow-x-auto"></div>
        </div>
      </section>

      <!-- GATE VERIFICATION DESK ACCOUNTS -->
      <section class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-black text-slate-900">Gate Verification Staff</h2>
            <p class="text-xs text-slate-500 mt-0.5">Create dedicated accounts for volunteers stationed at reception scanners.</p>
          </div>
          <div class="flex items-center gap-2">
            <input id="desk-link-url" readonly class="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-600 w-64 outline-none" />
            <button id="btn-copy-desk" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Copy Link</button>
          </div>
        </div>

        <form id="desk-user-form" class="grid gap-3 sm:grid-cols-4 pt-2">
          <input name="username" required placeholder="Staff Username (e.g. gate01)" class="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          <input name="displayName" required placeholder="Volunteer Full Name" class="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          <input name="password" required type="password" minlength="6" placeholder="Password (min 6 chars)" class="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
          <button class="rounded-xl bg-emerald-700 font-bold text-xs text-white hover:bg-emerald-800 transition py-2.5">Create Staff Account</button>
        </form>
        <p id="desk-status" class="text-xs font-semibold hidden"></p>
        <div id="desk-list" class="overflow-x-auto pt-2"></div>
      </section>

      <!-- SCORING & COLOR TEAM LEADERBOARD -->
      <section class="grid gap-6 lg:grid-cols-3">
        <!-- Event Management & Live Points Award -->
        <div class="lg:col-span-2 rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-black text-slate-900">Events & Live Scoring</h2>
              <p class="text-xs text-slate-500 mt-0.5">Award competition points to color teams or individuals.</p>
            </div>
            <button id="btn-toggle-event" class="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition">Add Event</button>
          </div>

          <form id="event-creation-form" class="hidden grid gap-3 sm:grid-cols-5 p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <input name="name" required placeholder="Event Title" class="sm:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-xs" />
            <select name="eventType" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
              <option value="group">Group Event</option>
              <option value="solo">Solo Event</option>
            </select>
            <select name="groupColor" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
              <option value="all">All Groups</option>
              <option value="red">Red Team</option>
              <option value="blue">Blue Team</option>
              <option value="green">Green Team</option>
            </select>
            <input name="maxScore" type="number" min="1" required placeholder="Max Score" class="rounded-xl border border-slate-300 px-3 py-2 text-xs" />
            <button class="sm:col-span-5 rounded-xl bg-slate-900 font-bold text-xs text-white hover:bg-slate-800 py-2.5 transition">Save Event</button>
          </form>

          <div id="event-list" class="space-y-3 pt-2"></div>
        </div>

        <!-- Live Color Leaderboard Standings -->
        <div class="rounded-3xl bg-white p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-4">
          <div>
            <h2 class="text-xl font-black text-slate-900">Team Standings</h2>
            <p class="text-xs text-slate-500 mt-0.5">Aggregated color leaderboard.</p>
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
  document.getElementById("btn-back-dashboard").addEventListener("click", () => window.navigate("dashboard"));
  document.getElementById("admin-signout-btn").addEventListener("click", () => {
    sessionStorage.clear();
    window.navigate("login");
  });

  // Registration Status Toggle
  document.getElementById("btn-toggle-reg-status")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-toggle-reg-status");
    btn.disabled = true;
    btn.textContent = "Updating...";

    try {
      const nextState = !isRegistrationOpen;
      const currentUid = sessionStorage.getItem("portalUserId");

      await safeUpdateDoc(doc(db, "meetupSettings", "current"), {
        registrationOpen: nextState,
        updatedAt: serverTimestamp()
      }, currentUid);

      isRegistrationOpen = nextState;
      await loadRegistrationSettings();
      alert(`Registration is now ${nextState ? "OPEN" : "CLOSED"}.`);
    } catch (err) {
      alert("Failed to change registration status: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  const deskUrl = new URL("./index.html?view=verification-desk", window.location.href).href;
  document.getElementById("desk-link-url").value = deskUrl;
  document.getElementById("btn-copy-desk").addEventListener("click", async () => {
    await navigator.clipboard.writeText(deskUrl);
    alert("Verification desk URL copied!");
  });

  document.getElementById("btn-refresh").addEventListener("click", loadMeetupData);
  document.getElementById("color-filter").addEventListener("change", renderRegistrationTable);
  document.getElementById("btn-download-pdf").addEventListener("click", downloadRegistrationPdf);
  document.getElementById("tab-registration").addEventListener("click", () => toggleTabs("registration"));
  document.getElementById("tab-checked").addEventListener("click", () => toggleTabs("checked"));

  document.getElementById("btn-toggle-event").addEventListener("click", () => {
    document.getElementById("event-creation-form").classList.toggle("hidden");
  });
  document.getElementById("event-creation-form").addEventListener("submit", (e) => handleSaveEvent(e, currentUser));
  document.getElementById("desk-user-form").addEventListener("submit", (e) => handleCreateDeskUser(e, currentUser));

  document.getElementById("bulk-csv-input").addEventListener("change", handleFileSelected);
  document.getElementById("btn-cancel-import").addEventListener("click", cancelPendingImport);
  document.getElementById("btn-execute-import").addEventListener("click", () => executeBulkImport(currentUser));

document.getElementById("btn-download-sample-csv")?.addEventListener("click", () => {
  const headers = [
    "Family Name",
    "Mobile",
    "Adults (12+ yrs) - Names",
    "Children (5-12 yrs) - Names",
    "Infants (below 5 yrs) - Names",
    "Group Color"
  ];

  const sampleRows = [
    ['Al-Farhan Family', '9876543210', 'Farhan, Ayesha', 'Zaid, Maryam', 'Hamza', 'red'],
    ['Noor Family', '9845012345', 'Abdul Noor, Fatima', 'Bilal', '', 'blue'],
    ['Hidaya Family', '9741234567', 'Musthafa, Khadija', '', 'Zayan', 'green']
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "taaluf_bulk_import_sample.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
}

// -------------------------------------------------------------
// SPREADSHEET PARSER & PREVIEW
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
      const name = r.familyName || r["Family Name"] || r["Family (Reference Name)"];
      return Boolean(name) && String(name).toLowerCase() !== "total";
    });

    renderImportPreview(file.name);
  } catch (err) {
    alert("Parsing failed: " + err.message);
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
  statsEl.textContent = `Found ${pendingUploadRows.length} families ready for import. Default password will be set to phone suffix or 123456.`;

  tableEl.innerHTML = `
    <table class="min-w-full text-left bg-white border border-slate-200 rounded-xl overflow-hidden">
      <thead>
        <tr class="bg-slate-100 border-b border-slate-200 text-slate-700">
          <th class="px-3 py-2 font-black">#</th>
          <th class="px-3 py-2 font-black">Family Name</th>
          <th class="px-3 py-2 font-black">Mobile</th>
          <th class="px-3 py-2 font-black">Adults (12+)</th>
          <th class="px-3 py-2 font-black">Children (5-12)</th>
          <th class="px-3 py-2 font-black">Infants (<5)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${pendingUploadRows.slice(0, 5).map((r, i) => {
          const rawMobile = String(r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "").replace(/\D/g, "");
          const mobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;
          const familyName = r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family";
          const adults = r.membersAbove12 || r["Adults (12+ yrs) - Names"] || "";
          const children = r.members5to12 || r["Children (5-12 yrs) - Names"] || "";
          const infants = r.membersBelow5 || r["Infants (below 5 yrs) - Names"] || "";

          return `
            <tr>
              <td class="px-3 py-1.5 font-mono text-slate-400">${i + 1}</td>
              <td class="px-3 py-1.5 font-bold text-slate-800">${escapeHtml(familyName)}</td>
              <td class="px-3 py-1.5 font-mono ${mobile ? 'text-slate-600' : 'text-rose-600 font-bold'}">${mobile || "Missing Mobile"}</td>
              <td class="px-3 py-1.5 truncate max-w-xs text-slate-500">${escapeHtml(adults)}</td>
              <td class="px-3 py-1.5 truncate max-w-xs text-slate-500">${escapeHtml(children)}</td>
              <td class="px-3 py-1.5 truncate max-w-xs text-slate-500">${escapeHtml(infants)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function cancelPendingImport() {
  pendingUploadRows = [];
  document.getElementById("bulk-preview-area").classList.add("hidden");
  document.getElementById("bulk-csv-input").value = "";
}

// Updated executeBulkImport in admin-family-meetup.js
async function executeBulkImport(currentUser) {
  if (!pendingUploadRows.length) return;
  const btn = document.getElementById("btn-execute-import");
  const spinner = document.getElementById("import-spinner");

  btn.disabled = true;
  spinner.classList.remove("hidden");

  try {
    let imported = 0;
    for (const r of pendingUploadRows) {
      const sno = r.sno || r["S.No"] || (imported + 1);
      const regNo = String(r.registrationNo || `REG2026-${String(sno).padStart(3, "0")}`).trim();
      
      const rawMobile = String(r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "").replace(/\D/g, "");
      const mobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;
      if (!mobile) continue;

      const familyName = String(r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family").trim();
      const groupColor = String(r.groupColor || colors[imported % 3]).toLowerCase().trim();
      
      // Default password is last 6 digits of mobile
      const defaultPassword = mobile.length >= 6 ? mobile.slice(-6) : "123456";
      const hashedPass = await sha256(defaultPassword);

      // Create Master Family Token for 1-QR family scanning
      const rawFamilyToken = generateSecureToken(24);
      const masterTokenHash = await sha256(rawFamilyToken);

      const categoryMappings = [
        { field: r.membersAbove12 || r["Adults (12+ yrs) - Names"], cat: "above12" },
        { field: r.members5to12 || r["Children (5-12 yrs) - Names"], cat: "age5to12" },
        { field: r.membersBelow5 || r["Infants (below 5 yrs) - Names"], cat: "below5" }
      ];

      // Parse all attendees first to know the total count
      const attendeeList = [];
      for (const { field, cat } of categoryMappings) {
        if (!field) continue;
        const names = String(field).split(/[\n;,]+/).map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          attendeeList.push({ name, cat });
        }
      }

      // 1. Save Master Registration Record
      await setDoc(doc(db, "meetupRegistrations", regNo), {
        registrationNo: regNo,
        familyName,
        mobileNo: mobile,
        passwordHash: hashedPass,
        dobHash: "",
        defaultPassword: defaultPassword, // Readable hint for admin desk
        groupColor,
        totalAttendees: attendeeList.length,
        checkedInCount: 0,
        rawFamilyToken,
        qrTokenHash: masterTokenHash,
        status: "confirmed",
        isDeleted: false,
        year: 2026,
        importedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Save Attendees with deterministic IDs
      for (let i = 0; i < attendeeList.length; i++) {
        const item = attendeeList[i];
        const attRef = doc(db, "meetupAttendees", `${regNo}_att_${i + 1}`);
        await setDoc(attRef, {
          registrationId: regNo,
          sequenceNo: i + 1,
          memberName: item.name,
          category: item.cat,
          groupColor,
          status: "pending",
          isDeleted: false,
          year: 2026,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      imported++;
    }

    alert(`Successfully imported ${imported} family registrations!`);
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
    await loadRegistrationSettings();

    const [regSnap, attSnap, evSnap, scSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, "meetupRegistrations"), where("isDeleted", "!=", true))),
      getDocs(query(collection(db, "meetupAttendees"), where("isDeleted", "!=", true))),
      getDocs(query(collection(db, "meetupEvents"), where("isDeleted", "!=", true))),
      getDocs(collection(db, "meetupScores")),
      getDocs(query(collection(db, "users"), where("isDeleted", "!=", true)))
    ]);

    registrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    attendees = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    events = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    scores = scSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    deskUsers = userSnap.docs
      .filter(d => d.data().role === "verification_desk")
      .map(d => ({ id: d.id, ...d.data() }));

    renderStats();
    renderRegistrationTable();
    renderCheckedInTable();
    renderDeskList();
    renderEvents();
    renderRanking();
  } catch (err) {
    console.error("Data load failed:", err);
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

  const tableHtml = `
    <table class="min-w-full text-left text-xs bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-700">
          <th class="px-4 py-3 font-black">#</th>
          <th class="px-4 py-3 font-black">Family Name</th>
          <th class="px-4 py-3 font-black">Team</th>
          <th class="px-4 py-3 font-black">Status</th>
          <th class="px-4 py-3 font-black">Attendees</th>
          <th class="px-4 py-3 font-black text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${rows.map((r, idx) => {
          const fMembers = attendees.filter(a => a.registrationId === r.id);
          const checked = fMembers.filter(a => a.status === "checked_in").length;
          return `
            <tr data-id="${r.id}" class="hover:bg-slate-50/80 transition">
              <td class="px-4 py-3 font-mono text-slate-400">${idx + 1}</td>
              <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(r.familyName)}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${badgeColor(r.groupColor)}">${escapeHtml(r.groupColor)}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs font-semibold text-emerald-700">${escapeHtml(r.status || "confirmed")}</span>
              </td>
              <td class="px-4 py-3 font-mono font-bold text-slate-700">${checked} /${fMembers.length}</td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-2">
                  <!-- Eye View Details Button -->
                  <button 
                    data-view-id="${r.id}" 
                    class="btn-view-reg p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition" 
                    title="View & Edit Attendees"
                  >
                    <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button data-del-id="${r.id}" class="btn-del-reg text-rose-600 hover:text-rose-800 font-bold transition px-1">Delete</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <!-- Modal Container for Attendee Details & Inline Editing -->
    <div id="attendee-details-modal" class="hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span class="text-[10px] font-black uppercase tracking-wider text-emerald-700">Family Pass Roster</span>
            <h3 id="modal-family-name" class="text-base font-black text-slate-900"></h3>
            <p id="modal-reg-id" class="text-[11px] font-mono text-slate-500"></p>
          </div>
          <button id="btn-close-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition">✕</button>
        </div>

        <div id="modal-attendees-list" class="p-5 overflow-y-auto space-y-3 divide-y divide-slate-100"></div>

        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button id="btn-done-modal" class="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition">Done</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("registration-table").innerHTML = rows.length 
    ? tableHtml 
    : `<p class="py-12 text-center text-xs font-semibold text-slate-400">No registrations found.</p>`;

  // Bind Delete buttons
  document.querySelectorAll(".btn-del-reg").forEach(b => {
    b.addEventListener("click", () => handleDeleteRegistration(b.dataset.delId));
  });

  // Bind Eye view buttons
  document.querySelectorAll(".btn-view-reg").forEach(b => {
    b.addEventListener("click", () => openFamilyDetailsModal(b.dataset.viewId));
  });

  // Modal close handlers
  document.getElementById("btn-close-modal")?.addEventListener("click", closeFamilyDetailsModal);
  document.getElementById("btn-done-modal")?.addEventListener("click", closeFamilyDetailsModal);
}

function openFamilyDetailsModal(regId) {
  const reg = registrations.find(r => r.id === regId);
  if (!reg) return;

  const fMembers = attendees.filter(a => a.registrationId === regId);
  const modal = document.getElementById("attendee-details-modal");
  
  // Resolve password display: show raw default (last 6 digits) if stored as hash or explicit defaultPass
  const defaultPassHint = reg.defaultPassword || (reg.mobileNo && reg.mobileNo.length >= 6 ? reg.mobileNo.slice(-6) : "123456");

  // Modal Header with Name & Pass Counts
  document.getElementById("modal-family-name").textContent = `${reg.familyName} Family`;
  document.getElementById("modal-reg-id").textContent = `ID: ${reg.registrationNo || reg.id} • ${reg.groupColor?.toUpperCase()} Team • ${fMembers.length} Members`;

  const container = document.getElementById("modal-attendees-list");

  // Injected Credentials Banner + Member Rows
  container.innerHTML = `
    <!-- Family Access & Credentials Card -->
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
          <span>🔐</span> Family Pass Credentials
        </span>
        <button 
          id="btn-quick-copy-creds" 
          class="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg transition"
        >
          Copy Info
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <!-- Mobile Field -->
        <div class="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between">
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Registered Mobile</span>
            <span id="modal-display-mobile" class="font-mono font-bold text-slate-800">${escapeHtml(reg.mobileNo || "N/A")}</span>
          </div>
          <span class="text-sm">📱</span>
        </div>

        <!-- Password Field -->
        <div class="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between">
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Default Pass (Phone Suffix / DOB)</span>
            <span id="modal-display-pass" class="font-mono font-bold text-emerald-700">${escapeHtml(defaultPassHint)}</span>
          </div>
          <button 
            id="btn-reset-family-pass" 
            data-reg-id="${reg.id}" 
            class="text-[10px] font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition"
            title="Reset Password"
          >
            Reset
          </button>
        </div>
      </div>
      
      <p class="text-[10px] text-emerald-800/80 leading-tight">
        Families use these credentials on the public portal to download their master entry pass.
      </p>
    </div>

    <!-- Attendees Listing Header -->
    <div class="pt-2">
      <span class="text-[11px] font-black uppercase tracking-wider text-slate-400">Attending Members</span>
    </div>

    <!-- Attendees List -->
    ${fMembers.map((att, idx) => `
      <div class="space-y-2">
        <!-- Read View -->
        <div id="row-view-${att.id}" class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-black text-slate-900">${escapeHtml(att.memberName || "Pass Holder #" + (idx + 1))}</h4>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${att.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                ${att.status === 'checked_in' ? 'Checked-in' : 'Pending'}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              ${att.age ? `Age: ${escapeHtml(att.age)} • ` : ""}<span class="uppercase tracking-wider font-semibold">${escapeHtml(att.category)}</span>
            </p>
          </div>
          <button 
            data-edit-att="${att.id}" 
            class="btn-toggle-att-edit p-1.5 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-white border border-transparent hover:border-slate-200 transition" 
            title="Edit Details"
          >
            <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        <!-- Inline Edit View -->
        <div id="row-edit-${att.id}" class="hidden p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-emerald-800">Edit Member Details</p>
          <div class="flex gap-2">
            <input 
              id="input-name-${att.id}" 
              value="${escapeHtml(att.memberName || "")}" 
              placeholder="Full Name" 
              class="min-w-0 flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold outline-none focus:border-emerald-600" 
            />
            <input 
              id="input-age-${att.id}" 
              value="${escapeHtml(att.age || "")}" 
              placeholder="Age" 
              maxlength="3" 
              class="w-16 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono text-center outline-none focus:border-emerald-600" 
            />
            <button 
              data-save-att="${att.id}" 
              class="btn-save-att px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition"
            >
              Save
            </button>
            <button 
              data-cancel-att="${att.id}" 
              class="btn-cancel-att px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `).join("") || `<p class="text-xs text-slate-400 text-center py-4">No attendee passes issued yet.</p>`}
  `;

  // Quick Copy Action for Mobile & Pass
  document.getElementById("btn-quick-copy-creds")?.addEventListener("click", async () => {
    const text = `Family: ${reg.familyName}\nMobile: ${reg.mobileNo}\nPass: ${defaultPassHint}`;
    await navigator.clipboard.writeText(text);
    alert("Family credentials copied to clipboard!");
  });

  // Password Reset Prompt for Admins
  document.getElementById("btn-reset-family-pass")?.addEventListener("click", async () => {
    const newPass = window.prompt(`Enter new login password for ${reg.familyName} (min 6 digits / DDMMYYYY):`);
    if (!newPass || newPass.trim().length < 6) {
      return alert("Password must be at least 6 characters.");
    }

    try {
      const hashed = await sha256(newPass.trim());
      const currentUid = sessionStorage.getItem("portalUserId");
      await safeUpdateDoc(doc(db, "meetupRegistrations", reg.id), {
        passwordHash: hashed,
        dobHash: hashed,
        defaultPassword: newPass.trim()
      }, currentUid);

      reg.passwordHash = hashed;
      reg.defaultPassword = newPass.trim();
      alert("Password updated successfully.");
      openFamilyDetailsModal(regId);
    } catch (err) {
      alert("Failed to update password: " + err.message);
    }
  });

  // Wire pencil edit toggles
  document.querySelectorAll(".btn-toggle-att-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.editAtt;
      document.getElementById(`row-view-${id}`).classList.add("hidden");
      document.getElementById(`row-edit-${id}`).classList.remove("hidden");
    });
  });

  // Wire cancel buttons
  document.querySelectorAll(".btn-cancel-att").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.cancelAtt;
      document.getElementById(`row-edit-${id}`).classList.add("hidden");
      document.getElementById(`row-view-${id}`).classList.remove("hidden");
    });
  });

  // Wire inline save buttons
  document.querySelectorAll(".btn-save-att").forEach(btn => {
    btn.addEventListener("click", () => handleInlineSaveAttendee(btn.dataset.saveAtt, regId));
  });

  modal.classList.remove("hidden");
}

async function handleInlineSaveAttendee(attendeeId, regId) {
  const nameInput = document.getElementById(`input-name-${attendeeId}`);
  const ageInput = document.getElementById(`input-age-${attendeeId}`);
  const newName = nameInput.value.trim();
  const newAge = ageInput.value.trim().replace(/\D/g, "");

  try {
    const currentUid = sessionStorage.getItem("portalUserId");
    await safeUpdateDoc(doc(db, "meetupAttendees", attendeeId), {
      memberName: newName,
      age: newAge
    }, currentUid);

    // Update local state
    attendees = attendees.map(a => a.id === attendeeId ? { ...a, memberName: newName, age: newAge } : a);

    // Refresh modal list view
    openFamilyDetailsModal(regId);
  } catch (err) {
    alert("Could not update attendee: " + err.message);
  }
}

function closeFamilyDetailsModal() {
  document.getElementById("attendee-details-modal")?.classList.add("hidden");
}

async function handleDeleteRegistration(id) {
  if (!confirm("Are you sure you want to soft-delete this family registration?")) return;
  const currentUid = sessionStorage.getItem("portalUserId");
  await softDeleteDoc(doc(db, "meetupRegistrations", id), currentUid);
  await loadMeetupData();
}

function renderCheckedInTable() {
  const checked = attendees.filter(a => a.status === "checked_in");
  const regMap = new Map(registrations.map(r => [r.id, r]));

  document.getElementById("checked-in-table").innerHTML = `
    <table class="min-w-full text-left text-xs bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-700">
          <th class="px-4 py-3 font-black">#</th>
          <th class="px-4 py-3 font-black">Family</th>
          <th class="px-4 py-3 font-black">Attendee Name</th>
          <th class="px-4 py-3 font-black">Category</th>
          <th class="px-4 py-3 font-black">Team</th>
          <th class="px-4 py-3 font-black">Verified By</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${checked.map((att, idx) => `
          <tr class="hover:bg-slate-50 transition">
            <td class="px-4 py-3 font-mono text-slate-400">${idx + 1}</td>
            <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(regMap.get(att.registrationId)?.familyName || "Family")}</td>
            <td class="px-4 py-3 font-semibold text-slate-700">${escapeHtml(att.memberName || "Guest")}</td>
            <td class="px-4 py-3 text-slate-500 uppercase">${escapeHtml(att.category)}</td>
            <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${badgeColor(att.groupColor)}">${escapeHtml(att.groupColor)}</span></td>
            <td class="px-4 py-3 font-mono text-slate-500">${escapeHtml(att.checkedInBy || "Gate Staff")}</td>
          </tr>
        `).join("") || `<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400">No check-ins recorded yet.</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderDeskList() {
  const container = document.getElementById("desk-list");
  if (!deskUsers.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-2">No verification desk accounts created yet.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="min-w-full text-left text-xs bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="border-b border-slate-200 text-slate-700">
          <th class="px-3.5 py-2 font-black">Username</th>
          <th class="px-3.5 py-2 font-black">Staff Member</th>
          <th class="px-3.5 py-2 font-black">Role</th>
          <th class="px-3.5 py-2 font-black">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${deskUsers.map(u => `
          <tr>
            <td class="px-3.5 py-2 font-mono font-bold text-slate-800">${escapeHtml(u.id)}</td>
            <td class="px-3.5 py-2 text-slate-700">${escapeHtml(u.displayName || "")}</td>
            <td class="px-3.5 py-2 text-slate-500">verification_desk</td>
            <td class="px-3.5 py-2">
              <button onclick="window.removeDeskStaff('${u.id}')" class="text-rose-600 font-bold hover:underline">Remove</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
window.removeDeskStaff = async (username) => {
  if (!confirm(`Revoke verification account '${username}'?`)) return;
  const currentUid = sessionStorage.getItem("portalUserId");
  await softDeleteDoc(doc(db, "users", username), currentUid);
  await loadMeetupData();
};

async function handleCreateDeskUser(e, currentUser) {
  e.preventDefault();
  const status = document.getElementById("desk-status");
  const formData = Object.fromEntries(new FormData(e.target));
  const username = formData.username.trim();

  try {
    const userRef = doc(db, "users", username);
    const existing = await getDoc(userRef);
    if (existing.exists() && !existing.data().isDeleted) throw new Error("Username already taken.");

    await setDoc(userRef, {
      displayName: formData.displayName.trim(),
      role: "verification_desk",
      passwordHash: await sha256(formData.password),
      isDeleted: false,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    status.textContent = `Verification staff account '${username}' created.`;
    status.className = "text-xs font-bold text-emerald-700 block";
    e.target.reset();
    await loadMeetupData();
  } catch (err) {
    status.textContent = err.message;
    status.className = "text-xs font-bold text-rose-600 block";
  }
}

async function handleSaveEvent(e, currentUser) {
  e.preventDefault();
  const values = Object.fromEntries(new FormData(e.target));
  await setDoc(doc(collection(db, "meetupEvents")), {
    ...values,
    maxScore: Number(values.maxScore),
    isDeleted: false,
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
    container.innerHTML = `<p class="text-xs text-slate-400 py-2">No competition events added yet.</p>`;
    return;
  }

  container.innerHTML = events.map(ev => `
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 class="font-black text-sm text-slate-900">${escapeHtml(ev.name)}</h4>
        <p class="text-[11px] text-slate-500 font-medium">${ev.eventType} • Max score: ${ev.maxScore}</p>
      </div>
      <div class="flex items-center gap-2">
        <select id="score-team-${ev.id}" class="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs">
          ${colors.map(c => `<option value="${c}">${c.toUpperCase()} Team</option>`).join("")}
        </select>
        <input id="score-val-${ev.id}" type="number" min="0" max="${ev.maxScore}" placeholder="Pts" class="w-16 rounded-xl border border-slate-300 px-2 py-1.5 text-xs" />
        <button onclick="window.recordTeamScore('${ev.id}')" class="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition">Save</button>
      </div>
    </div>
  `).join("");
}
window.recordTeamScore = async (eventId) => {
  const team = document.getElementById(`score-team-${eventId}`).value;
  const pts = Number(document.getElementById(`score-val-${eventId}`).value);
  if (isNaN(pts) || pts < 0) return alert("Enter valid points.");

  const currentUid = sessionStorage.getItem("portalUserId");
  await setDoc(doc(db, "meetupScores", `${eventId}_${team}`), {
    eventId,
    groupColor: team,
    score: pts,
    year: 2026,
    recordedBy: currentUid,
    updatedAt: serverTimestamp()
  });
  alert("Points saved.");
  await loadMeetupData();
};

function renderRanking() {
  const totals = { red: 0, blue: 0, green: 0 };
  scores.forEach(s => {
    if (totals[s.groupColor] !== undefined) totals[s.groupColor] += Number(s.score || 0);
  });

  const ranked = colors.map(c => ({ color: c, score: totals[c] })).sort((a, b) => b.score - a.score);
  const max = Math.max(...ranked.map(r => r.score), 1);

  const colorsStyling = {
    red: "bg-rose-50 border-rose-200 text-rose-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900"
  };

  document.getElementById("ranking-container").innerHTML = `
    <div class="space-y-3">
      ${ranked.map((r, i) => `
        <div class="rounded-2xl border p-4 ${colorsStyling[r.color]}">
          <div class="flex items-center justify-between">
            <span class="font-black text-xs uppercase tracking-wider">#${i + 1}${r.color} Team</span>
            <span class="text-xl font-black">${r.score} pts</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
            <div class="h-full rounded-full bg-current transition-all" style="width: ${Math.round((r.score / max) * 100)}%"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function downloadRegistrationPdf() {
  if (!window.jspdf?.jsPDF) return alert("PDF generator loading, please wait.");
  const filter = document.getElementById("color-filter").value;
  const rows = registrations.filter(r => !filter || r.groupColor === filter);
  const pdf = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  pdf.setFontSize(14);
  pdf.text("Ta'aluf Family Gathering 2026 — Official Register", 10, 15);
  pdf.setFontSize(8);
  pdf.text(`Filtered: ${filter || "All"} | Generated: ${new Date().toLocaleString()}`, 10, 21);

  let y = 30;
  rows.forEach((r, i) => {
    if (y > 275) { pdf.addPage(); y = 20; }
    pdf.text(`${i + 1}. ${r.familyName} Family (${r.groupColor?.toUpperCase()}) — ${r.registrationNo || r.id}`, 10, y);
    y += 7;
  });

  pdf.save(`taaluf-2026-register-${filter || "all"}.pdf`);
}

function badgeColor(c) {
  return { 
    red: "bg-rose-100 text-rose-700", 
    blue: "bg-blue-100 text-blue-700", 
    green: "bg-emerald-100 text-emerald-700" 
  }[String(c).toLowerCase()] || "bg-slate-100 text-slate-700";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}

let isRegistrationOpen = true;

// Add this function to read and render the toggle state
async function loadRegistrationSettings() {
  const pill = document.getElementById("reg-status-pill");
  const desc = document.getElementById("reg-status-desc");
  const indicator = document.getElementById("reg-status-indicator");
  const btn = document.getElementById("btn-toggle-reg-status");

  try {
    const snap = await getDoc(doc(db, "meetupSettings", "current"));
    if (snap.exists()) {
      isRegistrationOpen = snap.data().registrationOpen !== false;
    } else {
      isRegistrationOpen = true;
    }

    if (isRegistrationOpen) {
      indicator.className = "h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse";
      pill.className = "rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200";
      pill.textContent = "Registration Active";
      desc.textContent = "Public forms are open. Families can submit new registrations.";
      btn.className = "rounded-xl px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm";
      btn.textContent = "Close Registration";
    } else {
      indicator.className = "h-2.5 w-2.5 rounded-full bg-rose-500";
      pill.className = "rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200";
      pill.textContent = "Registration Closed";
      desc.textContent = "Portal is locked. Users see a closed notice and cannot submit forms.";
      btn.className = "rounded-xl px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-sm";
      btn.textContent = "Open Registration";
    }
  } catch (err) {
    console.error("Could not load registration settings:", err);
  }
}
