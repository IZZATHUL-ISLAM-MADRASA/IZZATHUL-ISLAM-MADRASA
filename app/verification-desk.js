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

let html5QrScanner = null;

export function renderVerificationDesk() {
  const app = document.getElementById("app");
  document.title = "Gate Verification Desk | Ta'aluf Gathering";
  app.className = "min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col";

  // Check if a desk staff session already exists
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
            <p class="text-[10px] text-slate-500 font-semibold">Ta'aluf Family Gathering 2025</p>
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
      
      <!-- STAGE 1: Staff Sign-in Card (Displayed when no active session exists) -->
      <section id="desk-auth-panel" class="${activeStaff ? 'hidden' : ''} bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
        <div class="text-center space-y-1">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl mx-auto mb-2">
            🔐
          </div>
          <h2 class="text-lg font-black text-slate-900">Desk Staff Authentication</h2>
          <p class="text-xs text-slate-500">Sign in with authorized verification credentials to unlock camera and entry scanner.</p>
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

      <!-- STAGE 2: Camera Scanner & Verification Panel (Only mounted after login) -->
      <section id="desk-scanner-panel" class="${activeStaff ? '' : 'hidden'} space-y-4">
        
        <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <span class="text-xs font-black uppercase tracking-wider text-slate-700">Live QR Entry Scanner</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> Camera Active
            </span>
          </div>

          <!-- Video viewport container -->
          <div id="qr-reader" class="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 min-h-[260px] flex items-center justify-center"></div>

          <!-- Manual Pass Token Input -->
          <div class="space-y-1.5 pt-2">
            <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500" for="manual-token-input">Manual Token Entry</label>
            <div class="flex gap-2">
              <input 
                id="manual-token-input" 
                placeholder="Paste or type 24-character pass token..." 
                class="min-w-0 flex-1 p-3 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-600" 
              />
              <button 
                id="btn-manual-verify" 
                type="button" 
                class="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
              >
                Verify Pass
              </button>
            </div>
          </div>
        </div>

        <!-- Verification Feedback Container -->
        <div id="desk-result" class="hidden rounded-3xl p-5 border transition-all duration-300"></div>
      </section>

    </main>
  `;

  attachAuthEvents();

  // If a valid session already exists, start the camera immediately
  if (activeStaff) {
    initScanner();
    attachSignoutEvent();
  }
}

// -------------------------------------------------------------
// STAFF LOGIN & AUTHORIZATION LOGIC
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
      if (!username || !password) {
        throw new Error("Please enter both username and password.");
      }

      // Fetch user profile from Firestore
      const userRef = doc(db, "users", username);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("Invalid username or password.");
      }

      const userData = userSnap.data();

      // Check soft-delete status
      if (userData.isDeleted) {
        throw new Error("This verification account has been deactivated.");
      }

      // Verify SHA-256 hashed password
      const computedHash = await sha256(password);
      const storedHash = userData.passwordHash || userData.password_hash || "";

      if (computedHash.toLowerCase() !== storedHash.toLowerCase()) {
        throw new Error("Invalid username or password.");
      }

      // Role check: Only verification_desk or administrators can run the scanner
      if (!["verification_desk", "admin", "usthad"].includes(userData.role)) {
        throw new Error("Account is not authorized for gate verification.");
      }

      // Log login timestamp
      await safeUpdateDoc(userRef, { lastLoginAt: serverTimestamp() }, username);

      // Save credentials in session
      sessionStorage.setItem("deskUser", username);

      // Switch views and start camera
      document.getElementById("desk-auth-panel").classList.add("hidden");
      document.getElementById("desk-scanner-panel").classList.remove("hidden");
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
  const signoutBtn = document.getElementById("btn-desk-signout");
  if (!signoutBtn) return;

  signoutBtn.onclick = async () => {
    // Gracefully stop camera before clearing session
    await stopCamera();
    sessionStorage.removeItem("deskUser");
    renderVerificationDesk();
  };

  const manualBtn = document.getElementById("btn-manual-verify");
  if (manualBtn) {
    manualBtn.onclick = () => {
      const token = document.getElementById("manual-token-input").value.trim();
      if (token) verifyPassToken(token);
    };
  }
}

// -------------------------------------------------------------
// CAMERA INITIALIZATION & SCANNING
// -------------------------------------------------------------
function initScanner() {
  if (!window.Html5QrcodeScanner) {
    console.error("Html5QrcodeScanner library is not loaded.");
    return;
  }

  // Stop any lingering instance before re-instantiating
  stopCamera();

  try {
    html5QrScanner = new window.Html5QrcodeScanner("qr-reader", { 
      fps: 10, 
      qrbox: { width: 220, height: 220 },
      rememberLastUsedCamera: true,
      aspectRatio: 1.0
    });

    html5QrScanner.render((scannedText) => {
      try {
        const parsed = JSON.parse(scannedText);
        verifyPassToken(parsed.t || scannedText);
      } catch (_) {
        verifyPassToken(scannedText);
      }
    });
  } catch (e) {
    console.warn("Camera init deferred:", e);
  }
}

async function stopCamera() {
  if (html5QrScanner) {
    try {
      await html5QrScanner.clear();
      html5QrScanner = null;
    } catch (e) {
      console.warn("Scanner teardown notice:", e);
    }
  }
}

// -------------------------------------------------------------
// QR PASS VERIFICATION & ATTENDEE CHECK-IN
// -------------------------------------------------------------
async function verifyPassToken(rawToken) {
  const resultBox = document.getElementById("desk-result");
  resultBox.className = "rounded-3xl p-5 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold";
  resultBox.innerHTML = `
    <div class="flex items-center space-x-2">
      <span class="animate-spin text-sm">⏳</span>
      <span>Verifying badge cryptographic signature...</span>
    </div>
  `;
  resultBox.classList.remove("hidden");

  try {
    const tokenHash = await sha256(rawToken);
    const snap = await getDocs(query(
      collection(db, "meetupAttendees"), 
      where("qrTokenHash", "==", tokenHash)
    ));

    // 1. Invalid or Not Found
    if (snap.empty) {
      resultBox.className = "rounded-3xl p-5 bg-rose-50 border border-rose-200 text-rose-900";
      resultBox.innerHTML = `
        <div class="flex items-start space-x-3">
          <span class="text-2xl">❌</span>
          <div>
            <h3 class="text-sm font-black">Invalid or Unrecognized Pass</h3>
            <p class="text-xs text-rose-700 mt-0.5">No attendee record matched this QR code. Please check manual token.</p>
          </div>
        </div>
      `;
      return;
    }

    const docSnap = snap.docs[0];
    const attendee = docSnap.data();

    // 2. Check if Soft Deleted
    if (attendee.isDeleted) {
      resultBox.className = "rounded-3xl p-5 bg-rose-50 border border-rose-200 text-rose-900";
      resultBox.innerHTML = `
        <div class="flex items-start space-x-3">
          <span class="text-2xl">🚫</span>
          <div>
            <h3 class="text-sm font-black">Cancelled Registration</h3>
            <p class="text-xs text-rose-700 mt-0.5">This pass was flagged as cancelled by madrasa administration.</p>
          </div>
        </div>
      `;
      return;
    }

    // 3. Check for Duplicate Entry (Already Used)
    if (attendee.status === "checked_in") {
      const timeStr = attendee.checkedInAt?.toDate 
        ? attendee.checkedInAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : "Earlier";

      resultBox.className = "rounded-3xl p-5 bg-amber-50 border border-amber-200 text-amber-950";
      resultBox.innerHTML = `
        <div class="flex items-start space-x-3">
          <span class="text-2xl">⚠️</span>
          <div>
            <h3 class="text-sm font-black">Pass Already Scanned</h3>
            <p class="text-xs text-amber-800 mt-0.5">
              Attendee: <strong>${escapeHtml(attendee.memberName || "Guest")}</strong> (${escapeHtml(attendee.category || "General")})
            </p>
            <p class="text-[11px] text-amber-700 mt-1 font-semibold">
              Scanned at: ${timeStr} • Verified by: ${escapeHtml(attendee.checkedInBy || "Gate Staff")}
            </p>
          </div>
        </div>
      `;
      return;
    }

    // 4. Mark Entry Verified in Firestore
    const staffUser = sessionStorage.getItem("deskUser") || "gate_staff";
    await safeUpdateDoc(doc(db, "meetupAttendees", docSnap.id), {
      status: "checked_in",
      checkedInAt: serverTimestamp(),
      checkedInBy: staffUser
    }, staffUser);

    // Color pill styling
    const colorThemes = {
      red: "bg-rose-100 text-rose-800 border-rose-200",
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      green: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    const teamClass = colorThemes[attendee.groupColor?.toLowerCase()] || "bg-slate-100 text-slate-800 border-slate-200";

    resultBox.className = "rounded-3xl p-5 bg-emerald-50 border border-emerald-200 text-emerald-950";
    resultBox.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-start space-x-3">
          <span class="text-3xl">✅</span>
          <div class="space-y-0.5">
            <span class="text-[10px] font-black uppercase tracking-wider text-emerald-700">Check-in Approved</span>
            <h3 class="text-base font-black text-slate-900">${escapeHtml(attendee.memberName || "Guest Attendee")}</h3>
            <p class="text-xs text-slate-600 font-semibold">Category: <span class="uppercase">${escapeHtml(attendee.category)}</span></p>
          </div>
        </div>
        <span class="px-3 py-1 rounded-xl text-xs font-black uppercase border ${teamClass}">
          ${escapeHtml(attendee.groupColor || "General")} Team
        </span>
      </div>
    `;

    // Clear the manual token input on success
    const manualInput = document.getElementById("manual-token-input");
    if (manualInput) manualInput.value = "";
  } catch (err) {
    resultBox.className = "rounded-3xl p-5 bg-rose-50 border border-rose-200 text-rose-900";
    resultBox.innerHTML = `<h3 class="text-sm font-black">Verification Error</h3><p class="text-xs mt-0.5">${escapeHtml(err.message)}</p>`;
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}