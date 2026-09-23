// family-pass.js
import { db, collection, getDocs, query, where, sha256 } from "./firebase-config.js";

// Inside renderPasses(reg, attendees) in family-pass.js
import { doc, safeUpdateDoc, generateSecureToken} from "./firebase-config.js";


// Updated renderFamilyPassView in family-pass.js
export function renderFamilyPassView() {
  const app = document.getElementById("app");
  document.title = "Family Passes | Ta'aluf Gathering";
  app.className = "min-h-screen bg-slate-50 text-slate-900";

  app.innerHTML = `
    <header class="border-b border-slate-200 bg-white no-print">
      <div class="max-w-xl mx-auto px-4 py-3.5 flex justify-between items-center">
        <h1 class="text-sm font-black cursor-pointer" onclick="window.navigate('landing')">🎪 TA'ALUF 2025</h1>
        <button onclick="window.navigate('landing')" class="text-xs font-bold text-slate-500 hover:text-slate-800">Home</button>
      </div>
    </header>

    <main class="max-w-xl mx-auto p-4 sm:p-6 space-y-4">
      <section id="lookup-card" class="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <h2 class="text-lg font-black">Find Your Passes</h2>
        <p class="text-xs text-slate-500 mt-1">
          Enter your 10-digit mobile number and your password (default: <b>last 6 digits of mobile</b>, or your 8-digit DOB DDMMYYYY).
        </p>

        <form id="lookup-form" class="mt-4 space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mobile Number</label>
            <input id="l-mobile" required maxlength="10" inputmode="numeric" placeholder="10-digit registered phone" class="w-full p-3 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <input id="l-dob" required minlength="6" maxlength="8" inputmode="numeric" placeholder="Last 6-digits of phone or DDMMYYYY" class="w-full p-3 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <button id="l-btn" class="w-full py-3.5 bg-emerald-700 text-white font-bold rounded-xl text-xs hover:bg-emerald-800 transition shadow">Find Passes</button>
        </form>
      </section>

      <section id="passes-result" class="hidden space-y-4"></section>
    </main>
  `;

  // Auto-clean non-digits
  ["l-mobile", "l-dob"].forEach(id => {
    document.getElementById(id).addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  });

  document.getElementById("lookup-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("l-btn");
    btn.disabled = true; 
    btn.textContent = "Searching...";

    try {
      const mob = document.getElementById("l-mobile").value.trim();
      const secret = document.getElementById("l-dob").value.trim();

      if (mob.length !== 10) {
        throw new Error("Please enter a valid 10-digit mobile number.");
      }

      if (secret.length !== 6 && secret.length !== 8) {
        throw new Error("Password must be either your 6-digit phone suffix or 8-digit DOB (DDMMYYYY).");
      }

      const inputHash = await sha256(secret);

      // Search by phone number
      const q = query(
        collection(db, "meetupRegistrations"), 
        where("mobileNo", "==", mob), 
        where("status", "==", "confirmed")
      );
      const snap = await getDocs(q);

      // Match against either passwordHash (6-digit default) or dobHash (custom DOB)
      const regDoc = snap.docs.find(d => {
        const item = d.data();
        if (item.isDeleted) return false;
        return item.passwordHash === inputHash || item.dobHash === inputHash;
      });

      if (!regDoc) {
        throw new Error("No confirmed registration found matching this mobile and password.");
      }

      const reg = { id: regDoc.id, ...regDoc.data() };

      // Load associated members
      const attSnap = await getDocs(query(
        collection(db, "meetupAttendees"), 
        where("registrationId", "==", regDoc.id)
      ));
      
      const attendees = attSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.isDeleted);

      renderPasses(reg, attendees);
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false; 
      btn.textContent = "Find Passes";
    }
  };
}


function exportPassesToPdf(reg, attendees) {
  if (!window.jspdf?.jsPDF) {
    alert("PDF library is still loading, please try again or use Print Badges.");
    return;
  }

  const pdf = new window.jspdf.jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const cardWidth = 92;
  const cardHeight = 135;
  const positions = [
    { x: 10,  y: 10 },
    { x: 108, y: 10 },
    { x: 10,  y: 152 },
    { x: 108, y: 152 }
  ];

  attendees.forEach((att, idx) => {
    const slot = idx % 4;
    if (idx > 0 && slot === 0) {
      pdf.addPage();
    }

    const { x, y } = positions[slot];

    // Badge border (dashed cutline)
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineDashPattern([3, 3], 0);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "S");

    // Header label
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text("TA'ALUF FAMILY GATHERING 2026", x + cardWidth / 2, y + 8, { align: "center" });

    // Family Name
    pdf.setFontSize(13);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(15, 23, 42);
    const title = `${reg.familyName || "Family"} Family`;
    pdf.text(title.length > 22 ? title.slice(0, 20) + "..." : title, x + cardWidth / 2, y + 15, { align: "center" });

    // Embed QR Image
    const qrEl = document.getElementById(`qr-box-${idx}`)?.querySelector("img, canvas");
    if (qrEl) {
      const qrData = qrEl.toDataURL ? qrEl.toDataURL("image/png") : qrEl.src;
      pdf.addImage(qrData, "PNG", x + (cardWidth - 58) / 2, y + 20, 58, 58);
    }

    // Member Name
    pdf.setFontSize(11);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(30, 41, 59);
    const memberName = att.memberName || "Attendee Pass";
    pdf.text(memberName.length > 24 ? memberName.slice(0, 22) + "..." : memberName, x + cardWidth / 2, y + 88, { align: "center" });

    // // Sub-info (Category)
    // pdf.setFontSize(8.5);
    // pdf.setFont(undefined, "normal");
    // pdf.setTextColor(100, 116, 139);
    // pdf.text(String(att.category || "").toUpperCase(), x + cardWidth / 2, y + 95, { align: "center" });

    // Color group pill
    pdf.setLineDashPattern([], 0);
    const colors = {
      red: [225, 29, 72],
      blue: [37, 99, 235],
      green: [5, 150, 105]
    };
    const rgb = colors[reg.groupColor?.toLowerCase()] || [15, 23, 42];
    pdf.setFillColor(...rgb);
    pdf.roundedRect(x + (cardWidth - 44) / 2, y + 104, 44, 7.5, 3.5, 3.5, "F");

    pdf.setFontSize(7.5);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${(reg.groupColor || "").toUpperCase()} TEAM`, x + cardWidth / 2, y + 109, { align: "center" });

    // Footer
    pdf.setFontSize(7);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Badge #${idx + 1}  •  ${reg.registrationNo || ""}`, x + cardWidth / 2, y + 126, { align: "center" });
  });

  pdf.save(`${(reg.familyName || "passes").replace(/\s+/g, "_")}_badges.pdf`);
}

async function renderPasses(reg, attendees) {
  document.getElementById("lookup-card").classList.add("hidden");
  const res = document.getElementById("passes-result");
  res.classList.remove("hidden");

  // 1. AUTO-HEAL: If rawFamilyToken is missing on older records, create it on the fly
  let token = reg.rawFamilyToken || reg.qrToken;
  if (!token) {
    // Check if any attendee has an existing token to reuse, or make a new one
    token = attendees.find(a => a.rawToken)?.rawToken || generateSecureToken(24);
    reg.rawFamilyToken = token;
    
    // Save to Firestore so the verification desk can look it up immediately
    const tokenHash = await sha256(token);
    safeUpdateDoc(doc(db, "meetupRegistrations", reg.id), {
      rawFamilyToken: token,
      qrTokenHash: tokenHash
    }).catch(err => console.warn("Background token backfill notice:", err));
  }

  const checkedCount = attendees.filter(a => a.status === "checked_in").length;

  res.innerHTML = `
    <div class="bg-white p-5 rounded-3xl border border-slate-200 flex flex-wrap gap-3 justify-between items-center no-print">
      <div>
        <h3 class="font-black text-lg text-slate-900">${escapeHtml(reg.familyName)} Family</h3>
        <p class="text-xs text-slate-500 font-mono">${reg.registrationNo || reg.id} • ${reg.groupColor?.toUpperCase()} GROUP</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="window.print()" class="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition">Print Pass</button>
        <button onclick="location.reload()" class="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-slate-200 transition">Exit</button>
      </div>
    </div>

    <!-- Single Family Master Pass Card -->
    <div id="print-area" class="max-w-md mx-auto">
      <div class="print-pass bg-white p-6 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ta'aluf Family Gathering 2026</p>
          <h2 class="font-black text-2xl uppercase text-slate-900 mt-0.5">${escapeHtml(reg.familyName)} Family</h2>
          <span class="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-black uppercase ${badgeColor(reg.groupColor)}">${escapeHtml(reg.groupColor)} Team</span>
        </div>

        <!-- Master QR Frame with fixed sizing -->
        <div id="family-master-qr" class="w-44 h-44 p-2 bg-white rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center my-2">
          <span class="text-xs text-slate-400 animate-pulse">Generating QR...</span>
        </div>

        <!-- Member Count Breakdown -->
        <div class="w-full bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
          <div class="flex justify-between font-bold text-slate-800">
            <span>Registered Members:</span>
            <span>${attendees.length || reg.totalAttendees || 1} Persons</span>
          </div>
          <div class="flex justify-between text-[11px]">
            <span>Checked-in at Gate:</span>
            <span class="font-bold text-emerald-700">${checkedCount} / ${attendees.length || reg.totalAttendees || 1}</span>
          </div>
        </div>

        <p class="text-[10px] text-slate-400 font-mono">Present this QR code at the reception desk to check-in your family.</p>
      </div>
    </div>
  `;

  // 2. Render QR code with dual fallback
  const qrContainer = document.getElementById("family-master-qr");
  const payloadText = JSON.stringify({ t: token });
  const qrColor = reg.groupColor === "red" ? "#e11d48" : reg.groupColor === "green" ? "#059669" : "#2563eb";

  qrContainer.innerHTML = ""; // Clear loader text

  if (window.QRCode) {
    new window.QRCode(qrContainer, {
      text: payloadText,
      width: 160,
      height: 160,
      colorDark: qrColor,
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } else {
    // Instant Image Fallback if the external QRCode library is unavailable or blocked
    const encodedData = encodeURIComponent(payloadText);
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodedData}&color=${qrColor.replace('#', '')}`;
    qrContainer.innerHTML = `<img src="${fallbackUrl}" alt="Family Pass QR" class="w-40 h-40 object-contain rounded-lg" />`;
  }
}

function badgeColor(c) {
  return {
    red: "bg-rose-100 text-rose-800 border border-rose-200",
    blue: "bg-blue-100 text-blue-800 border border-blue-200",
    green: "bg-emerald-100 text-emerald-800 border border-emerald-200"
  }[String(c).toLowerCase()] || "bg-slate-100 text-slate-800";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]);
}