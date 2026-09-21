// app.js
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  sha256, 
  safeUpdateDoc, 
  generateSecureToken 
} from "./firebase-config.js";

import { renderAdminDashboard } from "./admin-dashboard.js";
import { renderMeetupAdmin } from "./admin-family-meetup.js";
import { renderMeetupRegister } from "./meetup-register.js";

const app = document.getElementById("app");

export const state = {
  currentView: new URLSearchParams(window.location.search).get("view") || "login",
  user: {
    uid: sessionStorage.getItem("portalUserId"),
    role: sessionStorage.getItem("portalRole")
  }
};

window.navigate = (view) => {
  state.currentView = view;
  state.user.uid = sessionStorage.getItem("portalUserId");
  state.user.role = sessionStorage.getItem("portalRole");

  const url = new URL(window.location);
  url.searchParams.set("view", view);
  window.history.pushState({}, "", url);
  renderApp();
};

window.addEventListener("popstate", () => {
  state.currentView = new URLSearchParams(window.location.search).get("view") || "login";
  state.user.uid = sessionStorage.getItem("portalUserId");
  state.user.role = sessionStorage.getItem("portalRole");
  renderApp();
});

export function renderApp() {
  app.innerHTML = "";

  switch (state.currentView) {
    case "register":
      renderMeetupRegister();
      break;

    case "dashboard":
      if (!state.user.uid || !["admin", "usthad"].includes(state.user.role)) {
        return window.navigate("login");
      }
      renderAdminDashboard();
      break;

    case "meetup-admin":
      if (!state.user.uid || !["admin", "usthad"].includes(state.user.role)) {
        return window.navigate("login");
      }
      renderMeetupAdmin();
      break;

    case "verification-desk":
      renderDeskView();
      break;

    case "family-login":
      renderFamilyPassView();
      break;

    case "login":
    default:
      renderAdminLoginView();
      break;
  }
}

// -------------------------------------------------------------
// ADMIN LOGIN VIEW
// -------------------------------------------------------------
function renderAdminLoginView() {
  if (state.user.uid && ["admin", "usthad"].includes(state.user.role)) {
    return window.navigate("dashboard");
  }

  app.className = "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6";
  app.innerHTML = `
    <main class="w-full max-w-md">
      <div class="mb-8">
        <p class="text-indigo-300 text-sm font-semibold uppercase tracking-[0.2em]">Izzathul Islam</p>
        <h1 class="mt-3 text-4xl font-black tracking-tight">Management Portal</h1>
        <p class="mt-3 text-slate-400">Sign in to manage student records, family meetups, and academics.</p>
      </div>
      <form id="admin-login-form" class="bg-white text-slate-900 rounded-2xl p-6 shadow-2xl space-y-5">
        <div>
          <label for="admin-user" class="block text-sm font-bold mb-2">Username</label>
          <input id="admin-user" type="text" required autocomplete="username" placeholder="admin01" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label for="admin-pass" class="block text-sm font-bold mb-2">Password</label>
          <input id="admin-pass" type="password" required autocomplete="current-password" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <p id="admin-login-error" class="hidden rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"></p>
        <button id="admin-submit-btn" class="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white hover:bg-indigo-700 transition" type="submit">Sign in</button>
        <div class="flex justify-between pt-3 border-t border-slate-100 text-xs font-semibold">
          <a href="javascript:void(0)" onclick="navigate('family-login')" class="text-indigo-600 hover:underline">Find Passes</a>
          <a href="javascript:void(0)" onclick="navigate('register')" class="text-emerald-600 hover:underline">Public Registration</a>
          <a href="javascript:void(0)" onclick="navigate('verification-desk')" class="text-slate-500 hover:underline">Verification</a>
        </div>
      </form>
    </main>
  `;

  document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("admin-login-error");
    const submitBtn = document.getElementById("admin-submit-btn");
    errorBox.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      const username = document.getElementById("admin-user").value.trim();
      const password = document.getElementById("admin-pass").value;
      const userDocRef = doc(db, "users", username);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) throw new Error("Invalid username or password.");
      const userData = userSnap.data();
      if (userData.isDeleted) throw new Error("This account has been deactivated.");

      const passwordHash = userData.passwordHash || userData.password_hash;
      const inputHash = await sha256(password);

      if (!passwordHash || inputHash.toLowerCase() !== passwordHash.toLowerCase()) {
        throw new Error("Invalid username or password.");
      }
      if (!["admin", "usthad"].includes(userData.role)) {
        throw new Error("This account does not have admin permissions.");
      }

      await safeUpdateDoc(userDocRef, { lastLoginAt: serverTimestamp() }, username);
      sessionStorage.setItem("portalUserId", username);
      sessionStorage.setItem("portalRole", userData.role);
      window.navigate("dashboard");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
    }
  });
}

// -------------------------------------------------------------
// FAMILY PASS LOOKUP VIEW
// -------------------------------------------------------------
function renderFamilyPassView() {
  app.className = "min-h-screen bg-slate-100 text-slate-900";
  app.innerHTML = `
    <header class="border-b border-slate-200 bg-white no-print">
      <div class="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Family Meetup 2026</p>
          <h1 class="mt-1 text-xl font-black">Find your passes</h1>
        </div>
        <div class="flex items-center space-x-3">
          <button onclick="navigate('register')" class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition">Register</button>
          </div>
      </div>
    </header>
    <main class="mx-auto max-w-xl p-4 sm:p-6">
      <form id="family-login-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 no-print">
        <h2 class="text-lg font-black">Recover Family Passes</h2>
        <p class="mt-1 text-sm text-slate-500">Enter your 10-digit mobile number and password (last 6 digits of mobile or DOB).</p>
        <label class="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-500" for="fam-mobile">Mobile number</label>
        <input id="fam-mobile" required inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" class="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" />
        <label class="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500" for="fam-pass">Password (Last 6 digits or DDMMYYYY)</label>
        <input id="fam-pass" required inputmode="numeric" maxlength="8" placeholder="6-digit phone suffix or DDMMYYYY" class="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
        <p id="fam-error" class="mt-4 hidden rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700"></p>
        <button id="fam-submit-btn" class="mt-5 w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white hover:bg-indigo-700 transition" type="submit">Find passes</button>
      </form>
      <section id="family-results" class="mt-6 hidden space-y-4"></section>
    </main>
  `;

  ["fam-mobile", "fam-pass"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  });

  document.getElementById("family-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("fam-error");
    const results = document.getElementById("family-results");
    const findButton = document.getElementById("fam-submit-btn");

    errorBox.classList.add("hidden");
    results.classList.add("hidden");
    findButton.disabled = true;
    findButton.textContent = "Searching...";

    try {
      const mobile = document.getElementById("fam-mobile").value.trim();
      const secret = document.getElementById("fam-pass").value.trim();

      if (mobile.length !== 10 || (secret.length !== 6 && secret.length !== 8)) {
        throw new Error("Enter your 10-digit mobile and password (last 6 digits or 8-digit DDMMYYYY DOB).");
      }

      const q = query(
        collection(db, "meetupRegistrations"),
        where("mobileNo", "==", mobile),
        where("year", "==", 2026),
        where("status", "==", "confirmed")
      );
      const snapshot = await getDocs(q);
      const inputHash = await sha256(secret);

      const matchedDoc = snapshot.docs.find((d) => {
        const item = d.data();
        if (item.isDeleted) return false;
        return item.dobHash === inputHash || item.passwordHash === inputHash;
      });

      if (!matchedDoc) throw new Error("No confirmed Meetup registration matched these details.");

      const regData = { id: matchedDoc.id, ...matchedDoc.data() };
      const attSnap = await getDocs(query(
        collection(db, "meetupAttendees"),
        where("registrationId", "==", matchedDoc.id),
        where("year", "==", 2026)
      ));

      const attendees = [];
      for (const attendeeDoc of attSnap.docs) {
        const attendee = attendeeDoc.data();
        if (attendee.isDeleted) continue;

        if (!attendee.rawToken) {
          const rawToken = generateSecureToken(24);
          await safeUpdateDoc(doc(db, "meetupAttendees", attendeeDoc.id), {
            rawToken,
            qrTokenHash: await sha256(rawToken)
          });
          attendee.rawToken = rawToken;
        }
        attendees.push({ ...attendee, id: attendeeDoc.id });
      }

      renderFamilyPassCards(regData, attendees);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("hidden");
    } finally {
      findButton.disabled = false;
      findButton.textContent = "Find passes";
    }
  });
}

function renderFamilyPassCards(registration, attendees) {
  // 1. Immediately hide previous search/login areas
  const loginSection = document.getElementById("family-login-section") || document.getElementById("family-login-form");
  if (loginSection) loginSection.classList.add("hidden");

  const results = document.getElementById("family-results");
  window.scrollTo({ top: 0, behavior: "smooth" });

  const colorPalettes = {
    red: { badge: "bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20", qr: "#e11d48", glow: "from-rose-500/10" },
    blue: { badge: "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20", qr: "#2563eb", glow: "from-blue-500/10" },
    green: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20", qr: "#059669", glow: "from-emerald-500/10" }
  };
  const theme = colorPalettes[registration.groupColor?.toLowerCase()] || { badge: "bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/20", qr: "#0f172a", glow: "from-indigo-500/10" };
  const hasConfiguredDob = Boolean(registration.dobHash && registration.dobHash.length > 0);

  // 2. Render Modern Ticket-Grade UI
  results.innerHTML = `
    <!-- Top Summary Banner -->
    <header class="no-print relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
      <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${theme.glow} to-transparent blur-2xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${theme.badge}">
              <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
              ${escapeHtml(registration.groupColor)} Team
            </span>
            <span class="text-[11px] font-mono text-slate-400">ID: ${escapeHtml(registration.registrationNo || registration.id)}</span>
          </div>
          <h2 class="text-2xl font-black tracking-tight text-slate-900">${escapeHtml(registration.familyName)} Family</h2>
        </div>

        <!-- Sticky Quick Actions Bar -->
        <div class="flex flex-wrap items-center gap-2">
          <button id="save-all-attendees" type="button" class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition">
            Save All
          </button>
          <button type="button" onclick="window.print()" class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition">
            Print Badges
          </button>
          <button id="download-pass-pdf" type="button" class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition">
            PDF Export
          </button>
          <button type="button" onclick="location.reload()" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition" title="Change Family">
            Exit
          </button>
        </div>
      </div>
    </header>

    <!-- Optional DOB Registration Prompt -->
    ${!hasConfiguredDob ? `
      <section id="dob-prompt-card" class="no-print rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-4 sm:p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <span class="text-xl">🔐</span>
          <div class="flex-1 space-y-1">
            <h3 class="text-xs font-black uppercase tracking-wider text-amber-900">Set Date of Birth Key</h3>
            <p class="text-xs text-amber-800">You logged in using the mobile suffix. Update to your permanent DDMMYYYY DOB key below.</p>
            <div class="mt-2.5 flex items-center gap-2">
              <input id="update-dob-input" maxlength="8" inputmode="numeric" placeholder="DDMMYYYY" class="w-36 rounded-xl border border-amber-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20" />
              <button id="update-dob-btn" type="button" class="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 active:scale-95 transition">Save DOB</button>
            </div>
          </div>
        </div>
      </section>
    ` : ""}

    <!-- Dynamic Pass Badges -->
    <div id="print-area" class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      ${attendees.map((att, idx) => {
        const hasName = Boolean(att.memberName && att.memberName.trim().length > 0);
        return `
          <article class="print-pass relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <!-- Cut Line Top Accent -->
            <div class="no-print absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

            <div class="text-center space-y-1">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Ta'aluf Meetup 2026</span>
              <h3 class="text-lg font-black text-slate-900 uppercase truncate">${escapeHtml(registration.familyName)} Family</h3>
            </div>

            <!-- Crisp Centered QR Frame -->
            <div class="my-4 flex flex-col items-center justify-center">
              <div id="pass-qr-${idx}" class="flex h-44 w-44 items-center justify-center rounded-2xl border border-slate-100 bg-white p-2 shadow-inner"></div>
            </div>

            <!-- Member Identity Display & Inline Toggle -->
            <div class="space-y-2">
              <div id="display-block-${idx}" class="${hasName ? "" : "hidden"} text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <h4 id="display-name-${idx}" class="text-base font-black text-slate-800">${escapeHtml(att.memberName || "")}</h4>
                  <button type="button" data-edit-index="${idx}" class="btn-toggle-edit text-slate-400 hover:text-indigo-600 no-print transition text-xs" title="Edit name">✏️</button>
                </div>
                <p id="display-meta-${idx}" class="text-xs text-slate-500 font-medium">${att.age ? `Age: ${escapeHtml(att.age)} • ` : ""}<span class="uppercase tracking-wider">${formatCategory(att.category)}</span></p>
              </div>

              <!-- Input Form for Missing Info or Editing -->
              <div id="edit-block-${idx}" class="${hasName ? "hidden" : ""} no-print rounded-2xl bg-slate-50 p-2.5 border border-slate-200/80 space-y-2">
                <div class="flex gap-2">
                  <input id="input-name-${idx}" value="${escapeHtml(att.memberName || "")}" placeholder="Name" class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10" />
                  <input id="input-age-${idx}" value="${escapeHtml(att.age || "")}" placeholder="Age" inputmode="numeric" maxlength="3" class="w-14 rounded-xl border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-center outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10" />
                  <button type="button" id="save-single-${idx}" class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition">Save</button>
                </div>
              </div>
            </div>

            <!-- Footer Badge Meta -->
            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <span>Pass #${idx + 1}</span>
              <span class="text-slate-700">${formatCategory(att.category)}</span>
              <span class="text-indigo-600">${escapeHtml(registration.groupColor)}</span>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
  results.classList.remove("hidden");

  // Wire DOB update listener
  const dobBtn = document.getElementById("update-dob-btn");
  if (dobBtn) {
    dobBtn.addEventListener("click", async () => {
      const dob = document.getElementById("update-dob-input").value.trim().replace(/\D/g, "");
      if (dob.length !== 8) return alert("Please enter an 8-digit DOB in DDMMYYYY format.");
      const newHash = await sha256(dob);
      await safeUpdateDoc(doc(db, "meetupRegistrations", registration.id), {
        dobHash: newHash,
        passwordHash: newHash
      });
      alert("DOB Password saved! You can now log in using this Date of Birth.");
      document.getElementById("dob-prompt-card")?.remove();
    });
  }

  // Render QR Codes & Bind Individual Edit Triggers
  attendees.forEach((att, idx) => {
    const qrContainer = document.getElementById(`pass-qr-${idx}`);
    if (att.rawToken && window.QRCode) {
      new window.QRCode(qrContainer, {
        text: JSON.stringify({ t: att.rawToken }),
        width: 155,
        height: 155,
        colorDark: theme.qr,
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }

    const editBtn = document.querySelector(`button[data-edit-index="${idx}"]`);
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        document.getElementById(`display-block-${idx}`).classList.add("hidden");
        document.getElementById(`edit-block-${idx}`).classList.remove("hidden");
      });
    }

    document.getElementById(`save-single-${idx}`).addEventListener("click", async () => {
      const name = document.getElementById(`input-name-${idx}`).value.trim();
      const age = document.getElementById(`input-age-${idx}`).value.trim().replace(/\D/g, "");

      await safeUpdateDoc(doc(db, "meetupAttendees", att.id), { memberName: name, age });
      att.memberName = name;
      att.age = age;

      if (name) {
        document.getElementById(`display-name-${idx}`).textContent = name;
        document.getElementById(`display-meta-${idx}`).innerHTML = `${age ? `Age: ${escapeHtml(age)} • ` : ""}<span class="uppercase tracking-wider">${formatCategory(att.category)}</span>`;
        document.getElementById(`edit-block-${idx}`).classList.add("hidden");
        document.getElementById(`display-block-${idx}`).classList.remove("hidden");
      }
    });
  });

  // Save All button handler
  document.getElementById("save-all-attendees").addEventListener("click", async () => {
    await Promise.all(attendees.map(async (att, idx) => {
      const name = document.getElementById(`input-name-${idx}`).value.trim();
      const age = document.getElementById(`input-age-${idx}`).value.trim().replace(/\D/g, "");
      att.memberName = name;
      att.age = age;
      return safeUpdateDoc(doc(db, "meetupAttendees", att.id), { memberName: name, age });
    }));
    alert("All attendee records updated.");
    renderFamilyPassCards(registration, attendees);
  });

  // PDF Export
  document.getElementById("download-pass-pdf").addEventListener("click", () => {
  if (!window.jspdf?.jsPDF) return alert("PDF generator is loading, please try again.");

  // Standard A4 dimensions: 210mm x 297mm
  const pdf = new window.jspdf.jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // 2 columns x 2 rows positions: [X, Y, Width, Height]
  const cardWidth = 92;
  const cardHeight = 135;
  const positions = [
    { x: 10,  y: 10 },  // Top Left
    { x: 108, y: 10 },  // Top Right
    { x: 10,  y: 152 }, // Bottom Left
    { x: 108, y: 152 }  // Bottom Right
  ];

  attendees.forEach((att, idx) => {
    const slot = idx % 4;

    // Start a new A4 page every 4 badges (except the very first page)
    if (idx > 0 && slot === 0) {
      pdf.addPage();
    }

    const { x, y } = positions[slot];

    // Card boundary outline (dashed cut-line)
    pdf.setDrawColor(203, 213, 225); // slate-300
    pdf.setLineDashPattern([3, 3], 0);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "S");

    // Header label
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text("TA'ALUF FAMILY MEETUP 2026", x + cardWidth / 2, y + 8, { align: "center" });

    // Family Name
    pdf.setFontSize(13);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(15, 23, 42); // slate-900
    const familyTitle = `${registration.familyName || "Family"} Family`;
    pdf.text(familyTitle.length > 22 ? familyTitle.slice(0, 20) + "..." : familyTitle, x + cardWidth / 2, y + 15, { align: "center" });

    // QR Code Placement (60mm x 60mm)
    const qrEl = document.getElementById(`pass-qr-${idx}`)?.querySelector("img, canvas");
    if (qrEl) {
      const qrData = qrEl.toDataURL ? qrEl.toDataURL("image/png") : qrEl.src;
      pdf.addImage(qrData, "PNG", x + (cardWidth - 58) / 2, y + 20, 58, 58);
    }

    // Member Name
    pdf.setFontSize(11);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(30, 41, 59); // slate-800
    const memberText = att.memberName || "Attendee Pass";
    pdf.text(memberText.length > 24 ? memberText.slice(0, 22) + "..." : memberText, x + cardWidth / 2, y + 88, { align: "center" });

    // Sub-info (Age & Category)
    pdf.setFontSize(8.5);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(100, 116, 139); // slate-500
    const metaText = [att.age ? `Age: ${att.age}` : "", formatCategory(att.category)].filter(Boolean).join(" • ");
    pdf.text(metaText, x + cardWidth / 2, y + 95, { align: "center" });

    // Color Group Pill / Badge at Bottom
    pdf.setLineDashPattern([], 0); // Reset dash
    const groupColors = {
      red: [225, 29, 72],
      blue: [37, 99, 235],
      green: [5, 150, 105]
    };
    const rgb = groupColors[registration.groupColor?.toLowerCase()] || [15, 23, 42];
    pdf.setFillColor(...rgb);
    pdf.roundedRect(x + (cardWidth - 44) / 2, y + 104, 44, 7.5, 3.5, 3.5, "F");

    pdf.setFontSize(7.5);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${(registration.groupColor || "").toUpperCase()} GROUP`, x + cardWidth / 2, y + 109, { align: "center" });

    // Card Footer Meta
    pdf.setFontSize(7);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Badge #${idx + 1}  •  ${registration.registrationNo || ""}`, x + cardWidth / 2, y + 126, { align: "center" });
  });

  pdf.save(`${(registration.familyName || "passes").replace(/\s+/g, "_")}_4perA4.pdf`);
});
}

function formatCategory(cat) {
  return { below5: "Below 5 Yrs", age5to12: "Age 5-12", above12: "Above 12" }[cat] || cat || "General";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]);
}

// -------------------------------------------------------------
// VERIFICATION DESK VIEW
// -------------------------------------------------------------
function renderDeskView() {
  app.className = "min-h-screen bg-slate-100 text-slate-900";
  app.innerHTML = `
    <main class="mx-auto max-w-xl p-5 sm:p-8">
      <section id="desk-login-card" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Family Meetup 2026</p>
        <h1 class="mt-2 text-2xl font-black">Verification Desk</h1>
        <form id="desk-login-form" class="mt-5 space-y-4">
          <input id="desk-user" required placeholder="Desk username" class="w-full rounded-xl border border-slate-300 px-4 py-3" />
          <input id="desk-pass" required type="password" placeholder="Password" class="w-full rounded-xl border border-slate-300 px-4 py-3" />
          <p id="desk-error" class="hidden rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700"></p>
          <button id="desk-login-btn" class="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700">Open Desk</button>
          <div class="text-center pt-2">
            <a href="javascript:void(0)" onclick="navigate('login')" class="text-xs text-slate-500 hover:underline">Back to Admin</a>
          </div>
        </form>
      </section>

      <section id="desk-scanner-card" class="hidden space-y-5">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-black">QR Entry Scanner</h1>
          <button id="desk-signout" class="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Sign out</button>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div id="qr-reader" class="overflow-hidden rounded-xl"></div>
          <div class="mt-4 flex gap-2">
            <input id="manual-token" placeholder="Manual token" class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button id="btn-manual-verify" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Verify</button>
          </div>
        </div>
        <div id="desk-result" class="hidden rounded-2xl p-5"></div>
      </section>
    </main>
  `;

  document.getElementById("desk-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("desk-error");
    const submitBtn = document.getElementById("desk-login-btn");
    errorBox.classList.add("hidden");
    submitBtn.disabled = true;

    try {
      const username = document.getElementById("desk-user").value.trim();
      const password = document.getElementById("desk-pass").value;
      const snap = await getDoc(doc(db, "users", username));

      if (!snap.exists()) throw new Error("Invalid desk user credentials.");
      const u = snap.data();
      if (u.isDeleted) throw new Error("This desk account has been disabled.");

      const hash = await sha256(password);
      if (hash.toLowerCase() !== (u.passwordHash || "").toLowerCase()) throw new Error("Incorrect password.");
      if (u.role !== "verification_desk") throw new Error("Account is not authorized for desk verification.");

      sessionStorage.setItem("deskUser", username);
      document.getElementById("desk-login-card").classList.add("hidden");
      document.getElementById("desk-scanner-card").classList.remove("hidden");
      startScanner();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("desk-signout").addEventListener("click", () => {
    sessionStorage.removeItem("deskUser");
    navigate("login");
  });

  document.getElementById("btn-manual-verify").addEventListener("click", () => {
    const token = document.getElementById("manual-token").value.trim();
    if (token) verifyToken(token);
  });
}

function startScanner() {
  if (!window.Html5QrcodeScanner) return;
  const scanner = new window.Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
  scanner.render((text) => {
    try {
      const parsed = JSON.parse(text);
      verifyToken(parsed.t || text);
    } catch (_) {
      verifyToken(text);
    }
  });
}

async function verifyToken(rawToken) {
  const resultBox = document.getElementById("desk-result");
  resultBox.classList.remove("hidden");
  resultBox.className = "rounded-2xl p-5 bg-slate-100 text-slate-800";
  resultBox.innerHTML = "Verifying pass token...";

  try {
    const tokenHash = await sha256(rawToken);
    const snap = await getDocs(query(collection(db, "meetupAttendees"), where("qrTokenHash", "==", tokenHash), where("year", "==", 2026)));

    if (snap.empty) {
      resultBox.className = "rounded-2xl p-5 bg-rose-100 text-rose-900";
      resultBox.innerHTML = "<h3 class='font-black text-lg'>❌ Invalid Pass</h3>";
      return;
    }

    const docSnap = snap.docs[0];
    const attendee = docSnap.data();

    if (attendee.status === "checked_in") {
      resultBox.className = "rounded-2xl p-5 bg-amber-100 text-amber-900";
      resultBox.innerHTML = `<h3 class="font-black text-lg">⚠️ Pass Already Used</h3><p class="text-sm">Member: <b>${attendee.memberName || "Guest"}</b> (${attendee.category})</p>`;
      return;
    }

    const deskUser = sessionStorage.getItem("deskUser") || "gate_staff";
    await safeUpdateDoc(doc(db, "meetupAttendees", docSnap.id), {
      status: "checked_in",
      checkedInAt: serverTimestamp(),
      checkedInBy: deskUser
    }, deskUser);

    resultBox.className = "rounded-2xl p-5 bg-emerald-100 text-emerald-900";
    resultBox.innerHTML = `<h3 class="font-black text-lg">✅ Check-in Verified</h3><p class="text-base font-bold">${attendee.memberName || "Guest"} (${attendee.category})</p><p class="text-sm uppercase font-semibold text-emerald-700">Group: ${attendee.groupColor}</p>`;
  } catch (err) {
    resultBox.className = "rounded-2xl p-5 bg-rose-100 text-rose-900";
    resultBox.textContent = `Error: ${err.message}`;
  }
}

// Bootstrap
renderApp();
