// admin-family-meetup.js
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
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
let isRegistrationOpen = true;
let activeModule = "registrations";
let meetupUnsubscribers = [];

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

  document.title = "Ta'aluf Control Center | Admin";
  app.className = "min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex";

  app.innerHTML = `
    <!-- LEFT SIDEBAR DASHBOARD NAVIGATION -->
    <aside class="w-64 bg-slate-950 text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800 z-30 select-none">
      <div>
        <div class="p-5 border-b border-slate-800/80 flex items-center space-x-3">
          <img src="taaluf.png" alt="Ta'aluf Logo" class="w-9 h-9 object-contain rounded-xl bg-white/5 p-1 border border-white/10" />
          <div>
            <h1 class="font-black text-xs text-white uppercase tracking-wider">Ta'aluf 2026</h1>
            <p class="text-[10px] text-emerald-400 font-semibold">Gathering Center</p>
          </div>
        </div>

        <nav class="p-3 space-y-1 text-xs font-bold">
          <button id="nav-mod-registrations" class="nav-item w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl bg-emerald-700 text-white transition">
            <span>📋</span><span>Registration Roster</span>
          </button>
          <button id="nav-mod-checkedin" class="nav-item w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-900 hover:text-white text-slate-400 transition">
            <span>🎟️</span><span>Live Gate Check-Ins</span>
          </button>
          <button id="nav-mod-scoring" class="nav-item w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-900 hover:text-white text-slate-400 transition">
            <span>🏆</span><span>Scoring & Houses</span>
          </button>
          <button id="nav-mod-volunteers" class="nav-item w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-900 hover:text-white text-slate-400 transition">
            <span>🛡️</span><span>Gate Desks</span>
          </button>
        </nav>
      </div>

      <div class="p-4 border-t border-slate-800/80 space-y-2 bg-slate-950/60">
        <div class="px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-300 truncate">${escapeHtml(currentUser.uid)}</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase">${currentUser.role}</span>
        </div>
        <div class="flex gap-2">
          <button id="btn-back-dashboard" class="flex-1 py-2 text-center rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-bold transition">← Main</button>
          <button id="admin-signout-btn" class="flex-1 py-2 text-center rounded-xl bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 text-xs font-bold transition">Exit</button>
        </div>
      </div>
    </aside>

    <!-- MAIN WORKSPACE CONTENT AREA -->
    <div class="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
      
      <!-- Top Action Bar -->
      <header class="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
        <div class="flex items-center space-x-4">
          <div class="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span id="reg-status-indicator" class="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
            <span id="reg-status-pill" class="text-xs font-black uppercase text-slate-700">Connecting...</span>
            <button id="btn-toggle-reg-status" class="ml-2 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition">
              Switch
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button id="btn-open-importer" class="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 shadow-xs transition">
            <span>📥</span><span>Guest List Importer</span>
          </button>
          <button id="btn-refresh" class="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 transition">
            🔄 Refresh
          </button>
        </div>
      </header>

      <main class="p-6 lg:p-8 space-y-6">

        <!-- KPI Summary Cards -->
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Families</span>
            <p id="stat-registrations" class="text-2xl font-black text-slate-900 mt-1">0</p>
          </div>
          <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Unique Names</span>
            <p id="stat-families" class="text-2xl font-black text-slate-900 mt-1">0</p>
          </div>
          <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Badges</span>
            <p id="stat-members" class="text-2xl font-black text-emerald-700 mt-1">0</p>
          </div>
          <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Checked-in Members</span>
            <p id="stat-checked-in" class="text-2xl font-black text-teal-600 mt-1">0</p>
          </div>
        </section>

        <!-- MODULE 1: REGISTRATIONS VIEW -->
        <section id="module-registrations" class="space-y-4">
          <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 class="text-base font-black text-slate-900">Master Registration Register</h2>
                <p class="text-xs text-slate-500">Live directory of all confirmed and imported family records.</p>
              </div>

              <!-- Module 1 Export Actions -->
              <div class="flex flex-wrap items-center gap-2">
                <select id="color-filter" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600">
                  <option value="">All Color Groups</option>
                  <option value="red">Red Team</option>
                  <option value="blue">Blue Team</option>
                  <option value="green">Green Team</option>
                </select>
                <button id="btn-export-reg-excel" class="rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 text-xs font-black hover:bg-emerald-100 transition">
                  📊 Export Excel
                </button>
                <button id="btn-export-reg-pdf" class="rounded-xl bg-slate-900 text-white px-3.5 py-2 text-xs font-black hover:bg-slate-800 transition">
                  📄 Export PDF
                </button>
              </div>
            </div>

            <div id="registration-table" class="overflow-x-auto"></div>
          </div>
        </section>

        <!-- MODULE 2: FAMILY-WISE CHECKED-IN LIVE FEED -->
        <section id="module-checkedin" class="hidden space-y-4">
          <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-100">
              <div>
                <h2 class="text-base font-black text-slate-900">Family Gate Check-in Summary</h2>
                <p class="text-xs text-slate-500">Verified entry log. Accidental check-ins can be reversed below.</p>
              </div>
              <!-- Module 2 Export Actions -->
              <div class="flex items-center gap-2">
                <button id="btn-export-chk-excel" class="rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 text-xs font-black hover:bg-emerald-100 transition">
                  📊 Export Checked (Excel)
                </button>
                <button id="btn-export-chk-pdf" class="rounded-xl bg-emerald-800 text-white px-3.5 py-2 text-xs font-black hover:bg-emerald-900 transition">
                  📄 Export Checked (PDF)
                </button>
              </div>
            </div>

            <div id="checked-in-table" class="overflow-x-auto"></div>
          </div>
        </section>

        <!-- MODULE 3: SCORING & LEADERBOARD -->
        <section id="module-scoring" class="hidden grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div class="flex justify-between items-center">
              <div>
                <h2 class="text-base font-black text-slate-900">Events & Live Points</h2>
                <p class="text-xs text-slate-500">Score competition programs.</p>
              </div>
              <button id="btn-toggle-event" class="rounded-xl bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-800 transition">Add Event</button>
            </div>
            <form id="event-creation-form" class="hidden grid gap-2 sm:grid-cols-5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <input name="name" required placeholder="Event Name" class="sm:col-span-2 p-2 rounded-xl border border-slate-300 text-xs" />
              <select name="eventType" class="p-2 rounded-xl border border-slate-300 text-xs"><option value="group">Group</option><option value="solo">Solo</option></select>
              <select name="groupColor" class="p-2 rounded-xl border border-slate-300 text-xs">
                <option value="all">All Groups</option><option value="red">Red</option><option value="blue">Blue</option><option value="green">Green</option>
              </select>
              <input name="maxScore" type="number" min="1" required placeholder="Max" class="p-2 rounded-xl border border-slate-300 text-xs" />
              <button class="sm:col-span-5 p-2 bg-slate-900 text-white text-xs font-bold rounded-xl">Save Program</button>
            </form>
            <div id="event-list" class="space-y-2"></div>
          </div>
          <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h2 class="text-base font-black text-slate-900">Team Standings</h2>
            <div id="ranking-container" class="space-y-3"></div>
          </div>
        </section>

        <!-- MODULE 4: GATE VOLUNTEER ACCOUNTS -->
        <section id="module-volunteers" class="hidden space-y-4">
          <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 class="text-base font-black text-slate-900">Gate Verification Desks</h2>
                <p class="text-xs text-slate-500">Accounts for staff verifying QR passes at entry gates.</p>
              </div>
              <div class="flex gap-2">
                <input id="desk-link-url" readonly class="p-2 rounded-xl border border-slate-300 text-xs font-mono w-60 bg-slate-50" />
                <button id="btn-copy-desk" class="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl">Copy Link</button>
              </div>
            </div>
            <form id="desk-user-form" class="grid gap-2 sm:grid-cols-4 pt-2">
              <input name="username" required placeholder="Username (gate01)" class="p-2.5 rounded-xl border border-slate-300 text-xs" />
              <input name="displayName" required placeholder="Volunteer Name" class="p-2.5 rounded-xl border border-slate-300 text-xs" />
              <input name="password" required type="password" minlength="6" placeholder="Password" class="p-2.5 rounded-xl border border-slate-300 text-xs" />
              <button class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl py-2.5">Create Staff Account</button>
            </form>
            <p id="desk-status" class="text-xs font-bold hidden"></p>
            <div id="desk-list" class="overflow-x-auto pt-2"></div>
          </div>
        </section>

      </main>
    </div>

    <!-- POPUP MODAL: GUEST LIST SPREADSHEET IMPORTER -->
    <div id="importer-modal" class="hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 class="text-sm font-black uppercase text-slate-900 flex items-center gap-2"><span>📥</span> Spreadsheet Guest List Importer</h3>
            <p class="text-xs text-slate-500">Upload bulk attendee registers (.xlsx or .csv)</p>
          </div>
          <button id="btn-close-importer" class="p-2 text-slate-400 hover:text-slate-800 rounded-xl">✕</button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <div class="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div>
              <p class="text-xs font-black text-emerald-950">Select your spreadsheet file</p>
              <p class="text-[11px] text-emerald-800">Must include Family Name and Mobile headers.</p>
            </div>
            <div class="flex gap-2">
              <button id="btn-download-sample-csv" type="button" class="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-emerald-900 text-xs font-bold">Sample CSV</button>
              <label class="cursor-pointer px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs">
                Browse File
                <input type="file" id="bulk-csv-input" accept=".csv, .xlsx, .xls" class="hidden" />
              </label>
            </div>
          </div>

          <div id="bulk-preview-area" class="hidden space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span id="preview-filename" class="font-bold text-slate-800"></span>
              <span id="preview-stats" class="text-slate-500"></span>
            </div>
            <div id="preview-table" class="border border-slate-200 rounded-xl overflow-x-auto max-h-48 text-xs"></div>
          </div>
        </div>

        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button id="btn-cancel-import" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700">Cancel</button>
          <button id="btn-execute-import" disabled class="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2">
            <span>Execute Batch Import</span>
            <span id="import-spinner" class="hidden animate-spin">⏳</span>
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: ATTENDEE EDITING / CREDENTIALS -->
    <div id="attendee-details-modal" class="hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span class="text-[10px] font-black uppercase text-emerald-700">Family Pass Details</span>
            <h3 id="modal-family-name" class="text-base font-black text-slate-900"></h3>
            <p id="modal-reg-id" class="text-[11px] font-mono text-slate-500"></p>
          </div>
          <button id="btn-close-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div id="modal-attendees-list" class="p-5 overflow-y-auto space-y-3"></div>
        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button id="btn-done-modal" class="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">Done</button>
        </div>
      </div>
    </div>
  `;

  attachMeetupEvents(currentUser);
  startLiveMeetupData();
}

// -------------------------------------------------------------
// NAVIGATION & EVENT LISTENERS
// -------------------------------------------------------------
function attachMeetupEvents(currentUser) {
  const modules = ["registrations", "checkedin", "scoring", "volunteers"];
  modules.forEach(m => {
    document.getElementById(`nav-mod-${m}`)?.addEventListener("click", () => {
      modules.forEach(other => {
        document.getElementById(`module-${other}`).classList.add("hidden");
        const btn = document.getElementById(`nav-mod-${other}`);
        btn.className = "nav-item w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-900 hover:text-white text-slate-400 transition";
      });
      document.getElementById(`module-${m}`).classList.remove("hidden");
      const activeBtn = document.getElementById(`nav-mod-${m}`);
      activeBtn.className = "nav-item w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl bg-emerald-700 text-white transition";
      activeModule = m;
    });
  });

  document.getElementById("btn-back-dashboard")?.addEventListener("click", () => {
    stopLiveMeetupListeners();
    window.navigate("dashboard");
  });

  document.getElementById("admin-signout-btn")?.addEventListener("click", () => {
    stopLiveMeetupListeners();
    sessionStorage.clear();
    window.navigate("login");
  });

  // Importer Popup Actions
  document.getElementById("btn-open-importer")?.addEventListener("click", () => {
    document.getElementById("importer-modal").classList.remove("hidden");
  });
  document.getElementById("btn-close-importer")?.addEventListener("click", cancelPendingImport);
  document.getElementById("btn-cancel-import")?.addEventListener("click", cancelPendingImport);
  document.getElementById("bulk-csv-input")?.addEventListener("change", handleFileSelected);
  document.getElementById("btn-execute-import")?.addEventListener("click", () => executeBulkImport(currentUser));

  document.getElementById("btn-refresh")?.addEventListener("click", () => {
    startLiveMeetupData();
    alert("Live listeners synchronized.");
  });

  document.getElementById("color-filter")?.addEventListener("change", renderRegistrationTable);
  
  // MODULE 1 EXPORTS
  document.getElementById("btn-export-reg-excel")?.addEventListener("click", () => {
    const f = (document.getElementById("color-filter")?.value || "").toLowerCase().trim();
    const filtered = registrations.filter(r => !f || String(r.groupColor || "").toLowerCase().trim() === f);
    exportRegistrationsExcel(filtered, attendees, f || "All");
  });

  document.getElementById("btn-export-reg-pdf")?.addEventListener("click", () => {
    const f = (document.getElementById("color-filter")?.value || "").toLowerCase().trim();
    const filtered = registrations.filter(r => !f || String(r.groupColor || "").toLowerCase().trim() === f);
    exportRegistrationsPdf(filtered, attendees, f || "All");
  });

  // MODULE 2 EXPORTS (CHECKED IN GUESTS)
  document.getElementById("btn-export-chk-excel")?.addEventListener("click", () => {
    exportCheckedInExcel(registrations, attendees);
  });

  document.getElementById("btn-export-chk-pdf")?.addEventListener("click", () => {
    exportCheckedInPdf(registrations, attendees);
  });

  // Portal Registration toggle
  document.getElementById("btn-toggle-reg-status")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-toggle-reg-status");
    btn.disabled = true;
    try {
      const next = !isRegistrationOpen;
      await safeUpdateDoc(doc(db, "meetupSettings", "current"), {
        registrationOpen: next,
        updatedAt: serverTimestamp()
      }, currentUser.uid);
      isRegistrationOpen = next;
      updateRegistrationStatusUI();
    } catch (e) {
      alert("Status toggle error: " + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  const deskUrl = new URL("./index.html?view=verification-desk", window.location.href).href;
  const deskInput = document.getElementById("desk-link-url");
  if (deskInput) deskInput.value = deskUrl;
  document.getElementById("btn-copy-desk")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(deskUrl);
    alert("Verification desk URL copied!");
  });

  document.getElementById("btn-toggle-event")?.addEventListener("click", () => {
    document.getElementById("event-creation-form").classList.toggle("hidden");
  });
  document.getElementById("event-creation-form")?.addEventListener("submit", (e) => handleSaveEvent(e, currentUser));
  document.getElementById("desk-user-form")?.addEventListener("submit", (e) => handleCreateDeskUser(e, currentUser));

  document.getElementById("btn-close-modal")?.addEventListener("click", closeFamilyDetailsModal);
  document.getElementById("btn-done-modal")?.addEventListener("click", closeFamilyDetailsModal);

  document.getElementById("btn-download-sample-csv")?.addEventListener("click", () => {
    const headers = ["Family Name", "Mobile", "Adults (12+ yrs) - Names", "Children (5-12 yrs) - Names", "Infants (below 5 yrs) - Names", "Group Color"];
    const rows = [
      ['Rafi Hudawi', '7736716281', 'Rafi Hudawi; Safna.C', '', 'Nazwan', 'red'],
      ['Abid', '6364344895', 'Abid; Ayesha', 'Maiza', 'Munaiza; Maznah', 'green']
    ];
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "taaluf_sample_register.csv";
    a.click();
  });
}

// -------------------------------------------------------------
// REAL-TIME FIRESTORE LISTENERS
// -------------------------------------------------------------
export function stopLiveMeetupListeners() {
  meetupUnsubscribers.forEach(unsub => {
    if (typeof unsub === "function") unsub();
  });
  meetupUnsubscribers = [];
}

export function startLiveMeetupData() {
  stopLiveMeetupListeners();

  const unsubSettings = onSnapshot(doc(db, "meetupSettings", "current"), (snap) => {
    if (snap.exists()) {
      isRegistrationOpen = snap.data().registrationOpen !== false;
    } else {
      isRegistrationOpen = true;
    }
    updateRegistrationStatusUI();
  }, (err) => console.warn("Settings listener:", err));
  meetupUnsubscribers.push(unsubSettings);

  const qReg = query(collection(db, "meetupRegistrations"), where("isDeleted", "!=", true));
  const unsubReg = onSnapshot(qReg, (snap) => {
    registrations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats();
    renderRegistrationTable();
    renderCheckedInTable();
  }, (err) => console.error("Realtime Registrations:", err));
  meetupUnsubscribers.push(unsubReg);

  const qAtt = query(collection(db, "meetupAttendees"), where("isDeleted", "!=", true));
  const unsubAtt = onSnapshot(qAtt, (snap) => {
    attendees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats();
    renderRegistrationTable();
    renderCheckedInTable();
  }, (err) => console.error("Realtime Attendees:", err));
  meetupUnsubscribers.push(unsubAtt);

  const qScores = collection(db, "meetupScores");
  const unsubScores = onSnapshot(qScores, (snap) => {
    scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRanking();
  }, (err) => console.error("Realtime Scores:", err));
  meetupUnsubscribers.push(unsubScores);

  const qEvents = query(collection(db, "meetupEvents"), where("isDeleted", "!=", true));
  const unsubEvents = onSnapshot(qEvents, (snap) => {
    events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEvents();
  }, (err) => console.error("Realtime Events:", err));
  meetupUnsubscribers.push(unsubEvents);

  const qUsers = query(collection(db, "users"), where("isDeleted", "!=", true));
  const unsubUsers = onSnapshot(qUsers, (snap) => {
    deskUsers = snap.docs
      .filter(d => d.data().role === "verification_desk")
      .map(d => ({ id: d.id, ...d.data() }));
    renderDeskList();
  }, (err) => console.error("Realtime Desk Users:", err));
  meetupUnsubscribers.push(unsubUsers);
}

function updateRegistrationStatusUI() {
  const pill = document.getElementById("reg-status-pill");
  const indicator = document.getElementById("reg-status-indicator");
  if (!pill || !indicator) return;

  if (isRegistrationOpen) {
    indicator.className = "h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse";
    pill.className = "text-xs font-black uppercase text-emerald-800";
    pill.textContent = "Open";
  } else {
    indicator.className = "h-2.5 w-2.5 rounded-full bg-rose-500";
    pill.className = "text-xs font-black uppercase text-rose-800";
    pill.textContent = "Closed";
  }
}

function renderStats() {
  const elRegs = document.getElementById("stat-registrations");
  const elFams = document.getElementById("stat-families");
  const elMems = document.getElementById("stat-members");
  const elChkd = document.getElementById("stat-checked-in");

  if (elRegs) elRegs.textContent = registrations.length;
  if (elFams) elFams.textContent = new Set(registrations.map(r => r.familyName)).size;
  if (elMems) elMems.textContent = attendees.length;
  if (elChkd) elChkd.textContent = attendees.filter(a => a.status === "checked_in").length;
}

// -------------------------------------------------------------
// MODULE 1: REGISTRATIONS TABLE
// -------------------------------------------------------------
function renderRegistrationTable() {
  const container = document.getElementById("registration-table");
  if (!container) return;

  const filter = (document.getElementById("color-filter")?.value || "").toLowerCase().trim();
  const rows = registrations.filter(r => !filter || String(r.groupColor || "").toLowerCase().trim() === filter);

  const { rows: gridRows, summary } = calculateGridData(rows, attendees);

  const bodyHtml = gridRows.map((r, idx) => `
    <tr class="hover:bg-slate-50/80 transition text-xs border-b border-slate-100">
      <td class="p-3 font-mono text-slate-400">${idx + 1}</td>
      <td class="p-3 font-bold text-slate-900">${escapeHtml(r.family)}</td>
      <td class="p-3 font-mono text-slate-600">${escapeHtml(r.mobile)}</td>
      <td class="p-3 font-mono text-slate-400 text-[11px]">${escapeHtml(r.id)}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeColor(r.rawTeam)}">${escapeHtml(r.rawTeam)}</span></td>
      <td class="p-3 font-mono text-center text-slate-700">${r.cAdults}</td>
      <td class="p-3 font-mono text-center text-slate-700">${r.cChildren}</td>
      <td class="p-3 font-mono text-center text-slate-700">${r.cInfants}</td>
      <td class="p-3 font-mono text-center font-bold text-emerald-700">${r.checked}</td>
      <td class="p-3 font-mono text-center font-black text-slate-900 bg-slate-50/50">${r.rowTotal}</td>
      <td class="p-3 text-right">
        <div class="inline-flex gap-1.5">
          <button data-view-id="${r.rawId}" class="btn-view-reg p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-white border border-transparent hover:border-slate-200">🔍</button>
          <button data-del-id="${r.rawId}" class="btn-del-reg p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 font-bold">✕</button>
        </div>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <table class="min-w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
          <th class="p-3 font-black">#</th>
          <th class="p-3 font-black">Family</th>
          <th class="p-3 font-black">Mobile</th>
          <th class="p-3 font-black">Pass ID</th>
          <th class="p-3 font-black">Team</th>
          <th class="p-3 font-black text-center">12+</th>
          <th class="p-3 font-black text-center">5-12</th>
          <th class="p-3 font-black text-center">&lt;5</th>
          <th class="p-3 font-black text-center text-emerald-800">Checked</th>
          <th class="p-3 font-black text-center bg-slate-100/60">Row Total</th>
          <th class="p-3 font-black text-right">Actions</th>
        </tr>
      </thead>
      <tbody>${bodyHtml || '<tr><td colspan="11" class="text-center py-8 text-slate-400">No records found.</td></tr>'}</tbody>
      <tfoot class="bg-slate-50 border-t-2 border-slate-200 text-xs font-black text-slate-900">
        <tr>
          <td colspan="5" class="p-3 text-right uppercase tracking-wider">Vertical Column Totals:</td>
          <td class="p-3 text-center font-mono">${summary.grandAdults}</td>
          <td class="p-3 text-center font-mono">${summary.grandChildren}</td>
          <td class="p-3 text-center font-mono">${summary.grandInfants}</td>
          <td class="p-3 text-center font-mono text-emerald-800">${summary.grandChecked}</td>
          <td class="p-3 text-center font-mono text-sm bg-slate-200/50">${summary.grandTotal}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;

  document.querySelectorAll(".btn-view-reg").forEach(b => b.onclick = () => openFamilyDetailsModal(b.dataset.viewId));
  document.querySelectorAll(".btn-del-reg").forEach(b => b.onclick = () => handleDeleteRegistration(b.dataset.delId));
}

// -------------------------------------------------------------
// MODULE 2: CHECKED-IN LIVE FEED
// -------------------------------------------------------------
function renderCheckedInTable() {
  const container = document.getElementById("checked-in-table");
  if (!container) return;

  const familiesWithAttendance = registrations.map(reg => {
    const fMembers = attendees.filter(a => String(a.registrationId || "").trim() === String(reg.id || reg.registrationNo || "").trim());
    const checkedMembers = fMembers.filter(a => a.status === "checked_in");
    return {
      reg,
      totalCount: fMembers.length || Number(reg.totalAttendees || 0),
      checkedCount: checkedMembers.length || Number(reg.checkedInCount || 0),
      checkedMembers
    };
  }).filter(item => item.checkedCount > 0);

  if (!familiesWithAttendance.length) {
    container.innerHTML = `<p class="py-12 text-center text-xs text-slate-400">No verified check-ins at reception yet.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="min-w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-700">
          <th class="p-3 font-black">#</th>
          <th class="p-3 font-black">Family Reference</th>
          <th class="p-3 font-black">Team</th>
          <th class="p-3 font-black">Gate Verified</th>
          <th class="p-3 font-black">Checked Members</th>
          <th class="p-3 font-black text-right">Mistake Rollback</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${familiesWithAttendance.map((item, idx) => `
          <tr class="hover:bg-slate-50/80 transition">
            <td class="p-3 font-mono text-slate-400">${idx + 1}</td>
            <td class="p-3 font-bold text-slate-900">${escapeHtml(item.reg.familyName)} Family</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeColor(item.reg.groupColor)}">${escapeHtml(item.reg.groupColor)}</span></td>
            <td class="p-3 font-mono font-bold text-emerald-800">${item.checkedCount} /${item.totalCount} Present</td>
            <td class="p-3 text-slate-500 max-w-xs truncate">${item.checkedMembers.map(m => escapeHtml(m.memberName || "Member")).join(", ") || "General Attendees"}</td>
            <td class="p-3 text-right">
              <button onclick="window.revertFamilyCheckin('${item.reg.id}')" class="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 text-[11px] font-bold transition">
                Undo All
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

window.revertFamilyCheckin = async (regId) => {
  if (!confirm("Reset gate check-ins for this entire family back to Pending?")) return;
  const staff = sessionStorage.getItem("portalUserId") || "admin";
  try {
    const fMembers = attendees.filter(a => String(a.registrationId || "").trim() === String(regId).trim() && a.status === "checked_in");
    await Promise.all(fMembers.map(m => safeUpdateDoc(doc(db, "meetupAttendees", m.id), {
      status: "pending",
      checkedInAt: null,
      checkedInBy: null
    }, staff)));

    await safeUpdateDoc(doc(db, "meetupRegistrations", regId), {
      checkedInCount: 0,
      lastVerifiedAt: serverTimestamp()
    }, staff);

    alert("Check-in reset successfully.");
  } catch (err) {
    alert("Revert error: " + err.message);
  }
};

// -------------------------------------------------------------
// UNIFIED DATA CALCULATION ENGINE
// -------------------------------------------------------------
function calculateGridData(rows = [], attendeesList = []) {
  let grandAdults = 0;
  let grandChildren = 0;
  let grandInfants = 0;
  let grandChecked = 0;
  let grandTotal = 0;

  const dataRows = (rows || []).map((r, idx) => {
    const regId = String(r.id || r.registrationNo || "").trim();

    const fMembers = (attendeesList || []).filter(a => {
      const aRegId = String(a.registrationId || "").trim();
      return aRegId === regId || (regId && a.id && String(a.id).startsWith(regId));
    });

    const parseNames = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field.map(n => String(n).trim()).filter(Boolean);
      return String(field).split(/[\n;,]+/).map(n => n.trim()).filter(Boolean);
    };

    const adultNames = fMembers.length 
      ? fMembers.filter(a => a.category === "above12").map(a => a.memberName || "Guest").filter(Boolean)
      : parseNames(r.membersAbove12 || r["Adults (12+ yrs) - Names"]);

    const childNames = fMembers.length 
      ? fMembers.filter(a => a.category === "age5to12" || a.category === "5to12").map(a => a.memberName || "Guest").filter(Boolean)
      : parseNames(r.members5to12 || r["Children (5-12 yrs) - Names"]);

    const infantNames = fMembers.length 
      ? fMembers.filter(a => a.category === "below5").map(a => a.memberName || "Guest").filter(Boolean)
      : parseNames(r.membersBelow5 || r["Infants (below 5 yrs) - Names"]);

    let cAdults = adultNames.length || Number(r.attendeeCounts?.above12 || 0);
    let cChildren = childNames.length || Number(r.attendeeCounts?.age5to12 || 0);
    let cInfants = infantNames.length || Number(r.attendeeCounts?.below5 || 0);

    const checked = fMembers.filter(a => a.status === "checked_in").length || Number(r.checkedInCount || 0);
    const rowTotal = (cAdults + cChildren + cInfants) || fMembers.length || Number(r.totalAttendees || 1);

    grandAdults += cAdults;
    grandChildren += cChildren;
    grandInfants += cInfants;
    grandChecked += checked;
    grandTotal += rowTotal;

    return {
      slNo: idx + 1,
      rawId: r.id,
      id: r.registrationNo || r.id || `REG2026-${String(idx + 1).padStart(3, "0")}`,
      family: r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family",
      cAdults,
      cChildren,
      cInfants,
      checked,
      rowTotal,
      rawTeam: r.groupColor || "general",
      team: (r.groupColor || "general").toUpperCase(),
      mobile: r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "-"
    };
  });

  return {
    rows: dataRows,
    summary: {
      grandAdults,
      grandChildren,
      grandInfants,
      grandChecked,
      grandTotal
    }
  };
}

// -------------------------------------------------------------
// MODULE 1 EXPORTS: FULL REGISTRATION ROSTER
// -------------------------------------------------------------
function exportRegistrationsExcel(rows = [], attendeesList = [], filterName = "All") {
  if (!window.XLSX) return alert("Excel library is loading, please wait.");
  if (!rows.length) return alert("No records available to export.");

  const { rows: gridRows, summary } = calculateGridData(rows, attendeesList);

  const excelData = gridRows.map(r => ({
    "S.No": r.slNo,
    "Family Reference Name": r.family,
    "Mobile Number": r.mobile,
    "Adults (12+)": r.cAdults,
    "Children (5-12)": r.cChildren,
    "Infants (<5)": r.cInfants,
    "Total Passes": r.rowTotal,
    "Team Color": r.team,
    "Checked-in Gate": r.checked
  }));

  excelData.push({
    "S.No": "TOTAL",
    "Family Reference Name": `Grand Total (${gridRows.length} Families)`,
    "Mobile Number": "",
    "Adults (12+)": summary.grandAdults,
    "Children (5-12)": summary.grandChildren,
    "Infants (<5)": summary.grandInfants,
    "Total Passes": summary.grandTotal,
    "Team Color": "",
    "Checked-in Gate": summary.grandChecked
  });

  const ws = window.XLSX.utils.json_to_sheet(excelData);
  ws["!cols"] = [{ wch: 6 }, { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Attendance Summary");
  window.XLSX.writeFile(wb, `Taaluf_2026_Register_${filterName}.xlsx`);
}

function exportRegistrationsPdf(rows = [], attendeesList = [], filterName = "All") {
  if (!window.jspdf?.jsPDF) return alert("PDF library is loading, please wait.");
  if (!rows.length) return alert("No records available to export.");

  const { rows: gridRows, summary } = calculateGridData(rows, attendeesList);
  const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top emerald banner
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Gold divider
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 28, pageWidth, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("TA'ALUF FAMILY GATHERING 2026", pageWidth / 2, 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(167, 243, 208);
  doc.text("IZZATHUL ISLAM MADRASA • TOGETHERNESS • HARMONY • BARAKAH", pageWidth / 2, 17, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  doc.text("Venue: Khedda Resort, Kanakapura Road  |  Date: 27 September 2026", pageWidth / 2, 23, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`REGISTER REPORT: ${filterName.toUpperCase()} TEAMS`, 14, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Families: ${gridRows.length}  |  Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 36, { align: "right" });

  const tableHead = [["Sl", "Family Reference Name", "12+", "5-12", "<5", "Total", "Team Color"]];
  const tableBody = gridRows.map(r => [r.slNo, r.family, r.cAdults, r.cChildren, r.cInfants, r.rowTotal, r.team]);
  const tableFoot = [["TOTAL", `Grand Total (${gridRows.length} Families)`, summary.grandAdults, summary.grandChildren, summary.grandInfants, summary.grandTotal, ""]];

  if (!doc.autoTable) return alert("AutoTable extension not ready.");
const autoTableFn = doc.autoTable || window.jspdf?.jsPDF?.API?.autoTable;

if (typeof autoTableFn === "function") {
  doc.autoTable({
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    startY: 40,
    theme: "grid",
    // ... rest of your styles
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, halign: "center", valign: "middle" },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 2.5, valign: "middle" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    footStyles: { fillColor: [236, 253, 245], textColor: [6, 78, 59], fontStyle: "bold", fontSize: 9, halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: "auto", fontStyle: "bold" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 20, halign: "center", fontStyle: "bold", fillColor: [241, 245, 249] },
      6: { cellWidth: 26, halign: "center", fontStyle: "bold" }
    },
    didParseCell: function(data) {
      if (data.section === "body" && data.column.index === 6) {
        const val = String(data.cell.raw || "").toLowerCase();
        if (val.includes("red")) {
          data.cell.styles.fillColor = [255, 228, 230];
          data.cell.styles.textColor = [190, 18, 60];
        } else if (val.includes("blue")) {
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.textColor = [29, 78, 216];
        } else if (val.includes("green")) {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [4, 120, 87];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 14 }
  
  });
} else {
  alert("PDF AutoTable plugin is still loading or blocked. Please refresh the page.");
  return;
}
  doc.autoTablejk({
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    startY: 40,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, halign: "center", valign: "middle" },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 2.5, valign: "middle" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    footStyles: { fillColor: [236, 253, 245], textColor: [6, 78, 59], fontStyle: "bold", fontSize: 9, halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: "auto", fontStyle: "bold" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 20, halign: "center", fontStyle: "bold", fillColor: [241, 245, 249] },
      6: { cellWidth: 26, halign: "center", fontStyle: "bold" }
    },
    didParseCell: function(data) {
      if (data.section === "body" && data.column.index === 6) {
        const val = String(data.cell.raw || "").toLowerCase();
        if (val.includes("red")) {
          data.cell.styles.fillColor = [255, 228, 230];
          data.cell.styles.textColor = [190, 18, 60];
        } else if (val.includes("blue")) {
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.textColor = [29, 78, 216];
        } else if (val.includes("green")) {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [4, 120, 87];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 14 }
  });

  doc.save(`Taaluf_2026_Family_Summary_${filterName}.pdf`);
}

// -------------------------------------------------------------
// MODULE 2 EXPORTS: CHECKED-IN ENTRY LOG
// -------------------------------------------------------------
function exportCheckedInExcel(regList = [], attendeesList = []) {
  if (!window.XLSX) return alert("Excel library is loading, please wait.");

  const checkedFamilies = regList.map(reg => {
    const fMembers = attendeesList.filter(a => String(a.registrationId || "").trim() === String(reg.id || reg.registrationNo || "").trim());
    const checkedMembers = fMembers.filter(a => a.status === "checked_in");
    return {
      reg,
      totalCount: fMembers.length || Number(reg.totalAttendees || 0),
      checkedCount: checkedMembers.length || Number(reg.checkedInCount || 0),
      memberNames: checkedMembers.map(m => m.memberName || "Member").join(", ") || "General Attendees"
    };
  }).filter(item => item.checkedCount > 0);

  if (!checkedFamilies.length) return alert("No checked-in families found to export.");

  let grandChecked = 0;
  let grandTotal = 0;

  const excelData = checkedFamilies.map((item, idx) => {
    grandChecked += item.checkedCount;
    grandTotal += item.totalCount;
    return {
      "S.No": idx + 1,
      "Family Name": `${item.reg.familyName} Family`,
      "Team Color": (item.reg.groupColor || "general").toUpperCase(),
      "Present Count": item.checkedCount,
      "Total Registered": item.totalCount,
      "Verified Member Names": item.memberNames
    };
  });

  excelData.push({
    "S.No": "TOTAL",
    "Family Name": `Verified Families: ${checkedFamilies.length}`,
    "Team Color": "",
    "Present Count": grandChecked,
    "Total Registered": grandTotal,
    "Verified Member Names": ""
  });

  const ws = window.XLSX.utils.json_to_sheet(excelData);
  ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 45 }];
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Checked In Log");
  window.XLSX.writeFile(wb, `Taaluf_2026_Gate_CheckedIn.xlsx`);
}

function exportCheckedInPdf(regList = [], attendeesList = []) {
  if (!window.jspdf?.jsPDF) return alert("PDF library is loading, please wait.");

  const checkedFamilies = regList.map(reg => {
    const fMembers = attendeesList.filter(a => String(a.registrationId || "").trim() === String(reg.id || reg.registrationNo || "").trim());
    const checkedMembers = fMembers.filter(a => a.status === "checked_in");
    return {
      reg,
      totalCount: fMembers.length || Number(reg.totalAttendees || 0),
      checkedCount: checkedMembers.length || Number(reg.checkedInCount || 0),
      memberNames: checkedMembers.map(m => m.memberName || "Member").join(", ") || "General Attendees"
    };
  }).filter(item => item.checkedCount > 0);

  if (!checkedFamilies.length) return alert("No checked-in families found to export.");

  let grandChecked = 0;
  let grandTotal = 0;

  const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("GATE VERIFICATION FEED — TA'ALUF 2026", pageWidth / 2, 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(167, 243, 208);
  doc.text("OFFICIAL ATTENDANCE ENTRY REGISTER", pageWidth / 2, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("VERIFIED FAMILY ENTRIES", 14, 33);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Families Checked-in: ${checkedFamilies.length}  |  ${new Date().toLocaleString()}`, pageWidth - 14, 33, { align: "right" });

  const tableHead = [["Sl", "Family Name", "Team", "Gate In", "Total", "Verified Attendees"]];
  const tableBody = checkedFamilies.map((item, idx) => {
    grandChecked += item.checkedCount;
    grandTotal += item.totalCount;
    return [
      idx + 1,
      `${item.reg.familyName} Family`,
      (item.reg.groupColor || "general").toUpperCase(),
      item.checkedCount,
      item.totalCount,
      item.memberNames
    ];
  });

  const tableFoot = [["TOTAL", `Verified Families: ${checkedFamilies.length}`, "", grandChecked, grandTotal, ""]];

  if (!doc.autoTable) return alert("AutoTable extension not ready.");

  doc.autoTable({
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    startY: 37,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 2 },
    footStyles: { fillColor: [236, 253, 245], textColor: [6, 78, 59], fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 38, fontStyle: "bold" },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 16, halign: "center", fontStyle: "bold", textColor: [4, 120, 87] },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: "auto" }
    },
    didParseCell: function(data) {
      if (data.section === "body" && data.column.index === 2) {
        const val = String(data.cell.raw || "").toLowerCase();
        if (val.includes("red")) data.cell.styles.textColor = [190, 18, 60];
        if (val.includes("blue")) data.cell.styles.textColor = [29, 78, 216];
        if (val.includes("green")) data.cell.styles.textColor = [4, 120, 87];
      }
    },
    margin: { left: 14, right: 14, bottom: 14 }
  });

  doc.save(`Taaluf_2026_Gate_CheckedIn.pdf`);
}

// -------------------------------------------------------------
// SPREADSHEET IMPORTER LOGIC
// -------------------------------------------------------------
async function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

    pendingUploadRows = raw.filter(r => {
      const name = r.familyName || r["Family Name"] || r["Family (Reference Name)"];
      return Boolean(name) && String(name).toLowerCase() !== "total";
    });

    document.getElementById("bulk-preview-area").classList.remove("hidden");
    document.getElementById("preview-filename").textContent = file.name;
    document.getElementById("preview-stats").textContent = `${pendingUploadRows.length} valid rows identified.`;
    document.getElementById("btn-execute-import").disabled = false;

    document.getElementById("preview-table").innerHTML = `
      <table class="min-w-full text-left bg-white divide-y divide-slate-100">
        <thead class="bg-slate-100 text-slate-700 font-black">
          <tr><th class="p-2">Family</th><th class="p-2">Mobile</th><th class="p-2">12+</th><th class="p-2">5-12</th><th class="p-2">&lt;5</th></tr>
        </thead>
        <tbody>
          ${pendingUploadRows.slice(0, 4).map(r => `
            <tr>
              <td class="p-2 font-bold">${r.familyName || r["Family Name"] || r["Family (Reference Name)"]}</td>
              <td class="p-2 font-mono">${r.mobileNo || r["Contact Number 1"] || r["Mobile"]}</td>
              <td class="p-2 truncate max-w-[120px]">${r.membersAbove12 || r["Adults (12+ yrs) - Names"] || "-"}</td>
              <td class="p-2 truncate max-w-[120px]">${r.members5to12 || r["Children (5-12 yrs) - Names"] || "-"}</td>
              <td class="p-2 truncate max-w-[120px]">${r.membersBelow5 || r["Infants (below 5 yrs) - Names"] || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    alert("Parsing failed: " + err.message);
  }
}

function cancelPendingImport() {
  pendingUploadRows = [];
  document.getElementById("importer-modal").classList.add("hidden");
  document.getElementById("bulk-preview-area").classList.add("hidden");
  document.getElementById("bulk-csv-input").value = "";
  document.getElementById("btn-execute-import").disabled = true;
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
      const sno = r.sno || r["S.No"] || (imported + 1);
      const regNo = String(r.registrationNo || `REG2026-${String(sno).padStart(3, "0")}`).trim();
      const rawMobile = String(r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "").replace(/\D/g, "");
      const mobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;
      if (!mobile) continue;

      const familyName = String(r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family").trim();
      const groupColor = String(r.groupColor || colors[imported % 3]).toLowerCase().trim();
      const defaultPassword = mobile.length >= 6 ? mobile.slice(-6) : "123456";
      const hashedPass = await sha256(defaultPassword);

      const rawFamilyToken = generateSecureToken(24);
      const masterTokenHash = await sha256(rawFamilyToken);

      const mappings = [
        { field: r.membersAbove12 || r["Adults (12+ yrs) - Names"], cat: "above12" },
        { field: r.members5to12 || r["Children (5-12 yrs) - Names"], cat: "age5to12" },
        { field: r.membersBelow5 || r["Infants (below 5 yrs) - Names"], cat: "below5" }
      ];

      const attendeeList = [];
      for (const { field, cat } of mappings) {
        if (!field) continue;
        const names = String(field).split(/[\n;,]+/).map(n => n.trim()).filter(Boolean);
        names.forEach(name => attendeeList.push({ name, cat }));
      }

      await setDoc(doc(db, "meetupRegistrations", regNo), {
        registrationNo: regNo,
        familyName,
        mobileNo: mobile,
        passwordHash: hashedPass,
        dobHash: "",
        defaultPassword,
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

      for (let i = 0; i < attendeeList.length; i++) {
        const item = attendeeList[i];
        await setDoc(doc(db, "meetupAttendees", `${regNo}_att_${i + 1}`), {
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
  } catch (err) {
    alert("Bulk error: " + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add("hidden");
  }
}

// -------------------------------------------------------------
// MODAL DETAILS & MEMBER ROSTER EDITING
// -------------------------------------------------------------
function openFamilyDetailsModal(regId) {
  const reg = registrations.find(r => r.id === regId);
  if (!reg) return;

  const fMembers = attendees.filter(a => String(a.registrationId || "").trim() === String(regId).trim());
  const modal = document.getElementById("attendee-details-modal");
  const defaultPassHint = reg.defaultPassword || (reg.mobileNo ? reg.mobileNo.slice(-6) : "123456");

  document.getElementById("modal-family-name").textContent = `${reg.familyName} Family`;
  document.getElementById("modal-reg-id").textContent = `ID: ${reg.registrationNo || reg.id} • ${reg.groupColor?.toUpperCase()} Team • ${fMembers.length} Passes`;

  document.getElementById("modal-attendees-list").innerHTML = `
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-xs">
      <div class="flex justify-between items-center">
        <span class="font-black text-emerald-950 uppercase">Credentials</span>
        <button id="btn-quick-copy" class="px-2 py-1 bg-white border border-emerald-200 rounded text-emerald-900 font-bold">Copy</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="p-2 bg-white rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Phone</span>
          <span class="font-mono font-bold">${reg.mobileNo}</span>
        </div>
        <div class="p-2 bg-white rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Pass Key</span>
          <span class="font-mono font-bold text-emerald-700">${defaultPassHint}</span>
        </div>
      </div>
    </div>
    <div class="space-y-2 pt-2">
      ${fMembers.map((att, idx) => `
        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-slate-900">${escapeHtml(att.memberName || "Member #" + (idx + 1))}</p>
            <p class="text-[10px] text-slate-400 uppercase font-semibold">${att.category}</p>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${att.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
            ${att.status === 'checked_in' ? 'Checked' : 'Pending'}
          </span>
        </div>
      `).join("")}
    </div>
  `;

  document.getElementById("btn-quick-copy")?.addEventListener("click", () => {
    navigator.clipboard.writeText(`Family: ${reg.familyName}\nMobile: ${reg.mobileNo}\nPass: ${defaultPassHint}`);
    alert("Copied to clipboard!");
  });

  modal.classList.remove("hidden");
}

function closeFamilyDetailsModal() {
  document.getElementById("attendee-details-modal")?.classList.add("hidden");
}

async function handleDeleteRegistration(id) {
  if (!confirm("Are you sure you want to soft-delete this registration?")) return;
  const uid = sessionStorage.getItem("portalUserId");
  await softDeleteDoc(doc(db, "meetupRegistrations", id), uid);
}

// -------------------------------------------------------------
// SCORING & DESK UTILITIES
// -------------------------------------------------------------
function renderDeskList() {
  const container = document.getElementById("desk-list");
  if (!container) return;

  if (!deskUsers.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-2">No active desk accounts.</p>`;
    return;
  }
  container.innerHTML = `
    <table class="min-w-full text-left text-xs bg-slate-50 border border-slate-200 rounded-2xl">
      <thead class="border-b border-slate-200 text-slate-700">
        <tr><th class="p-2.5">User</th><th class="p-2.5">Staff</th><th class="p-2.5 text-right">Action</th></tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${deskUsers.map(u => `
          <tr>
            <td class="p-2.5 font-mono font-bold">${escapeHtml(u.id)}</td>
            <td class="p-2.5">${escapeHtml(u.displayName || "")}</td>
            <td class="p-2.5 text-right">
              <button onclick="window.removeDeskStaff('${u.id}')" class="text-rose-600 font-bold hover:underline">Revoke</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

window.removeDeskStaff = async (u) => {
  if (!confirm(`Revoke '${u}'?`)) return;
  await softDeleteDoc(doc(db, "users", u), sessionStorage.getItem("portalUserId"));
};

async function handleCreateDeskUser(e, currentUser) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const user = data.username.trim();
  try {
    await setDoc(doc(db, "users", user), {
      displayName: data.displayName.trim(),
      role: "verification_desk",
      passwordHash: await sha256(data.password),
      isDeleted: false,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
}

async function handleSaveEvent(e, currentUser) {
  e.preventDefault();
  const v = Object.fromEntries(new FormData(e.target));
  await setDoc(doc(collection(db, "meetupEvents")), {
    ...v,
    maxScore: Number(v.maxScore),
    isDeleted: false,
    year: 2026,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp()
  });
  e.target.reset();
  e.target.classList.add("hidden");
}

function renderEvents() {
  const container = document.getElementById("event-list");
  if (!container) return;

  container.innerHTML = events.map(ev => `
    <div class="p-3 border border-slate-200 rounded-xl bg-slate-50 flex justify-between items-center text-xs">
      <div>
        <p class="font-bold text-slate-900">${escapeHtml(ev.name)}</p>
        <p class="text-[10px] text-slate-400">${ev.eventType} • Max: ${ev.maxScore}</p>
      </div>
      <div class="flex items-center gap-1.5">
        <select id="score-team-${ev.id}" class="p-1 rounded border border-slate-300">
          ${colors.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join("")}
        </select>
        <input id="score-val-${ev.id}" type="number" min="0" max="${ev.maxScore}" placeholder="Pts" class="w-14 p-1 rounded border border-slate-300 font-mono" />
        <button onclick="window.recordTeamScore('${ev.id}')" class="px-2.5 py-1 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-800">Save</button>
      </div>
    </div>
  `).join("");
}

window.recordTeamScore = async (id) => {
  const team = document.getElementById(`score-team-${id}`).value;
  const score = Number(document.getElementById(`score-val-${id}`).value);
  if (isNaN(score)) return alert("Enter score");
  await setDoc(doc(db, "meetupScores", `${id}_${team}`), {
    eventId: id,
    groupColor: team,
    score,
    year: 2026,
    updatedAt: serverTimestamp()
  });
};

function renderRanking() {
  const container = document.getElementById("ranking-container");
  if (!container) return;

  const totals = { red: 0, blue: 0, green: 0 };
  scores.forEach(s => {
    if (totals[s.groupColor] !== undefined) totals[s.groupColor] += Number(s.score || 0);
  });
  const ranked = colors.map(c => ({ color: c, score: totals[c] })).sort((a, b) => b.score - a.score);
  const max = Math.max(...ranked.map(r => r.score), 1);

  container.innerHTML = ranked.map((r, i) => `
    <div class="p-3 border rounded-xl bg-slate-50 text-xs">
      <div class="flex justify-between items-center font-bold">
        <span>#${i + 1} ${r.color.toUpperCase()} TEAM</span>
        <span class="font-mono text-emerald-800">${r.score} pts</span>
      </div>
      <div class="w-full bg-slate-200 rounded-full h-1.5 mt-2">
        <div class="h-1.5 rounded-full ${r.color === 'red' ? 'bg-rose-500' : r.color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}" style="width: ${(r.score / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
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