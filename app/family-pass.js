// family-pass.js
import { db, collection, getDocs, query, where, sha256 } from "./firebase-config.js";

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
        <p class="text-xs text-slate-500 mt-1">Enter your 10-digit mobile number and your 8-digit DOB (DDMMYYYY).</p>
        <form id="lookup-form" class="mt-4 space-y-3">
          <input id="l-mobile" required maxlength="10" inputmode="numeric" placeholder="10-digit Mobile" class="w-full p-3 rounded-xl border border-slate-300 text-sm outline-none" />
          <input id="l-dob" required maxlength="8" inputmode="numeric" placeholder="DDMMYYYY DOB" class="w-full p-3 rounded-xl border border-slate-300 text-sm font-mono outline-none" />
          <button id="l-btn" class="w-full py-3 bg-emerald-700 text-white font-bold rounded-xl text-xs hover:bg-emerald-800 transition">Find Passes</button>
        </form>
      </section>

      <section id="passes-result" class="hidden space-y-4"></section>
    </main>
  `;

  document.getElementById("lookup-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("l-btn");
    btn.disabled = true; 
    btn.textContent = "Searching...";

    try {
      const mob = document.getElementById("l-mobile").value.trim().replace(/\D/g, "");
      const dob = document.getElementById("l-dob").value.trim().replace(/\D/g, "");
      const hash = await sha256(dob);

      const q = query(
        collection(db, "meetupRegistrations"), 
        where("mobileNo", "==", mob), 
        where("status", "==", "confirmed")
      );
      const snap = await getDocs(q);
      const regDoc = snap.docs.find(d => !d.data().isDeleted && (d.data().dobHash === hash || d.data().passwordHash === hash));

      if (!regDoc) throw new Error("No confirmed registration found matching these details.");

      const reg = { id: regDoc.id, ...regDoc.data() };
      const attSnap = await getDocs(query(collection(db, "meetupAttendees"), where("registrationId", "==", regDoc.id)));
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

function renderPasses(reg, attendees) {
  document.getElementById("lookup-card").classList.add("hidden");
  const res = document.getElementById("passes-result");
  res.classList.remove("hidden");

  res.innerHTML = `
    <div class="bg-white p-5 rounded-3xl border border-slate-200 flex flex-wrap gap-3 justify-between items-center no-print">
      <div>
        <h3 class="font-black text-lg">${reg.familyName} Family</h3>
        <p class="text-xs text-slate-500 font-mono">${reg.registrationNo || reg.id} • ${reg.groupColor?.toUpperCase()} GROUP</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button id="btn-export-pdf" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 8.5h-1v2h1c.55 0 1-.45 1-1s-.45-1-1-1zm5 0h-1.5v3H14v-1h.5c.55 0 1-.45 1-1v-1zm-9-5h13v2H5.5V6.5zm3 5H6v5h1.5v-1.5H8.5c1.1 0 2-.9 2-2s-.9-1.5-2-1.5zm6 0h-3v5H13v-1.5h1.5c1.1 0 2-.9 2-2v-.5c0-.55-.45-1-1-1zm3 0h-3v5h1.5v-2H17v-1h-1v-.5H17.5v-1.5z"/>
          </svg>
          PDF
        </button>
        <button onclick="window.print()" class="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition">Print Badges</button>
        <button onclick="location.reload()" class="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold hover:bg-slate-200 transition">Exit</button>
      </div>
    </div>

    <div id="print-area">
      ${attendees.map((att, idx) => `
        <div class="print-pass bg-white p-5 border border-slate-200 rounded-2xl flex flex-col items-center justify-between text-center">
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Ta'aluf Family Gathering 2025</p>
            <h4 class="font-black text-sm uppercase text-slate-800 mt-1">${reg.familyName} Family</h4>
          </div>
          <div id="qr-box-${idx}" class="p-2 bg-white rounded-xl border border-slate-100 my-2"></div>
          <div>
            <p class="font-black text-sm text-slate-900">${att.memberName || "Attendee Pass"}</p>
            <p class="text-[10px] font-bold uppercase text-slate-500">${att.category} •${reg.groupColor} Team</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  // Generate QR codes
  attendees.forEach((att, idx) => {
    if (att.rawToken && window.QRCode) {
      new window.QRCode(document.getElementById(`qr-box-${idx}`), {
        text: JSON.stringify({ t: att.rawToken }),
        width: 140,
        height: 140,
        colorDark: reg.groupColor === "red" ? "#e11d48" : reg.groupColor === "green" ? "#059669" : "#2563eb",
        colorLight: "#ffffff"
      });
    }
  });

  // Attach PDF Generation
  document.getElementById("btn-export-pdf").onclick = () => exportPassesToPdf(reg, attendees);
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
    pdf.text("TA'ALUF FAMILY GATHERING 2025", x + cardWidth / 2, y + 8, { align: "center" });

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