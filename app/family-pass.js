// family-pass.js
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  where, 
  sha256, 
  doc, 
  safeUpdateDoc, 
  generateSecureToken 
} from "./firebase-config.js";

export function renderFamilyPassView() {
  const app = document.getElementById("app");
  document.title = "Family Passes | Ta'aluf Gathering";
  app.className = "min-h-screen bg-slate-50 text-slate-900 font-sans antialiased";

  app.innerHTML = `
    <header class="border-b border-slate-200 bg-white no-print">
      <div class="max-w-xl mx-auto px-4 py-3.5 flex justify-between items-center">
      <span class="inline-flex items-center justify-center">
  <img src="taaluf.png" alt="Madrasa Icon" class="w-20 h-20 object-contain rounded-xl" />
</span>
        <h1 class="text-sm font-black cursor-pointer text-slate-900" onclick="window.navigate('landing')">TA'ALUF 2026</h1>
        <button onclick="window.navigate('landing')" class="text-xs font-bold text-slate-500 hover:text-slate-800 transition">Home</button>
      </div>
    </header>

    <main class="max-w-xl mx-auto p-4 sm:p-6 space-y-4">
      <section id="lookup-card" class="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div class="space-y-1">
          <h2 class="text-lg font-black text-slate-900">Find Your Passes</h2>
          <p class="text-xs text-slate-500">
            Enter your 10-digit mobile number and the <b>last 6 digits of your mobile number</b> as your password.
          </p>
        </div>

        <form id="lookup-form" class="mt-4 space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1" for="l-mobile">Mobile Number</label>
            <input 
              id="l-mobile" 
              required 
              maxlength="10" 
              inputmode="numeric" 
              placeholder="10-digit registered phone" 
              class="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" 
            />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1" for="l-pass">Password (Last 6 Digits of Mobile)</label>
            <input 
              id="l-pass" 
              type="password"
              required 
              maxlength="6" 
              minlength="6"
              inputmode="numeric" 
              placeholder="••••••" 
              class="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" 
            />
          </div>
          <button id="l-btn" type="submit" class="w-full py-3.5 bg-emerald-700 text-white font-bold rounded-xl text-xs hover:bg-emerald-800 transition shadow cursor-pointer">
            Find Passes
          </button>
        </form>
      </section>

      <section id="passes-result" class="hidden space-y-4"></section>
    </main>
  `;

  // Auto-clean non-digits
  ["l-mobile", "l-pass"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", e => {
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
      const pass = document.getElementById("l-pass").value.trim();

      if (mob.length !== 10) {
        throw new Error("Please enter a valid 10-digit mobile number.");
      }

      if (pass.length !== 6) {
        throw new Error("Password must be exactly the last 6 digits of your registered mobile number.");
      }

      const inputHash = await sha256(pass);

      const q = query(
        collection(db, "meetupRegistrations"), 
        where("mobileNo", "==", mob), 
        where("status", "==", "confirmed")
      );
      const snap = await getDocs(q);

      const regDoc = snap.docs.find(d => {
        const item = d.data();
        if (item.isDeleted) return false;
        return item.passwordHash === inputHash || item.defaultPassword === pass;
      });

      if (!regDoc) {
        throw new Error("No confirmed registration found matching this mobile and 6-digit password.");
      }

      const reg = { id: regDoc.id, ...regDoc.data() };

      const attSnap = await getDocs(query(
        collection(db, "meetupAttendees"), 
        where("registrationId", "==", regDoc.id)
      ));
      
      const attendees = attSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.isDeleted);

      await renderPasses(reg, attendees);
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false; 
      btn.textContent = "Find Passes";
    }
  };
}

async function renderPasses(reg, attendees) {
  document.getElementById("lookup-card").classList.add("hidden");
  const res = document.getElementById("passes-result");
  res.classList.remove("hidden");

  // Auto-heal master token if not present
  let token = reg.rawFamilyToken || reg.qrToken;
  if (!token) {
    token = attendees.find(a => a.rawToken)?.rawToken || generateSecureToken(24);
    reg.rawFamilyToken = token;
    
    const tokenHash = await sha256(token);
    safeUpdateDoc(doc(db, "meetupRegistrations", reg.id), {
      rawFamilyToken: token,
      qrTokenHash: tokenHash
    }).catch(err => console.warn("Token backfill notice:", err));
  }

  const checkedCount = attendees.filter(a => a.status === "checked_in").length;

  res.innerHTML = `
    <div class="bg-white p-5 rounded-3xl border border-slate-200 flex flex-wrap gap-3 justify-between items-center no-print">
      <div>
        <h3 class="font-black text-lg text-slate-900">${escapeHtml(reg.familyName)} Family</h3>
        <p class="text-xs text-slate-500 font-mono">${reg.registrationNo || reg.id} • ${reg.groupColor?.toUpperCase()} GROUP</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button 
          id="btn-download-pdf" 
          class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 8.5h-1v2h1c.55 0 1-.45 1-1s-.45-1-1-1zm5 0h-1.5v3H14v-1h.5c.55 0 1-.45 1-1v-1zm-9-5h13v2H5.5V6.5zm3 5H6v5h1.5v-1.5H8.5c1.1 0 2-.9 2-2s-.9-1.5-2-1.5zm6 0h-3v5H13v-1.5h1.5c1.1 0 2-.9 2-2v-.5c0-.55-.45-1-1-1zm3 0h-3v5h1.5v-2H17v-1h-1v-.5H17.5v-1.5z"/>
          </svg>
          <span>PDF</span>
        </button>

        <button 
          id="btn-download-png" 
          class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <svg class="w-3.5 h-3.5 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>PNG</span>
        </button>

        <button 
          onclick="location.reload()" 
          class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Exit
        </button>
      </div>
    </div>

    <div id="print-area" class="max-w-md mx-auto">
      <div class="print-pass bg-white p-6 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-between text-center space-y-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ta'aluf Family Gathering 2026</p>
          <h2 class="font-black text-2xl uppercase text-slate-900 mt-0.5">${escapeHtml(reg.familyName)} Family</h2>
          <span class="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-black uppercase ${badgeColor(reg.groupColor)}">${escapeHtml(reg.groupColor)} Team</span>
        </div>

        <div id="family-master-qr" class="w-44 h-44 p-2 bg-white rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center my-2">
          <span class="text-xs text-slate-400 animate-pulse">Generating QR...</span>
        </div>

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

  const qrContainer = document.getElementById("family-master-qr");
  const payloadText = JSON.stringify({ t: token });
  const qrColor = reg.groupColor === "red" ? "#e11d48" : reg.groupColor === "green" ? "#059669" : "#2563eb";

  qrContainer.innerHTML = "";

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
    const encodedData = encodeURIComponent(payloadText);
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodedData}&color=${qrColor.replace('#', '')}`;
    qrContainer.innerHTML = `<img src="${fallbackUrl}" alt="Family Pass QR" class="w-40 h-40 object-contain rounded-lg" />`;
  }

  document.getElementById("btn-download-pdf").onclick = () => downloadPassPdf(reg, attendees);
  document.getElementById("btn-download-png").onclick = () => downloadPassPng(reg, attendees);
}

function downloadPassPdf(reg, attendees) {
  if (!window.jspdf?.jsPDF) {
    alert("PDF generator is loading, please try again in a moment.");
    return;
  }

  const pdf = new window.jspdf.jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [120, 175]
  });

  const cardWidth = 100;
  const cardHeight = 155;
  const x = 10;
  const y = 10;

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");

  pdf.setFontSize(8);
  pdf.setTextColor(5, 150, 105);
  pdf.text("TA'ALUF FAMILY GATHERING 2026", x + cardWidth / 2, y + 12, { align: "center" });

  pdf.setFontSize(14);
  pdf.setFont(undefined, "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${(reg.familyName || "Family").toUpperCase()} FAMILY`, x + cardWidth / 2, y + 22, { align: "center" });

  const teamColors = {
    red: [225, 29, 72],
    blue: [37, 99, 235],
    green: [5, 150, 105]
  };
  const rgb = teamColors[reg.groupColor?.toLowerCase()] || [15, 23, 42];
  pdf.setFillColor(...rgb);
  pdf.roundedRect(x + (cardWidth - 36) / 2, y + 26, 36, 6.5, 3, 3, "F");
  pdf.setFontSize(7.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${(reg.groupColor || "GENERAL").toUpperCase()} TEAM`, x + cardWidth / 2, y + 30.5, { align: "center" });

  const qrEl = document.getElementById("family-master-qr")?.querySelector("img, canvas");
  if (qrEl) {
    const qrData = qrEl.toDataURL ? qrEl.toDataURL("image/png") : qrEl.src;
    pdf.addImage(qrData, "PNG", x + (cardWidth - 56) / 2, y + 38, 56, 56);
  }

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(x + 8, y + 102, cardWidth - 16, 22, 3, 3, "FD");

  pdf.setFontSize(8.5);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(100, 116, 139);
  pdf.text("Registered Members:", x + 12, y + 111);
  pdf.text("Pass ID:", x + 12, y + 118);

  pdf.setFont(undefined, "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text(`${attendees.length || reg.totalAttendees || 1} Persons`, x + cardWidth - 12, y + 111, { align: "right" });
  pdf.text(String(reg.registrationNo || reg.id || ""), x + cardWidth - 12, y + 118, { align: "right" });

  pdf.setFontSize(6.5);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(148, 163, 184);
  pdf.text("Show this QR at reception for family check-in.", x + cardWidth / 2, y + 138, { align: "center" });

  pdf.save(`${(reg.familyName || "family").replace(/\s+/g, "_")}_pass.pdf`);
}

function downloadPassPng(reg, attendees) {
  const qrEl = document.getElementById("family-master-qr")?.querySelector("img, canvas");
  if (!qrEl) {
    alert("Pass image is generating, please wait a second.");
    return;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 720;
  canvas.height = 1000;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = "#059669";
  ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TA'ALUF FAMILY GATHERING 2026", canvas.width / 2, 80);

  ctx.fillStyle = "#0f172a";
  ctx.font = "900 36px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`${(reg.familyName || "Family").toUpperCase()} FAMILY`, canvas.width / 2, 130);

  const teamHex = {
    red: "#e11d48",
    blue: "#2563eb",
    green: "#059669"
  }[reg.groupColor?.toLowerCase()] || "#0f172a";

  ctx.fillStyle = teamHex;
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 110, 155, 220, 42, 21);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`${(reg.groupColor || "GENERAL").toUpperCase()} TEAM`, canvas.width / 2, 182);

  const qrImg = new Image();
  qrImg.crossOrigin = "anonymous";
  qrImg.onload = () => {
    ctx.drawImage(qrImg, canvas.width / 2 - 190, 240, 380, 380);

    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 680, canvas.width - 160, 150, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Registered Members:", 120, 740);
    ctx.fillText("Pass ID:", 120, 790);

    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "right";
    ctx.fillText(`${attendees.length || reg.totalAttendees || 1} Persons`, canvas.width - 120, 740);
    ctx.fillText(String(reg.registrationNo || reg.id || ""), canvas.width - 120, 790);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Show this QR at reception for family check-in.", canvas.width / 2, 890);

    const link = document.createElement("a");
    link.download = `${(reg.familyName || "family").replace(/\s+/g, "_")}_pass.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  qrImg.src = qrEl.toDataURL ? qrEl.toDataURL("image/png") : qrEl.src;
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