export const UI = {
  toast(msg, type = "info") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type==='error'?'#dc2626':'#065f46'};color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:9999;font-size:14px;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  showModal(title, contentHtml, onSave = null) {
    const existing = document.getElementById("generic-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "generic-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">${contentHtml}</div>
        ${onSave ? `
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
            <button class="btn-secondary" id="modal-cancel-btn">Cancel</button>
            <button class="btn-primary" id="modal-submit-btn">Save</button>
          </div>
        ` : ''}
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#modal-close-btn").onclick = () => overlay.remove();
    const cancelBtn = overlay.querySelector("#modal-cancel-btn");
    if (cancelBtn) cancelBtn.onclick = () => overlay.remove();

    if (onSave) {
      overlay.querySelector("#modal-submit-btn").onclick = async (e) => {
        e.target.disabled = true;
        e.target.textContent = "Saving...";
        try {
          await onSave();
          overlay.remove();
        } catch (err) {
          UI.toast(err.message, "error");
          e.target.disabled = false;
          e.target.textContent = "Save";
        }
      };
    }
  },

  closeModal() {
    const m = document.getElementById("generic-modal");
    if (m) m.remove();
  }
};