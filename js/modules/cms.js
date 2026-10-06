import { db, getCachedDocs, setDocument } from "../core/firebase-config.js";
import { collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { UI } from "../core/ui.js";

export const CMSModule = {
  id: "cms",
  title: "Website CMS",
  roles: ["admin"],

  async render(container) {
    const snap = await getCachedDocs(collection(db, "cms"), "cms");
    const page = snap.docs.find(item => item.id === "homepage");
    const data = page ? page.data() : {
      marqueeNotice: "Exam registration for the upcoming term is now open. Last date: 25 March 2026.",
      studentsCount: "160+",
      successRate: "98%",
      yearsService: "15+",
      familiesCount: "100+",
      upcomingEventTitle: "Ta'aluf – Family Get Together",
      upcomingEventDate: "27 Sep 2026"
    };

    container.innerHTML = `
      <h2>Website Content Management</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">Live update text and statistics shown on the public landing page.</p>

      <div class="stat-card" style="max-width:650px;">
        <label>Marquee Alert Bar Notice</label>
        <input type="text" id="cms-marquee" value="${data.marqueeNotice}" />

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
          <div><label>Students Count</label><input type="text" id="cms-st-count" value="${data.studentsCount}" /></div>
          <div><label>Success Rate</label><input type="text" id="cms-success" value="${data.successRate}" /></div>
          <div><label>Years of Service</label><input type="text" id="cms-years" value="${data.yearsService}" /></div>
          <div><label>Families Count</label><input type="text" id="cms-families" value="${data.familiesCount}" /></div>
        </div>

        <h4 style="margin-top:16px;">Featured Event</h4>
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-top:8px;">
          <div><label>Event Name</label><input type="text" id="cms-event-name" value="${data.upcomingEventTitle}" /></div>
          <div><label>Event Date</label><input type="text" id="cms-event-date" value="${data.upcomingEventDate}" /></div>
        </div>

        <button class="btn-primary" id="save-cms-btn" style="margin-top:20px;">Publish Changes</button>
      </div>
    `;

    container.querySelector("#save-cms-btn").onclick = async (e) => {
      e.target.disabled = true;
      await setDocument("cms", "homepage", {
        marqueeNotice: document.getElementById("cms-marquee").value,
        studentsCount: document.getElementById("cms-st-count").value,
        successRate: document.getElementById("cms-success").value,
        yearsService: document.getElementById("cms-years").value,
        familiesCount: document.getElementById("cms-families").value,
        upcomingEventTitle: document.getElementById("cms-event-name").value,
        upcomingEventDate: document.getElementById("cms-event-date").value,
        updatedAt: new Date().toISOString()
      });
      UI.toast("Homepage CMS updated successfully!");
      e.target.disabled = false;
    };
  }
};