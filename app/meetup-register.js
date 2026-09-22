// meetup-register.js
import { 
  db, 
  doc, 
  collection, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  serverTimestamp, 
  sha256, 
  generateSecureToken 
} from "./firebase-config.js";

// Clean initial state factory
function getInitialState() {
  return {
    step: 1,
    registrationType: "student_family",
    selectedStudents: [],
    familyName: "",
    mobileNo: "",
    rawDob: "",
    counts: { below5: 0, age5to12: 0, above12: 1 }
  };
}

let state = getInitialState();

export function renderMeetupRegister() {
  // Always reset state cleanly on load to prevent carryover counts
  state = getInitialState();

  const app = document.getElementById("app");
  document.title = "Family Registration | Ta'aluf Gathering";
  app.className = "bg-slate-100 text-slate-900 min-h-screen flex flex-col font-sans antialiased";

  app.innerHTML = `
    <!-- Sticky Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      <div class="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div class="flex items-center space-x-2.5 cursor-pointer" onclick="window.navigate('landing')">
          <div class="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg">
            🎪
          </div>
          <div>
            <h1 class="font-black text-xs sm:text-sm text-slate-900 tracking-tight leading-tight">TA'ALUF FAMILY GATHERING</h1>
            <p class="text-[10px] font-semibold text-emerald-700">Togetherness • Harmony • Barakah</p>
          </div>
        </div>
        <button onclick="window.navigate('family-login')" class="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition">
          Find Passes
        </button>
      </div>
    </header>

    <!-- Main Stepper Container -->
    <main class="flex-grow max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start">
      
      <!-- Visual Step Progress Bar -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-3.5 mb-6 shadow-xs flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span id="step-badge-1" class="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-black flex items-center justify-center">1</span>
          <span id="step-label-1" class="text-xs font-bold text-slate-900">Category</span>
        </div>
        <div class="flex-1 h-0.5 bg-slate-200 mx-2"></div>
        <div class="flex items-center space-x-2">
          <span id="step-badge-2" class="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-black flex items-center justify-center">2</span>
          <span id="step-label-2" class="text-xs font-semibold text-slate-400">Identity</span>
        </div>
        <div class="flex-1 h-0.5 bg-slate-200 mx-2"></div>
        <div class="flex items-center space-x-2">
          <span id="step-badge-3" class="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-black flex items-center justify-center">3</span>
          <span id="step-label-3" class="text-xs font-semibold text-slate-400">Counts</span>
        </div>
      </div>

      <!-- Active Step Panel -->
      <div id="step-container" class="space-y-5"></div>
    </main>
  `;

  renderStep(1);
}

function updateStepperUI(currentStep) {
  for (let s = 1; s <= 3; s++) {
    const badge = document.getElementById(`step-badge-${s}`);
    const label = document.getElementById(`step-label-${s}`);
    if (!badge || !label) continue;

    if (s < currentStep) {
      badge.className = "w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center";
      badge.innerHTML = "✓";
      label.className = "text-xs font-bold text-slate-700";
    } else if (s === currentStep) {
      badge.className = "w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-black flex items-center justify-center";
      badge.innerText = s;
      label.className = "text-xs font-black text-slate-900";
    } else {
      badge.className = "w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center";
      badge.innerText = s;
      label.className = "text-xs font-semibold text-slate-400";
    }
  }
}

function renderStep(step) {
  state.step = step;
  updateStepperUI(step);
  const container = document.getElementById("step-container");

  // -------------------------------------------------------------
  // STEP 1: CATEGORY SELECTION
  // -------------------------------------------------------------
  if (step === 1) {
    container.innerHTML = `
      <div class="text-center mb-2">
        <h2 class="text-xl font-black text-slate-900">Select Family Category</h2>
        <p class="text-xs text-slate-500 mt-0.5">Please specify your affiliation with Izzathul Islam Madrasa.</p>
      </div>

      <div class="space-y-3 pt-2">
        <button id="type-student" type="button" class="w-full p-5 text-left bg-white border-2 ${state.registrationType === 'student_family' ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-200'} rounded-3xl shadow-xs transition hover:border-emerald-500 group">
          <div class="flex items-center space-x-3.5">
            <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl group-hover:scale-105 transition shrink-0">
              🎓
            </div>
            <div>
              <h3 class="font-black text-slate-900 text-sm">Madrasa Student Family</h3>
              <p class="text-xs text-slate-500 mt-0.5">For parents and guardians of currently enrolled students.</p>
            </div>
          </div>
        </button>

        <button id="type-general" type="button" class="w-full p-5 text-left bg-white border-2 ${state.registrationType === 'general_family' ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-200'} rounded-3xl shadow-xs transition hover:border-emerald-500 group">
          <div class="flex items-center space-x-3.5">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-2xl group-hover:scale-105 transition shrink-0">
              👨‍👩‍👧
            </div>
            <div>
              <h3 class="font-black text-slate-900 text-sm">General / Well-Wisher Family</h3>
              <p class="text-xs text-slate-500 mt-0.5">For alumni, community members, neighbors, and invited guests.</p>
            </div>
          </div>
        </button>
      </div>

      <div class="pt-4">
        <button id="btn-s1-next" class="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-700/20 transition active:scale-[0.99]">
          Continue to Identity Details →
        </button>
      </div>
    `;

    document.getElementById("type-student").onclick = () => {
      state.registrationType = "student_family";
      renderStep(1);
    };
    document.getElementById("type-general").onclick = () => {
      state.registrationType = "general_family";
      renderStep(1);
    };
    document.getElementById("btn-s1-next").onclick = () => renderStep(2);
  }

  // -------------------------------------------------------------
  // STEP 2: FAMILY & CREDENTIALS
  // -------------------------------------------------------------
  else if (step === 2) {
    container.innerHTML = `
      <div class="text-center mb-2">
        <h2 class="text-xl font-black text-slate-900">Family Identification</h2>
        <p class="text-xs text-slate-500 mt-0.5">These credentials protect your passes and gate badges.</p>
      </div>

      ${state.registrationType === "student_family" ? `
        <!-- Student Verification Block -->
        <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500">Attach Enrolled Student</label>
          <div class="flex gap-2">
            <input id="in-adno" placeholder="Admission No (e.g. AD101)" class="min-w-0 flex-1 p-3 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase outline-none focus:border-emerald-600" />
            <button id="btn-search-adno" type="button" class="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition">
              Verify
            </button>
          </div>
          <p id="adno-feedback" class="text-xs font-bold text-rose-600 hidden"></p>
          <div id="attached-students" class="space-y-1.5 pt-1">
            ${state.selectedStudents.map((s, idx) => `
              <div class="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-950">
                <span>🎓 ${s.name} (${s.adNo} • ${s.classDiv})</span>
                <button type="button" onclick="window.removeStudent(${idx})" class="text-rose-600 hover:text-rose-800 text-sm">✕</button>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div>
          <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Family Reference Name</label>
          <input id="in-fam-name" value="${state.familyName}" placeholder="e.g. Al-Farhan Family" class="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" />
        </div>
        <div>
          <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">10-Digit WhatsApp Mobile</label>
          <input id="in-fam-mobile" maxlength="10" inputmode="numeric" value="${state.mobileNo}" placeholder="9876543210" class="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" />
        </div>
        <div>
          <label class="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Date of Birth Password (DDMMYYYY)</label>
          <input id="in-fam-dob" maxlength="8" inputmode="numeric" value="${state.rawDob}" placeholder="15081992" class="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" />
          <p class="text-[10px] text-slate-400 mt-1">Used to access and print your badges later alongside your phone number.</p>
        </div>
      </div>

      <div class="flex gap-2 pt-2">
        <button onclick="window.renderStep(1)" class="w-1/3 py-3.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition">Back</button>
        <button id="btn-s2-next" class="w-2/3 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition">Specify Attendees →</button>
      </div>
    `;

    // Numeric input sanitizers
    ["in-fam-mobile", "in-fam-dob"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", e => {
        e.target.value = e.target.value.replace(/\D/g, "");
      });
    });

    // Student Lookup handler
    const btnSearch = document.getElementById("btn-search-adno");
    if (btnSearch) {
      btnSearch.onclick = async () => {
        const inputEl = document.getElementById("in-adno");
        const feedback = document.getElementById("adno-feedback");
        const adNo = inputEl.value.trim();
        if (!adNo) return;

        try {
          feedback.classList.add("hidden");
          const snap = await getDocs(query(collection(db, "students"), where("adNo", "==", adNo)));
          if (snap.empty || snap.docs[0].data().isDeleted) {
            feedback.textContent = `No active student found with Admission No "${adNo}".`;
            feedback.classList.remove("hidden");
            return;
          }
          const s = snap.docs[0].data();
          if (state.selectedStudents.some(item => item.adNo === s.adNo)) {
            feedback.textContent = "Student already attached.";
            feedback.classList.remove("hidden");
            return;
          }
          state.selectedStudents.push({
            adNo: s.adNo,
            name: s.name,
            classDiv: `${s.class || ""}-${s.div || ""}`
          });
          inputEl.value = "";
          renderStep(2);
        } catch (e) {
          feedback.textContent = e.message;
          feedback.classList.remove("hidden");
        }
      };
    }

    document.getElementById("btn-s2-next").onclick = () => {
      const name = document.getElementById("in-fam-name").value.trim();
      const mobile = document.getElementById("in-fam-mobile").value.trim().replace(/\D/g, "");
      const dob = document.getElementById("in-fam-dob").value.trim().replace(/\D/g, "");

      if (state.registrationType === "student_family" && !state.selectedStudents.length) {
        return alert("Please verify and attach at least one enrolled madrasa student.");
      }
      if (name.length < 2) return alert("Please enter your family name.");
      if (mobile.length !== 10) return alert("Please provide a valid 10-digit mobile number.");
      if (dob.length !== 8) return alert("Please provide an 8-digit DOB in DDMMYYYY format.");

      state.familyName = name;
      state.mobileNo = mobile;
      state.rawDob = dob;
      renderStep(3);
    };
  }

  // -------------------------------------------------------------
  // STEP 3: ATTENDEE COUNTS & PREVIEW
  // -------------------------------------------------------------
  else if (step === 3) {
    const total = Number(state.counts.below5) + Number(state.counts.age5to12) + Number(state.counts.above12);

    container.innerHTML = `
      <div class="text-center mb-2">
        <h2 class="text-xl font-black text-slate-900">How Many Will Attend?</h2>
        <p class="text-xs text-slate-500 mt-0.5">Exactly 1 unique QR entry pass will be generated per attendee.</p>
      </div>

      <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <!-- Below 5 -->
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <p class="text-xs font-black text-slate-900">Infants & Toddlers</p>
            <p class="text-[11px] font-medium text-slate-400">Below 5 Years</p>
          </div>
          <div class="flex gap-3 items-center">
            <button id="m-b5" type="button" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-sm flex items-center justify-center transition">−</button>
            <span class="font-mono font-black text-sm w-4 text-center">${state.counts.below5}</span>
            <button id="p-b5" type="button" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-sm flex items-center justify-center transition">+</button>
          </div>
        </div>

        <!-- 5 to 12 -->
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <p class="text-xs font-black text-slate-900">Primary & Junior Children</p>
            <p class="text-[11px] font-medium text-slate-400">Age 5 to 12 Years</p>
          </div>
          <div class="flex gap-3 items-center">
            <button id="m-512" type="button" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-sm flex items-center justify-center transition">−</button>
            <span class="font-mono font-black text-sm w-4 text-center">${state.counts.age5to12}</span>
            <button id="p-512" type="button" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-sm flex items-center justify-center transition">+</button>
          </div>
        </div>

        <!-- Above 12 -->
        <div class="flex justify-between items-center">
          <div>
            <p class="text-xs font-black text-slate-900">Adults & Youths</p>
            <p class="text-[11px] font-medium text-slate-400">Above 12 Years (Min 1)</p>
          </div>
          <div class="flex gap-3 items-center">
            <button id="m-a12" type="button" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-sm flex items-center justify-center transition">−</button>
            <span class="font-mono font-black text-sm w-4 text-center">${state.counts.above12}</span>
            <button id="p-a12" type="button" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-sm flex items-center justify-center transition">+</button>
          </div>
        </div>
      </div>

      <!-- Registration Summary Pill -->
      <div class="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs font-black text-emerald-950 uppercase tracking-wide">Total Passes to Issue</span>
          <p class="text-[11px] text-emerald-800 font-medium">${state.familyName} (${state.mobileNo})</p>
        </div>
        <span class="font-mono text-2xl font-black text-emerald-700">${total}</span>
      </div>

      <div class="flex gap-2 pt-2">
        <button onclick="window.renderStep(2)" class="w-1/3 py-3.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition">Back</button>
        <button id="btn-submit-reg" class="w-2/3 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-700/20 transition active:scale-[0.99] flex items-center justify-center gap-2">
          <span>Confirm & Issue Passes</span>
          <span id="spinner" class="hidden animate-spin">⏳</span>
        </button>
      </div>
    `;

    // Strictly enforce numbers to avoid string accumulation bugs
    document.getElementById("m-b5").onclick = () => {
      if (state.counts.below5 > 0) {
        state.counts.below5 = Number(state.counts.below5) - 1;
        renderStep(3);
      }
    };
    document.getElementById("p-b5").onclick = () => {
      state.counts.below5 = Number(state.counts.below5) + 1;
      renderStep(3);
    };

    document.getElementById("m-512").onclick = () => {
      if (state.counts.age5to12 > 0) {
        state.counts.age5to12 = Number(state.counts.age5to12) - 1;
        renderStep(3);
      }
    };
    document.getElementById("p-512").onclick = () => {
      state.counts.age5to12 = Number(state.counts.age5to12) + 1;
      renderStep(3);
    };

    document.getElementById("m-a12").onclick = () => {
      if (state.counts.above12 > 1) {
        state.counts.above12 = Number(state.counts.above12) - 1;
        renderStep(3);
      }
    };
    document.getElementById("p-a12").onclick = () => {
      state.counts.above12 = Number(state.counts.above12) + 1;
      renderStep(3);
    };

    document.getElementById("btn-submit-reg").onclick = submitRegistration;
  }
}

window.renderStep = renderStep;
window.removeStudent = (idx) => {
  state.selectedStudents.splice(idx, 1);
  renderStep(2);
};

// -------------------------------------------------------------
// SECURE & DEDUPLICATED TRANSACTION REGISTRATION
// -------------------------------------------------------------
async function submitRegistration() {
  const btn = document.getElementById("btn-submit-reg");
  const spinner = document.getElementById("spinner");

  // Prevent multiple rapid clicks creating duplicate badges
  btn.disabled = true;
  spinner.classList.remove("hidden");

  try {
    const rawDob = state.rawDob.trim();
    const hashedPass = await sha256(rawDob);
    const colors = ["red", "blue", "green"];
    
    // Explicit numeric casting ensures the exact requested number of badges are issued
    const nBelow5 = Math.max(0, parseInt(state.counts.below5, 10) || 0);
    const nAge5to12 = Math.max(0, parseInt(state.counts.age5to12, 10) || 0);
    const nAbove12 = Math.max(1, parseInt(state.counts.above12, 10) || 1);
    const totalAttendees = nBelow5 + nAge5to12 + nAbove12;

    const resultRegNo = await runTransaction(db, async (t) => {
      // 1. Check duplicate active mobile number to prevent collision
      const dupQuery = query(
        collection(db, "meetupRegistrations"),
        where("mobileNo", "==", state.mobileNo),
        where("status", "==", "confirmed")
      );
      const dupSnap = await getDocs(dupQuery);
      const activeDup = dupSnap.docs.find(d => !d.data().isDeleted);
      if (activeDup) {
        throw new Error(`A registration for mobile ${state.mobileNo} already exists (ID: ${activeDup.id}). Please use "Find Passes" to retrieve your badges.`);
      }

      // 2. Fetch color rotation settings
      const settingsRef = doc(db, "meetupSettings", "current");
      const sSnap = await t.get(settingsRef);
      const currIdx = sSnap.exists() ? (sSnap.data().currentColorIndex || 0) : 0;
      const assignedColor = colors[currIdx % 3];

      // 3. Create deterministic registration document
      const regNo = `REG2025-${Math.floor(1000 + Math.random() * 9000)}`;
      const regRef = doc(db, "meetupRegistrations", regNo);

      t.set(regRef, {
        registrationNo: regNo,
        familyName: state.familyName,
        mobileNo: state.mobileNo,
        passwordHash: hashedPass,
        dobHash: hashedPass,
        groupColor: assignedColor,
        registrationType: state.registrationType,
        studentIds: state.selectedStudents.map(s => s.adNo),
        attendeeCounts: { below5: nBelow5, age5to12: nAge5to12, above12: nAbove12 },
        totalAttendees: totalAttendees,
        status: "confirmed",
        isDeleted: false,
        year: 2025,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update color rotation cursor
      if (sSnap.exists()) {
        t.update(settingsRef, { currentColorIndex: (currIdx + 1) % 3 });
      }

      // 4. Construct exact attendee array without loop duplication
      const attendeeSpecs = [
        ...Array(nBelow5).fill("below5"),
        ...Array(nAge5to12).fill("age5to12"),
        ...Array(nAbove12).fill("above12")
      ];

      // 5. Write each badge with a deterministic ID: [REG_NO]_att_[INDEX]
      // This prevents any chance of orphaned, ghost, or surplus QR codes
      for (let i = 0; i < attendeeSpecs.length; i++) {
        const cat = attendeeSpecs[i];
        const badgeDocId = `${regNo}_att_${i + 1}`;
        const attRef = doc(db, "meetupAttendees", badgeDocId);
        const rawToken = generateSecureToken(24);
        const tokenHash = await sha256(rawToken);

        t.set(attRef, {
          registrationId: regNo,
          sequenceNo: i + 1,
          memberName: "",
          category: cat,
          groupColor: assignedColor,
          status: "pending",
          rawToken,
          qrTokenHash: tokenHash,
          isDeleted: false,
          year: 2025,
          createdAt: serverTimestamp()
        });
      }

      return regNo;
    });

    alert(`Registration completed successfully! Your ID is: ${resultRegNo}`);
    window.navigate("family-login");
  } catch (err) {
    alert("Registration failed: " + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add("hidden");
  }
}s
