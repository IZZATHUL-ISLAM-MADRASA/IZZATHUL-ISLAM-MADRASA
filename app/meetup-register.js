// meetup-register.js
import { 
  db, 
  doc, 
  collection, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  updateDoc, 
  serverTimestamp, 
  sha256, 
  generateSecureToken 
} from "./firebase-config.js";

const state = {
  step: 1,
  registrationType: "student_family",
  selectedStudents: [],
  familyName: "",
  mobileNo: "",
  rawDob: "",
  counts: { below5: 0, age5to12: 0, above12: 1 },
  assignedGroupColor: "",
  generatedRegistrationNo: "",
  attendeesList: []
};

export function renderMeetupRegister() {
  const app = document.getElementById("app");
  document.title = "Family Meetup 2026 — Registration";
  app.className = "bg-slate-100 text-slate-900 min-h-screen flex flex-col font-sans antialiased";

  app.innerHTML = `
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm no-print">
      <div class="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-2xl">🎪</span>
          <div>
            <h1 class="font-extrabold text-base tracking-tight text-slate-800">FAMILY MEETUP 2026</h1>
            <p class="text-xs text-slate-500 font-medium">Together • Connect • Celebrate</p>
          </div>
        </div>
        <button id="btn-goto-login" class="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition">
          Find Passes
        </button>
      </div>
    </header>

    <!-- Main Stepper Card -->
    <main class="flex-grow max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start">
      <!-- Stepper -->
      <div id="stepper" class="flex items-center justify-between px-6 py-4 mb-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div class="flex flex-col items-center">
          <div id="indicator-1" class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow">1</div>
          <span class="text-[11px] font-semibold mt-1 text-slate-600">Type</span>
        </div>
        <div class="flex-1 h-0.5 bg-slate-200 mx-2 mb-4"></div>
        <div class="flex flex-col items-center">
          <div id="indicator-2" class="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">2</div>
          <span class="text-[11px] font-semibold mt-1 text-slate-600">Family</span>
        </div>
        <div class="flex-1 h-0.5 bg-slate-200 mx-2 mb-4"></div>
        <div class="flex flex-col items-center">
          <div id="indicator-3" class="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">3</div>
          <span class="text-[11px] font-semibold mt-1 text-slate-600">Count</span>
        </div>
        <div class="flex-1 h-0.5 bg-slate-200 mx-2 mb-4"></div>
        <div class="flex flex-col items-center">
          <div id="indicator-4" class="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">4</div>
          <span class="text-[11px] font-semibold mt-1 text-slate-600">Confirm</span>
        </div>
      </div>

      <!-- Step 1: Type Selection -->
      <section id="step-1" class="space-y-4">
        <div class="text-center mb-6">
          <h2 class="text-xl font-extrabold text-slate-800">Select Category</h2>
          <p class="text-sm text-slate-500 mt-1">Choose your family category.</p>
        </div>
        <div class="grid grid-cols-1 gap-4">
          <button type="button" id="btn-type-student" class="p-5 text-left bg-white border border-slate-200 rounded-2xl shadow-sm transition hover:shadow-md flex items-start space-x-4 ring-2 ring-indigo-600 bg-indigo-50">
            <div class="p-3 bg-indigo-100 text-indigo-700 rounded-xl text-2xl">🎓</div>
            <div>
              <h3 class="font-bold text-slate-800 text-base">Student Family</h3>
              <p class="text-xs text-slate-500 mt-1">For parents with children currently enrolled in the institution.</p>
            </div>
          </button>
          <button type="button" id="btn-type-general" class="p-5 text-left bg-white border border-slate-200 rounded-2xl shadow-sm transition hover:shadow-md flex items-start space-x-4">
            <div class="p-3 bg-slate-100 text-slate-700 rounded-xl text-2xl">👨‍👩‍👧</div>
            <div>
              <h3 class="font-bold text-slate-800 text-base">General / Guest Family</h3>
              <p class="text-xs text-slate-500 mt-1">For guests, neighbors, alumni, and friends.</p>
            </div>
          </button>
        </div>
        <div class="pt-4">
          <button type="button" id="step1-next" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition">Continue</button>
        </div>
      </section>

      <!-- Step 2: Family Info -->
      <section id="step-2" class="space-y-5 hidden">
        <div class="text-center mb-4">
          <h2 class="text-xl font-extrabold text-slate-800">Family Identification</h2>
          <p class="text-sm text-slate-500 mt-1">Used to access and print your badges.</p>
        </div>

        <div id="student-search-block" class="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Attach Enrolled Student</label>
          <div class="flex space-x-2">
            <input type="text" id="student-search-input" placeholder="Admission No (e.g. AD102)" class="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
            <button type="button" id="btn-search-student" class="px-4 py-2.5 bg-slate-800 text-white font-semibold text-sm rounded-xl hover:bg-slate-700 transition">Search</button>
          </div>
          <p id="student-search-feedback" class="text-xs text-rose-500 font-medium hidden"></p>
          <div id="selected-students-list" class="space-y-2 pt-1"></div>
        </div>

        <div class="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Family Name</label>
            <input type="text" id="input-family-name" placeholder="e.g. Rasheed Family" class="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">WhatsApp / Mobile Number</label>
            <input type="tel" id="input-mobile" maxlength="10" placeholder="10-digit mobile number" class="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date of Birth (Password)</label>
            <input type="text" id="input-dob" maxlength="8" placeholder="DDMMYYYY (e.g. 15081990)" class="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm tracking-wider focus:ring-2 focus:ring-indigo-600 focus:outline-none font-mono" />
            <p class="text-[11px] text-slate-400 mt-1">Used as your password together with your phone number.</p>
          </div>
        </div>

        <div class="flex space-x-3 pt-2">
          <button type="button" id="step2-back" class="w-1/3 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">Back</button>
          <button type="button" id="step2-next" class="w-2/3 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition">Continue</button>
        </div>
      </section>

      <!-- Step 3: Counts -->
      <section id="step-3" class="space-y-4 hidden">
        <div class="text-center mb-4">
          <h2 class="text-xl font-extrabold text-slate-800">Who is Attending?</h2>
          <p class="text-sm text-slate-500 mt-1">A personal QR badge will be generated for each attendee.</p>
        </div>

        <div class="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div class="font-bold text-slate-800 text-sm">Below 5 Years</div>
              <div class="text-xs text-slate-400">Infants & Toddlers</div>
            </div>
            <div class="flex items-center space-x-3">
              <button type="button" id="btn-below5-minus" class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-extrabold text-lg flex items-center justify-center transition">−</button>
              <span id="count-below5" class="w-6 text-center font-bold text-base text-slate-800 font-mono">0</span>
              <button type="button" id="btn-below5-plus" class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-extrabold text-lg flex items-center justify-center transition">+</button>
            </div>
          </div>

          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div class="font-bold text-slate-800 text-sm">Age 5–12 Years</div>
              <div class="text-xs text-slate-400">Primary & Junior</div>
            </div>
            <div class="flex items-center space-x-3">
              <button type="button" id="btn-age5to12-minus" class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-extrabold text-lg flex items-center justify-center transition">−</button>
              <span id="count-age5to12" class="w-6 text-center font-bold text-base text-slate-800 font-mono">0</span>
              <button type="button" id="btn-age5to12-plus" class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-extrabold text-lg flex items-center justify-center transition">+</button>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-800 text-sm">Above 12 Years</div>
              <div class="text-xs text-slate-400">Adults & Youths</div>
            </div>
            <div class="flex items-center space-x-3">
              <button type="button" id="btn-above12-minus" class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-extrabold text-lg flex items-center justify-center transition">−</button>
              <span id="count-above12" class="w-6 text-center font-bold text-base text-slate-800 font-mono">1</span>
              <button type="button" id="btn-above12-plus" class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-extrabold text-lg flex items-center justify-center transition">+</button>
            </div>
          </div>
        </div>

        <div class="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
          <span class="text-sm font-bold text-indigo-900">Total Attendees</span>
          <span id="count-total" class="text-xl font-black text-indigo-700">1</span>
        </div>

        <div class="flex space-x-3 pt-2">
          <button type="button" id="step3-back" class="w-1/3 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">Back</button>
          <button type="button" id="step3-next" class="w-2/3 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition">Review Details</button>
        </div>
      </section>

      <!-- Step 4: Summary -->
      <section id="step-4" class="space-y-4 hidden">
        <div class="text-center mb-4">
          <h2 class="text-xl font-extrabold text-slate-800">Verify Registration</h2>
          <p class="text-sm text-slate-500 mt-1">Confirm details before issuing passes.</p>
        </div>

        <div class="p-5 bg-white rounded-2xl border border-slate-200 space-y-3 text-sm">
          <div class="flex justify-between pb-2 border-b border-slate-100">
            <span class="text-slate-500">Category</span>
            <span id="review-type" class="font-bold text-slate-800"></span>
          </div>
          <div class="flex justify-between pb-2 border-b border-slate-100">
            <span class="text-slate-500">Family Name</span>
            <span id="review-family-name" class="font-bold text-slate-800"></span>
          </div>
          <div class="flex justify-between pb-2 border-b border-slate-100">
            <span class="text-slate-500">Mobile</span>
            <span id="review-mobile" class="font-bold text-slate-800 font-mono"></span>
          </div>
          <div id="review-students-container" class="pb-2 border-b border-slate-100 hidden">
            <span class="text-slate-500 block mb-1">Attached Students:</span>
            <span id="review-students" class="font-semibold text-slate-800 block text-xs bg-slate-50 p-2 rounded-lg"></span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Breakdown</span>
            <span id="review-counts" class="font-semibold text-slate-800 text-right"></span>
          </div>
        </div>

        <div class="flex space-x-3 pt-2">
          <button type="button" id="step4-back" class="w-1/3 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">Edit</button>
          <button type="button" id="step4-submit" class="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-2">
            <span>Confirm & Issue Passes</span>
            <span id="submit-spinner" class="hidden">⏳</span>
          </button>
        </div>
      </section>

      <!-- Step 5: Passes View -->
      <section id="step-5" class="space-y-6 hidden">
        <div class="text-center">
          <div class="inline-flex p-3 bg-emerald-100 text-emerald-600 rounded-full text-3xl mb-2">🎉</div>
          <h2 class="text-2xl font-black text-slate-800 tracking-tight">Registration Complete!</h2>
          <div class="mt-4 flex flex-col items-center space-y-1">
            <div id="result-color-badge" class="px-4 py-1 text-sm font-bold text-white rounded-full">GROUP</div>
            <span class="text-xs font-mono text-slate-400 font-semibold pt-1">Pass ID: <span id="result-reg-no"></span></span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 no-print sm:grid-cols-4">
          <button id="save-all-members" type="button" class="rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white">Save all</button>
          <button id="show-all-qr" type="button" class="rounded-xl bg-slate-800 py-3 text-xs font-bold text-white">Show QR</button>
          <button id="print-all-badges" type="button" class="rounded-xl bg-slate-900 py-3 text-xs font-bold text-white">Print</button>
          <button id="download-pdf" type="button" class="rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white">PDF</button>
        </div>

        <div class="no-print overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div class="border-b border-slate-100 px-4 py-3"><h3 class="font-black text-slate-800">Member Details</h3></div>
          <div id="member-details-body" class="divide-y divide-slate-100"></div>
        </div>

        <div id="print-area">
          <div id="qr-cards-container" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
        </div>
      </section>
    </main>
  `;

  attachRegisterEvents();
}

function attachRegisterEvents() {
  document.getElementById("btn-goto-login").addEventListener("click", () => {
    window.navigate("family-login");
  });

  document.getElementById("btn-type-student").addEventListener("click", () => {
    state.registrationType = "student_family";
    toggleTypeButtons(true);
  });
  document.getElementById("btn-type-general").addEventListener("click", () => {
    state.registrationType = "general_family";
    toggleTypeButtons(false);
  });

  document.getElementById("step1-next").addEventListener("click", () => goToStep(2));
  document.getElementById("step2-back").addEventListener("click", () => goToStep(1));
  document.getElementById("step2-next").addEventListener("click", validateStep2);
  document.getElementById("step3-back").addEventListener("click", () => goToStep(2));
  document.getElementById("step3-next").addEventListener("click", validateStep3);
  document.getElementById("step4-back").addEventListener("click", () => goToStep(3));
  document.getElementById("step4-submit").addEventListener("click", executeRegistration);

  document.getElementById("btn-search-student").addEventListener("click", searchStudent);

  setupCounterEvents("below5");
  setupCounterEvents("age5to12");
  setupCounterEvents("above12");

  ["input-mobile", "input-dob"].forEach(id => {
    document.getElementById(id).addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  });
}

function toggleTypeButtons(isStudent) {
  document.getElementById("student-search-block").classList.toggle("hidden", !isStudent);
  document.getElementById("btn-type-student").className = `p-5 text-left bg-white border border-slate-200 rounded-2xl shadow-sm transition hover:shadow-md flex items-start space-x-4 ${isStudent ? "ring-2 ring-indigo-600 bg-indigo-50" : ""}`;
  document.getElementById("btn-type-general").className = `p-5 text-left bg-white border border-slate-200 rounded-2xl shadow-sm transition hover:shadow-md flex items-start space-x-4 ${!isStudent ? "ring-2 ring-indigo-600 bg-indigo-50" : ""}`;
}

function setupCounterEvents(k) {
  document.getElementById(`btn-${k}-minus`).addEventListener("click", () => {
    if (state.counts[k] > 0 && (getTotal() - 1) >= 1) {
      state.counts[k]--;
      updateCounters();
    }
  });
  document.getElementById(`btn-${k}-plus`).addEventListener("click", () => {
    if (getTotal() < 20) {
      state.counts[k]++;
      updateCounters();
    } else {
      alert("Maximum 20 attendees allowed per registration.");
    }
  });
}

function getTotal() {
  return state.counts.below5 + state.counts.age5to12 + state.counts.above12;
}

function updateCounters() {
  document.getElementById("count-below5").innerText = state.counts.below5;
  document.getElementById("count-age5to12").innerText = state.counts.age5to12;
  document.getElementById("count-above12").innerText = state.counts.above12;
  document.getElementById("count-total").innerText = getTotal();
}

function goToStep(n) {
  state.step = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.toggle("hidden", i !== n);
  }
  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById(`indicator-${i}`);
    if (!ind) continue;
    if (i < n) {
      ind.className = "w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow";
      ind.innerHTML = "✓";
    } else if (i === n) {
      ind.className = "w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow";
      ind.innerText = i;
    } else {
      ind.className = "w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm";
      ind.innerText = i;
    }
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function searchStudent() {
  const val = document.getElementById("student-search-input").value.trim();
  const feedback = document.getElementById("student-search-feedback");
  if (!val) return;

  try {
    const snap = await getDocs(query(collection(db, "students"), where("adNo", "==", val)));
    if (snap.empty) {
      feedback.textContent = "No student found with this Admission Number.";
      feedback.classList.remove("hidden");
      return;
    }
    feedback.classList.add("hidden");
    const d = snap.docs[0].data();
    if (state.selectedStudents.some(s => s.adNo === d.adNo)) return;

    state.selectedStudents.push({ docId: snap.docs[0].id, adNo: d.adNo, name: d.name, classDiv: `${d.class || ""}-${d.div || ""}` });
    renderStudentsList();
    document.getElementById("student-search-input").value = "";
  } catch (err) {
    feedback.textContent = err.message;
    feedback.classList.remove("hidden");
  }
}

function renderStudentsList() {
  const container = document.getElementById("selected-students-list");
  container.innerHTML = "";
  state.selectedStudents.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm";
    row.innerHTML = `<div><span class="font-semibold text-slate-800">${s.name}</span><span class="text-slate-500 ml-2">(${s.adNo} | ${s.classDiv})</span></div><button type="button" class="text-rose-500 font-bold ml-4">✕</button>`;
    row.querySelector("button").onclick = () => {
      state.selectedStudents.splice(idx, 1);
      renderStudentsList();
    };
    container.appendChild(row);
  });
}

function validateStep2() {
  const name = document.getElementById("input-family-name").value.trim();
  const mobile = document.getElementById("input-mobile").value.trim();
  const dob = document.getElementById("input-dob").value.trim();

  if (state.registrationType === "student_family" && !state.selectedStudents.length) {
    return alert("Please attach at least one student.");
  }
  if (!name || name.length < 2) return alert("Please enter family name.");
  if (mobile.length !== 10) return alert("Enter valid 10-digit mobile.");
  if (dob.length !== 8) return alert("Enter 8-digit DOB (DDMMYYYY).");

  state.familyName = name;
  state.mobileNo = mobile;
  state.rawDob = dob;
  goToStep(3);
}

function validateStep3() {
  if (getTotal() < 1) return alert("Minimum 1 attendee required.");
  document.getElementById("review-type").innerText = state.registrationType === "student_family" ? "Student Family" : "General Family";
  document.getElementById("review-family-name").innerText = state.familyName;
  document.getElementById("review-mobile").innerText = state.mobileNo;
  document.getElementById("review-counts").innerText = `Below 5: ${state.counts.below5} | 5-12: ${state.counts.age5to12} | Above 12: ${state.counts.above12} (Total: ${getTotal()})`;

  const sBox = document.getElementById("review-students-container");
  if (state.registrationType === "student_family" && state.selectedStudents.length) {
    sBox.classList.remove("hidden");
    document.getElementById("review-students").innerText = state.selectedStudents.map(s => `${s.name} (${s.adNo})`).join(", ");
  } else {
    sBox.classList.add("hidden");
  }
  goToStep(4);
}

async function executeRegistration() {
  const btn = document.getElementById("step4-submit");
  const sp = document.getElementById("submit-spinner");
  btn.disabled = true;
  sp.classList.remove("hidden");

  try {
    const currentYear = 2026;
    const settingsDocRef = doc(db, "meetupSettings", "current");

    // Check duplicate phone
    const dupSnap = await getDocs(query(collection(db, "meetupRegistrations"), where("mobileNo", "==", state.mobileNo), where("year", "==", currentYear), where("status", "==", "confirmed")));
    if (!dupSnap.empty) throw new Error("A registration with this mobile number already exists for Meetup 2026.");

    const hashedDob = await sha256(state.rawDob);

    const result = await runTransaction(db, async (t) => {
      const sSnap = await t.get(settingsDocRef);
      if (!sSnap.exists() || !sSnap.data().registrationOpen) throw new Error("Online registration is currently closed.");

      const settings = sSnap.data();
      const colors = settings.colors || ["red", "blue", "green"];
      const currentIndex = settings.currentColorIndex || 0;
      const assignedColor = colors[currentIndex];
      const nextIndex = (currentIndex + 1) % colors.length;

      const regRef = doc(collection(db, "meetupRegistrations"));
      const regNo = `FM${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;

      const attendees = [];
      const makeAtt = (cat, seq) => {
        const ref = doc(collection(db, "meetupAttendees"));
        const rawToken = generateSecureToken(24);
        return {
          ref,
          rawToken,
          data: {
            registrationId: regRef.id,
            year: currentYear,
            sequenceNo: seq,
            category: cat,
            groupColor: assignedColor,
            rawToken,
            memberName: "",
            status: "unused",
            createdAt: serverTimestamp()
          }
        };
      };

      let seq = 1;
      for (let i = 0; i < state.counts.below5; i++) attendees.push(makeAtt("below5", seq++));
      for (let i = 0; i < state.counts.age5to12; i++) attendees.push(makeAtt("age5to12", seq++));
      for (let i = 0; i < state.counts.above12; i++) attendees.push(makeAtt("above12", seq++));

      t.update(settingsDocRef, { currentColorIndex: nextIndex });
      t.set(regRef, {
        registrationNo: regNo,
        year: currentYear,
        registrationType: state.registrationType,
        familyName: state.familyName,
        mobileNo: state.mobileNo,
        passwordHash: hashedDob,
        dobHash: hashedDob,
        studentIds: state.selectedStudents.map(s => s.docId),
        attendeeCounts: { ...state.counts },
        totalAttendees: getTotal(),
        groupColor: assignedColor,
        status: "confirmed",
        registeredAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (const a of attendees) {
        t.set(a.ref, { ...a.data, qrTokenHash: await sha256(a.rawToken) });
      }

      return { registrationNo: regNo, assignedColor, attendees };
    });

    state.assignedGroupColor = result.assignedColor;
    state.generatedRegistrationNo = result.registrationNo;
    state.attendeesList = result.attendees;

    renderIssuedPasses();
    goToStep(5);
  } catch (err) {
    alert(err.message || "Registration failed.");
  } finally {
    btn.disabled = false;
    sp.classList.add("hidden");
  }
}

function renderIssuedPasses() {
  document.getElementById("result-reg-no").innerText = state.generatedRegistrationNo;
  const badge = document.getElementById("result-color-badge");
  badge.className = `px-4 py-1 text-sm font-bold text-white rounded-full uppercase ${{ red: "bg-rose-600", blue: "bg-blue-600", green: "bg-emerald-600" }[state.assignedGroupColor] || "bg-indigo-600"}`;
  badge.innerText = `${state.assignedGroupColor} Group`;

  const container = document.getElementById("qr-cards-container");
  container.innerHTML = "";
  const detailsBody = document.getElementById("member-details-body");
  detailsBody.innerHTML = "";

  state.attendeesList.forEach((att, idx) => {
    const card = document.createElement("div");
    card.className = "print-pass bg-white p-5 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center";
    card.innerHTML = `
      <div class="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-2">Family Meetup 2026</div>
      <div class="font-black text-2xl text-slate-800 uppercase mb-2">${state.familyName} Family</div>
      <div id="issued-qr-${idx}" class="p-2 bg-white rounded-lg border border-slate-100 shadow-sm my-4"></div>
      <div class="font-black text-lg text-slate-700">${att.data.category}</div>
    `;
    container.appendChild(card);

    if (att.rawToken && window.QRCode) {
      new window.QRCode(document.getElementById(`issued-qr-${idx}`), {
        text: JSON.stringify({ t: att.rawToken }),
        width: 170,
        height: 170,
        colorDark: { red: "#e11d48", blue: "#2563eb", green: "#059669" }[state.assignedGroupColor] || "#0f172a"
      });
    }

    const row = document.createElement("div");
    row.className = "grid grid-cols-[1fr_5rem_auto] items-center gap-2 p-3";
    row.innerHTML = `<input id="det-name-${idx}" placeholder="Member name" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs" /><input id="det-age-${idx}" placeholder="Age" class="w-16 rounded-lg border border-slate-300 px-3 py-1.5 text-xs" /><button type="button" class="btn-save-member rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">Save</button>`;
    detailsBody.appendChild(row);

    row.querySelector(".btn-save-member").onclick = async () => {
      const name = document.getElementById(`det-name-${idx}`).value.trim();
      const age = document.getElementById(`det-age-${idx}`).value.trim();
      await updateDoc(att.ref, { memberName: name, age });
      alert("Saved.");
    };
  });

  document.getElementById("print-all-badges").onclick = () => window.print();
}
