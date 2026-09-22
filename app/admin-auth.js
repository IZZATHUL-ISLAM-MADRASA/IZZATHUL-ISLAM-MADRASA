// admin-auth.js 
import { db, doc, getDoc, sha256, safeUpdateDoc, serverTimestamp } from "./firebase-config.js";

export function renderAdminLogin() {
  const app = document.getElementById("app");
  document.title = "Staff Sign in | Izzathul Islam";
  app.className = "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6";

  app.innerHTML = `
    <main class="w-full max-w-md">
      <div class="mb-8">
        <p class="text-emerald-400 text-xs font-black uppercase tracking-[0.2em]">Izzathul Islam</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight">Portal Sign in</h1>
        <p class="mt-2 text-slate-400 text-xs">Manage registrations, verify QR badges, or score events.</p>
      </div>

      <form id="login-form" class="bg-white text-slate-900 rounded-3xl p-6 shadow-2xl space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Username</label>
          <input id="login-user" required placeholder="admin01" class="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Password</label>
          <input id="login-pass" type="password" required placeholder="••••••••" class="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
        </div>
        <p id="login-err" class="hidden text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl"></p>
        <button id="login-btn" type="submit" class="w-full rounded-xl bg-slate-950 text-white font-bold py-3.5 text-xs hover:bg-slate-800 transition">Sign in</button>
        <div class="flex justify-between pt-2 text-[11px] font-bold text-slate-500">
          <a href="javascript:void(0)" onclick="window.navigate('landing')" class="hover:text-emerald-700">← Back Home</a>
          <a href="javascript:void(0)" onclick="window.navigate('family-login')" class="hover:text-emerald-700">Find Passes</a>
        </div>
      </form>
    </main>
  `;

  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const err = document.getElementById("login-err");
    btn.disabled = true; btn.textContent = "Verifying...";
    err.classList.add("hidden");

    try {
      const u = document.getElementById("login-user").value.trim();
      const p = document.getElementById("login-pass").value;
      const snap = await getDoc(doc(db, "users", u));
      if (!snap.exists() || snap.data().isDeleted) throw new Error("Invalid username or account inactive.");

      const data = snap.data();
      const hash = await sha256(p);
      if (hash.toLowerCase() !== (data.passwordHash || data.password_hash || "").toLowerCase()) {
        throw new Error("Invalid username or password.");
      }

      await safeUpdateDoc(doc(db, "users", u), { lastLoginAt: serverTimestamp() }, u);
      sessionStorage.setItem("portalUserId", u);
      sessionStorage.setItem("portalRole", data.role);

      if (data.role === "verification_desk") window.navigate("verification-desk");
      else window.navigate("meetup-admin");
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  };
}
