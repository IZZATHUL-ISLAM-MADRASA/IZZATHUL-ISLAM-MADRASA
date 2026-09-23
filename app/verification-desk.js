// verification-desk.js
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  sha256, 
  safeUpdateDoc, 
  serverTimestamp 
} from "./firebase-config.js";

let html5QrCode = null;
let isCameraRunning = false;
let currentFamilyData = null;
let currentFamilyMembers = [];

export function renderVerificationDesk() {
  const app = document.getElementById("app");
  document.title = "Gate Verification Desk | Ta'aluf Gathering";
  app.className = "min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col";

  const activeStaff = sessionStorage.getItem("deskUser");

  app.innerHTML = `
    <!-- Sticky Top Navigation -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div class="max-w-xl mx-auto px-4 py-3.5 flex justify-between items-center">
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sm font-black text-emerald-800">
            🔍
          </div>
          <div>
            <h1 class="text-xs font-black uppercase tracking-wider text-slate-900 leading-tight">Gate Verification Desk</h1>
            <p class="text-[10px] text-slate-500 font-semibold">Ta'aluf Family Gathering 2026</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          ${activeStaff ? `
            <span class="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Staff: <b>${escapeHtml(activeStaff)}</b></span>
            <button id="btn-desk-signout" class="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl transition">Sign out</button>
          ` : `
            <button onclick="window.navigate('landing')" class="text-xs font-bold text-slate-500 hover:text-slate-800">Home</button>
          `}
        </div>
      </div>
    </header>

    <main class="flex-grow max-w-xl w-full mx-auto p-4 sm:p-6 space-y-4 flex flex-col justify-start">
      
      <!-- STAGE 1: Staff Sign-in Card -->
      <section id="desk-auth-panel" class="${activeStaff ? 'hidden' : ''} bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
        <div class="text-center space-y-1">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl mx-auto mb-2">
            🔐
          </div>
          <h2 class="text-lg font-black text-slate-900">Desk Staff Authentication</h2>
          <p class="text-xs text-slate-500">Sign in with authorized verification credentials to access the gate camera scanner.</p>
        </div>

        <form id="desk-auth-form" class="space-y-4 pt-2">
          <div>
            <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1" for="staff-user">Staff Username</label>
            <input 
              id="staff-user" 
              required 
              autocomplete="username"
              placeholder="e.g. gate01" 
              class="w-full p-3.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" 
            />
          </div>

          <div>
            <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1" for="staff-pass">Password</label>
            <input 
              id="staff-pass" 
              type="password" 
              required 
              autocomplete="current-password"
              placeholder="••••••••" 
              class="w-full p-3.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" 
            />
          </div>

          <p id="desk-auth-error" class="hidden text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl"></p>

          <button 
            id="btn-staff-login" 
            type="submit" 
            class="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-700/20 transition active:scale-[0.99] flex items-center justify-center space-x-2"
          >
            <span>Unlock Camera Scanner</span>
            <span id="auth-spinner" class="hidden animate-spin">⏳</span>
          </button>
        </form>

        <div class="text-center pt-2 border-t border-slate-100">
          <a href="javascript:void(0)" onclick="window.navigate('login')" class="text-[11px] font-bold text-slate-400 hover:text-slate-700">Administrator Portal →</a>
        </div>
      </section>

      <!-- STAGE 2: Camera Scanner & Family Verification Panel -->
      <section id="desk-scanner-panel" class="${activeStaff ? '' : 'hidden'} space-y-4">
        
        <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <span class="text-xs font-black uppercase tracking-wider text-slate-700">Scan Master Family QR</span>
            <button 
              id="btn-toggle-camera" 
              type="button" 
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 transition"
            >
              <span id="cam-dot" class="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span id="cam-btn-label">Turn Camera Off</span>
            </button>
          </div>

          <!-- Video viewport container with relative aspect ratio -->
          <div class="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 min-h-[260px] flex items-center justify-center">
            <div id="qr-reader" class="w-full h-full"></div>
            <p id="cam-placeholder" class="hidden text-xs text-slate-400 p-4 text-center">Camera is stopped. Click "Start Camera" above.</p>
          </div>

          <!-- Manual Pass Token Input -->
          <div class="space-y-1.5 pt-1">
            <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500" for="manual-token-input">Manual Family Pass Token</label>
            <div class="flex gap-2">
              <input 
                id="manual-token-input" 
                placeholder="Paste or type 24-char token..." 
                class="min-w-0 flex-1 p-3 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-600" 
              />
              <button 
                id="btn-manual-verify" 
                type="button" 
                class="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
              >
                Verify
              </button>
            </div>
          </div>
        </div>

        <!-- Verification Loading / Message Strip -->
        <div id="desk-result-msg" class="hidden rounded-2xl p-4 text-xs font-bold"></div>

        <!-- Dynamic Family Member Checklist Modal Card -->
        <div id="desk-family-modal" class="hidden bg-white p-6 rounded-3xl border-2 border-emerald-600 shadow-xl space-y-4"></div>
      </section>

    </main>
  `;

  attachAuthEvents();

  if (activeStaff) {
    attachSignoutEvent();
    startCameraEngine();
  }
}

// -------------------------------------------------------------
// STAFF LOGIN & SESSION LOGIC
// -------------------------------------------------------------
function attachAuthEvents() {
  const form = document.getElementById("desk-auth-form");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById("staff-user").value.trim();
    const password = document.getElementById("staff-pass").value;
    const errorBox = document.getElementById("desk-auth-error");
    const submitBtn = document.getElementById("btn-staff-login");
    const spinner = document.getElementById("auth-spinner");

    errorBox.classList.add("hidden");
    submitBtn.disabled = true;
    spinner.classList.remove("hidden");

    try {
      if (!username || !password) throw new Error("Please enter both username and password.");

      const userRef = doc(db, "users", username);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) throw new Error("Invalid username or password.");

      const userData = userSnap.data();
      if (userData.isDeleted) throw new Error("This verification account has been deactivated.");

      const computedHash = await sha256(password);
      const storedHash = userData.passwordHash || userData.password_hash || "";

      if (computedHash.toLowerCase() !== storedHash.toLowerCase()) {
        throw new Error("Invalid username or password.");
      }

      if (!["verification_desk", "admin", "usthad"].includes(userData.role)) {
        throw new Error("Account is not authorized for gate verification.");
      }

      await safeUpdateDoc(userRef, { lastLoginAt: serverTimestamp() }, username);
      sessionStorage.setItem("deskUser", username);

      renderVerificationDesk();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add("hidden");
    }
  };
}

function attachSignoutEvent() {
  document.getElementById("btn-desk-signout")?.addEventListener("click", async () => {
    await stopCameraEngine();
    sessionStorage.removeItem("deskUser");
    renderVerificationDesk();
  });

  document.getElementById("btn-manual-verify")?.addEventListener("click", () => {
    const token = document.getElementById("manual-token-input").value.trim();
    if (token) verifyFamilyPassToken(token);
  });

  document.getElementById("btn-toggle-camera")?.addEventListener("click", () => {
    if (isCameraRunning) {
      stopCameraEngine();
    } else {
      startCameraEngine();
    }
  });
}

// -------------------------------------------------------------
// RELIABLE CAMERA HARDWARE LIFECYCLE (Html5Qrcode Native)
// -------------------------------------------------------------
async function startCameraEngine() {
  const placeholder = document.getElementById("cam-placeholder");
  const camBtnLabel = document.getElementById("cam-btn-label");
  const camDot = document.getElementById("cam-dot");

  if (!window.Html5Qrcode) {
    alert("Camera QR library is loading or blocked by ad-blocker. Please refresh.");
    return;
  }

  // Stop previous instance if alive
  await stopCameraEngine();

  try {
    html5QrCode = new window.Html5Qrcode("qr-reader");

    const qrCodeSuccessCallback = (decodedText) => {
      try {
        const parsed = JSON.parse(decodedText);
        verifyFamilyPassToken(parsed.t || decodedText);
      } catch (_) {
        verifyFamilyPassToken(decodedText);
      }
    };

    const config = {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.0
    };

    // Prefer back/rear camera on smartphones, default on laptops
    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      qrCodeSuccessCallback,
      () => { /* frame parse miss; silent */ }
    );

    isCameraRunning = true;
    if (placeholder) placeholder.classList.add("hidden");
    if (camBtnLabel) camBtnLabel.textContent = "Turn Camera Off";
    if (camDot) camDot.className = "w-2 h-2 rounded-full bg-emerald-600 animate-pulse";
  } catch (err) {
    console.warn("Camera auto-start notice:", err);
    // Fallback: try default camera if facingMode: "environment" was rejected
    try {
      const devices = await window.Html5Qrcode.getCameras();
      if (devices && devices.length) {
        await html5QrCode.start(devices[0].id, { fps: 10, qrbox: 220 }, (txt) => {
          try {
            const p = JSON.parse(txt);
            verifyFamilyPassToken(p.t || txt);
          } catch (_) {
            verifyFamilyPassToken(txt);
          }
        });
        isCameraRunning = true;
        if (placeholder) placeholder.classList.add("hidden");
        if (camBtnLabel) camBtnLabel.textContent = "Turn Camera Off";
        if (camDot) camDot.className = "w-2 h-2 rounded-full bg-emerald-600 animate-pulse";
        return;
      }
    } catch (_) {}

    isCameraRunning = false;
    if (placeholder) {
      placeholder.textContent = "Camera could not start. Ensure site is on HTTPS and permissions are allowed.";
      placeholder.classList.remove("hidden");
    }
    if (camBtnLabel) camBtnLabel.textContent = "Retry Camera";
    if (camDot) camDot.className = "w-2 h-2 rounded-full bg-rose-500";
  }
}

async function stopCameraEngine() {
  const placeholder = document.getElementById("cam-placeholder");
  const camBtnLabel = document.getElementById("cam-btn-label");
  const camDot = document.getElementById("cam-dot");

  if (html5QrCode && isCameraRunning) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {
      console.warn("Camera stop notice:", e);
    }
  }
  isCameraRunning = false;
  html5QrCode = null;

  if (placeholder) placeholder.classList.remove("hidden");
  if (camBtnLabel) camBtnLabel.textContent = "Start Camera";
  if (camDot) camDot.className = "w-2 h-2 rounded-full bg-slate-400";
}

// -------------------------------------------------------------
// VERIFY TOKEN & LOAD MASTER FAMILY + MEMBER CHECKLIST
// -------------------------------------------------------------
async function verifyFamilyPassToken(rawToken) {
  const msg = document.getElementById("desk-result-msg");
  const modal = document.getElementById("desk-family-modal");

  msg.className = "rounded-2xl p-4 bg-slate-200 text-slate-800 text-xs font-bold block";
  msg.textContent = "Verifying pass token and loading family roster...";
  msg.classList.remove("hidden");
  modal.classList.add("hidden");

  try {
    const tokenHash = await sha256(rawToken);

    // 1. Search by token hash in registrations
    let snap = await getDocs(query(
      collection(db, "meetupRegistrations"),
      where("qrTokenHash", "==", tokenHash)
    ));

    // Fallback: Check if unhashed rawFamilyToken was stored
    if (snap.empty) {
      snap = await getDocs(query(
        collection(db, "meetupRegistrations"),
        where("rawFamilyToken", "==", rawToken)
      ));
    }

    // Fallback: Check if token belongs to an individual attendee pass from older versions
    if (snap.empty) {
      const attSnap = await getDocs(query(
        collection(db, "meetupAttendees"),
        where("qrTokenHash", "==", tokenHash)
      ));
      if (!attSnap.empty) {
        const regId = attSnap.docs[0].data().registrationId;
        const parentDoc = await getDoc(doc(db, "meetupRegistrations", regId));
        if (parentDoc.exists()) {
          snap = { empty: false, docs: [parentDoc] };
        }
      }
    }

    if (snap.empty) {
      msg.className = "rounded-2xl p-4 bg-rose-100 text-rose-900 text-xs font-bold block";
      msg.textContent = "❌ Invalid QR Pass. No active registration matches this token.";
      return;
    }

    const regDoc = snap.docs[0];
    currentFamilyData = { id: regDoc.id, ...regDoc.data() };

    if (currentFamilyData.isDeleted) {
      msg.className = "rounded-2xl p-4 bg-rose-100 text-rose-900 text-xs font-bold block";
      msg.textContent = "🚫 This registration has been cancelled by administration.";
      return;
    }

    // 2. Fetch all members attached to this family
    const attSnap = await getDocs(query(
      collection(db, "meetupAttendees"),
      where("registrationId", "==", regDoc.id)
    ));

    currentFamilyMembers = attSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => !d.isDeleted);

    msg.classList.add("hidden");
    renderFamilyChecklist();
  } catch (err) {
    msg.className = "rounded-2xl p-4 bg-rose-100 text-rose-900 text-xs font-bold block";
    msg.textContent = "Verification Error: " + err.message;
  }
}

// -------------------------------------------------------------
// RENDER CHECKLIST FOR GATE VOLUNTEER
// -------------------------------------------------------------
function renderFamilyChecklist() {
  const modal = document.getElementById("desk-family-modal");
  modal.classList.remove("hidden");

  const colors = {
    red: "bg-rose-100 text-rose-800 border-rose-300",
    blue: "bg-blue-100 text-blue-800 border-blue-300",
    green: "bg-emerald-100 text-emerald-800 border-emerald-300"
  };
  const colorBadge = colors[currentFamilyData.groupColor?.toLowerCase()] || "bg-slate-100 text-slate-800 border-slate-300";

  modal.innerHTML = `
    <div class="flex items-start justify-between border-b border-slate-100 pb-3">
      <div>
        <span class="text-[10px] font-black uppercase tracking-wider text-emerald-700">Family Pass Identified</span>
        <h3 class="text-lg font-black text-slate-900">${escapeHtml(currentFamilyData.familyName)} Family</h3>
        <p class="text-xs text-slate-500 font-mono">${currentFamilyData.registrationNo || currentFamilyData.id} • ${currentFamilyData.mobileNo || ""}</p>
      </div>
      <span class="px-3 py-1 rounded-xl text-xs font-black uppercase border ${colorBadge}">
        ${escapeHtml(currentFamilyData.groupColor || "General")} Team
      </span>
    </div>

    <!-- Select All Toolbar -->
    <div class="flex items-center justify-between text-xs pt-1">
      <span class="font-bold text-slate-700">Select Present Members:</span>
      <button id="btn-toggle-all" type="button" class="text-emerald-700 font-extrabold hover:underline">
        Select All
      </button>
    </div>

    <!-- Attendee Checkbox List -->
    <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
      ${currentFamilyMembers.map((att, idx) => {
        const isCheckedIn = att.status === "checked_in";
        return `
          <label class="flex items-center justify-between p-3 rounded-2xl border ${isCheckedIn ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-200'} cursor-pointer hover:bg-white transition">
            <div class="flex items-center space-x-3">
              <input 
                type="checkbox" 
                class="member-checkbox w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" 
                value="${att.id}" 
                ${isCheckedIn ? "checked disabled" : "checked"} 
              />
              <div>
                <span class="text-xs font-bold text-slate-900">${escapeHtml(att.memberName || "Member #" + (idx + 1))}</span>
                <span class="text-[10px] font-bold text-slate-500 uppercase block">${formatCategory(att.category)}</span>
              </div>
            </div>
            <div>
              ${isCheckedIn 
                ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Checked-in</span>` 
                : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Pending</span>`}
            </div>
          </label>
        `;
      }).join("") || `<p class="text-xs text-slate-400 text-center py-2">No attendee members attached.</p>`}
    </div>

    <!-- Confirmation Actions -->
    <div class="flex gap-2 pt-2 border-t border-slate-100">
      <button id="btn-cancel-modal" type="button" class="w-1/3 py-3 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 transition">
        Cancel
      </button>
      <button id="btn-confirm-checkin" type="button" class="w-2/3 py-3 rounded-xl bg-emerald-700 text-white text-xs font-black uppercase tracking-wider hover:bg-emerald-800 transition">
        Confirm Check-in
      </button>
    </div>
  `;

  let allSelected = true;
  document.getElementById("btn-toggle-all").onclick = () => {
    allSelected = !allSelected;
    document.querySelectorAll(".member-checkbox:not(:disabled)").forEach(cb => {
      cb.checked = allSelected;
    });
    document.getElementById("btn-toggle-all").textContent = allSelected ? "Deselect All" : "Select All";
  };

  document.getElementById("btn-cancel-modal").onclick = () => {
    modal.classList.add("hidden");
  };

  document.getElementById("btn-confirm-checkin").onclick = executeCheckin;
}

// -------------------------------------------------------------
// EXECUTE ATTENDEE STATUS UPDATES
// -------------------------------------------------------------
async function executeCheckin() {
  const btn = document.getElementById("btn-confirm-checkin");
  btn.disabled = true;
  btn.textContent = "Updating...";

  const checkedBoxes = Array.from(document.querySelectorAll(".member-checkbox:checked:not(:disabled)"));
  if (!checkedBoxes.length) {
    alert("Please select at least one pending member to check in.");
    btn.disabled = false;
    btn.textContent = "Confirm Check-in";
    return;
  }

  const selectedAttendeeIds = checkedBoxes.map(cb => cb.value);
  const staff = sessionStorage.getItem("deskUser") || "gate_staff";

  try {
    // 1. Mark selected members as checked-in
    await Promise.all(selectedAttendeeIds.map(attId => {
      return safeUpdateDoc(doc(db, "meetupAttendees", attId), {
        status: "checked_in",
        checkedInAt: serverTimestamp(),
        checkedInBy: staff
      }, staff);
    }));

    // 2. Increment family total checked-in count
    const newlyCheckedTotal = currentFamilyMembers.filter(a => a.status === "checked_in" || selectedAttendeeIds.includes(a.id)).length;
    await safeUpdateDoc(doc(db, "meetupRegistrations", currentFamilyData.id), {
      checkedInCount: newlyCheckedTotal,
      lastVerifiedAt: serverTimestamp()
    }, staff);

    alert(`Success! Checked in ${selectedAttendeeIds.length} members for ${currentFamilyData.familyName} Family.`);
    document.getElementById("desk-family-modal").classList.add("hidden");
    const manualInput = document.getElementById("manual-token-input");
    if (manualInput) manualInput.value = "";
  } catch (err) {
    alert("Check-in error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Check-in";
  }
}

function formatCategory(c) {
  return { below5: "Below 5 Yrs", age5to12: "Age 5-12", above12: "Above 12" }[c] || c || "General";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}
