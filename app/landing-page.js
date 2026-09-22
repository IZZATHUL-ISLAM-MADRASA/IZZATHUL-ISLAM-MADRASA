// landing-page.js
import { defaultLandingContent, fetchAnnouncements, fetchLiveLeaderboard } from "./landing-data.js";

export async function renderLandingPage() {
  const app = document.getElementById("app");
  document.title = "Ta'aluf Family Gathering | Izzathul Islam Madrasa";
  app.className = "min-h-screen bg-[#f4f7f6] text-slate-800 font-sans antialiased flex flex-col";

  const { eventMeta, schedule } = defaultLandingContent;
  const [announcements, leaderboard] = await Promise.all([fetchAnnouncements(), fetchLiveLeaderboard()]);

  app.innerHTML = `
    <!-- Madrasa Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div class="flex items-center space-x-3 cursor-pointer" onclick="window.navigate('landing')">
          <div class="w-12 h-12 rounded-full border border-emerald-700/20 flex items-center justify-center bg-emerald-50 text-2xl">🕌</div>
          <div>
            <h1 class="font-extrabold text-base tracking-wide text-emerald-950 uppercase leading-tight">Izzathul Islam Madrasa</h1>
            <p class="text-[11px] font-semibold text-slate-500">Bengaluru • Online & Offline</p>
          </div>
        </div>

        <nav class="hidden md:flex items-center space-x-7 text-xs font-bold text-slate-700">
          <a href="#about" class="text-emerald-700 border-b-2 border-emerald-600 pb-1">Home</a>
          <a href="#about" class="hover:text-emerald-700 transition">About</a>
          <a href="#schedule" class="hover:text-emerald-700 transition">Schedule</a>
          <a href="#announcements" class="hover:text-emerald-700 transition">Notices</a>
          <a href="#contact" class="hover:text-emerald-700 transition">Venue</a>
        </nav>

        <div class="flex items-center space-x-2.5">
          <button onclick="window.navigate('family-login')" class="text-xs font-bold text-slate-700 hover:text-emerald-800 px-3 py-2 rounded-xl transition">Passes</button>
          <button onclick="window.navigate('login')" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 shadow transition">Sign in</button>
        </div>
      </div>
    </header>

    <main class="flex-grow space-y-10 pb-16">
      <!-- Forest Canvas Hero Section -->
      <section class="relative bg-gradient-to-b from-[#e3ede9] via-[#edf4f1] to-[#f4f7f6] pt-10 pb-14 border-b border-emerald-900/10 overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div class="lg:col-span-5 text-center lg:text-left space-y-4">
              <span class="font-serif text-4xl font-extrabold text-amber-600/90 block">تَآلُف</span>
              <h2 class="text-5xl sm:text-6xl font-black text-emerald-950 tracking-tight leading-none">${eventMeta.title}</h2>
              <p class="text-xs font-black uppercase tracking-[0.3em] text-slate-600 mt-1">${eventMeta.subtitle}</p>
              <p class="text-xs font-bold text-emerald-800">${eventMeta.tagline}</p>
              
              <div class="pt-3 max-w-md mx-auto lg:mx-0">
                <p class="font-arabic text-xl text-emerald-900 font-bold leading-relaxed">${eventMeta.quranVerseArabic}</p>
                <p class="text-xs italic text-slate-600 mt-2">${eventMeta.quranVerseTranslation}</p>
                <p class="text-[11px] font-bold text-slate-500 mt-0.5">${eventMeta.quranRef}</p>
              </div>
            </div>

            <div class="lg:col-span-7 bg-white/90 backdrop-blur-md border border-emerald-900/15 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-start space-x-3">
                  <div class="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 text-xl">📅</div>
                  <div>
                    <h3 class="font-black text-slate-900 text-sm">${eventMeta.eventDateDisplay}</h3>
                    <p class="text-xs text-slate-500 font-semibold">${eventMeta.eventTimeDisplay}</p>
                  </div>
                </div>
                <div class="flex items-start space-x-3">
                  <div class="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 text-xl">📍</div>
                  <div>
                    <h3 class="font-black text-slate-900 text-sm">${eventMeta.venueName}</h3>
                    <p class="text-xs text-slate-500 font-semibold">Bengaluru</p>
                  </div>
                </div>
              </div>

              <!-- Countdown Timer -->
              <div class="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white rounded-2xl p-5 shadow-inner">
                <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-3 text-center sm:text-left">Event Starts In</p>
                <div class="grid grid-cols-4 gap-2 text-center">
                  <div class="bg-white/10 rounded-xl p-2.5"><span id="cd-days" class="text-2xl sm:text-3xl font-black block font-mono">00</span><span class="text-[10px] text-slate-300">Days</span></div>
                  <div class="bg-white/10 rounded-xl p-2.5"><span id="cd-hours" class="text-2xl sm:text-3xl font-black block font-mono">00</span><span class="text-[10px] text-slate-300">Hours</span></div>
                  <div class="bg-white/10 rounded-xl p-2.5"><span id="cd-minutes" class="text-2xl sm:text-3xl font-black block font-mono">00</span><span class="text-[10px] text-slate-300">Minutes</span></div>
                  <div class="bg-white/10 rounded-xl p-2.5"><span id="cd-seconds" class="text-2xl sm:text-3xl font-black block font-mono">00</span><span class="text-[10px] text-slate-300">Seconds</span></div>
                </div>
              </div>

              <button onclick="window.navigate('register')" class="w-full py-4 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-sm shadow-lg shadow-emerald-950/20 transition flex items-center justify-center space-x-2">
                <span>Register Now</span><span class="text-lg">→</span>
              </button>
            </div>

          </div>
        </div>
      </section>

      <!-- Action Row Tiles -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button onclick="window.navigate('register')" class="text-left bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-600 transition group">
            <span class="text-2xl block mb-2">👨‍👩‍👧‍👦</span>
            <h3 class="font-black text-slate-900 text-sm group-hover:text-emerald-800">Family Registration</h3>
            <p class="text-xs text-slate-500 mt-1">Register for Ta'aluf</p>
          </button>
          <a href="#schedule" class="text-left bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-600 transition group">
            <span class="text-2xl block mb-2">🗓️</span>
            <h3 class="font-black text-slate-900 text-sm group-hover:text-emerald-800">Program Schedule</h3>
            <p class="text-xs text-slate-500 mt-1">View timeline</p>
          </a>
          <button onclick="alert('Games details are available at the madrasa desk.')" class="text-left bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-600 transition group">
            <span class="text-2xl block mb-2">🎮</span>
            <h3 class="font-black text-slate-900 text-sm group-hover:text-emerald-800">Games & Activities</h3>
            <p class="text-xs text-slate-500 mt-1">Rules & activities</p>
          </button>
          <button onclick="alert('Stall allocations are open.')" class="text-left bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-600 transition group">
            <span class="text-2xl block mb-2">🏪</span>
            <h3 class="font-black text-slate-900 text-sm group-hover:text-emerald-800">Stalls</h3>
            <p class="text-xs text-slate-500 mt-1">Register a stall</p>
          </button>
        </div>
      </section>

      <!-- Grid 1: About, Announcements, Graphic Card -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div id="about" class="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h3 class="font-black text-lg text-slate-900 flex items-center gap-2"><span>🌱</span> About Ta'aluf</h3>
            <p class="text-xs leading-relaxed text-slate-600">Ta'aluf is a family gathering initiative of <strong>Izzathul Islam Madrasa</strong>, bringing together students, parents, and well-wishers for a day of unity, learning, games, and fellowship.</p>
            <div class="grid grid-cols-2 gap-3 pt-2 text-xs font-bold text-slate-800">
              <div class="p-3 bg-slate-50 rounded-xl">🤝 Bonding</div>
              <div class="p-3 bg-slate-50 rounded-xl">🎯 Fun Games</div>
              <div class="p-3 bg-slate-50 rounded-xl">🏆 Competition</div>
              <div class="p-3 bg-slate-50 rounded-xl">🤲 Barakah</div>
            </div>
          </div>

          <div id="announcements" class="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h3 class="font-black text-lg text-slate-900 flex items-center gap-2"><span>📢</span> Latest Announcements</h3>
            <div class="divide-y divide-slate-100 space-y-3">
              ${announcements.map(ann => `
                <div class="pt-3 flex items-start space-x-3">
                  <div class="bg-slate-100 rounded-xl px-2 py-1 text-center shrink-0">
                    <span class="block text-xs font-black">${ann.dateDay}</span>
                    <span class="block text-[9px] uppercase font-bold text-slate-500">${ann.dateMonth}</span>
                  </div>
                  <div>
                    <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${ann.badgeClass || 'bg-slate-100 text-slate-700'}">${ann.badgeType}</span>
                    <h4 class="text-xs font-bold text-slate-900 mt-0.5">${ann.title}</h4>
                    <p class="text-[11px] text-slate-500">${ann.description}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="lg:col-span-4 bg-cover bg-center rounded-3xl p-7 text-white flex flex-col justify-between min-h-[340px] shadow-xs" style="background-image: linear-gradient(rgba(15,23,42,0.4), rgba(15,23,42,0.7)), url('https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80');">
            <span class="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full w-fit">✨ Highlights</span>
            <p class="font-serif italic text-2xl font-bold text-center">"Let's make beautiful memories together!"</p>
            <button onclick="window.navigate('register')" class="w-full py-2.5 bg-white text-slate-900 rounded-xl font-bold text-xs">Get Passes</button>
          </div>
        </div>
      </section>

      <!-- Grid 2: Schedule, Leaderboard, Quick Links -->
      <section id="schedule" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div class="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h3 class="font-black text-lg text-slate-900 flex items-center gap-2"><span>📅</span> Program Schedule</h3>
            <ul class="space-y-3 text-xs">
              ${schedule.map(item => `
                <li class="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span class="font-mono font-bold text-emerald-800">${item.time}</span>
                  <span class="font-semibold text-slate-800">${item.title}</span>
                </li>
              `).join("")}
            </ul>
          </div>

          <div class="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h3 class="font-black text-lg text-slate-900 flex items-center gap-2"><span>🏆</span> Leaderboard</h3>
            <div class="space-y-2">
              ${leaderboard.map(item => `
                <div class="flex items-center justify-between p-3 rounded-2xl ${item.rank === 1 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'} text-xs">
                  <span class="font-bold">${item.badge || item.rank}.${item.family}</span>
                  <span class="font-mono font-black text-emerald-700">${item.points} pts</span>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h3 class="font-black text-lg text-slate-900 flex items-center gap-2"><span>⚡</span> Quick Links</h3>
            <div class="grid grid-cols-2 gap-3 text-center text-xs font-bold">
              <button onclick="window.navigate('family-login')" class="p-3 bg-slate-50 border rounded-xl hover:bg-emerald-50">🎫 Passes</button>
              <button onclick="window.navigate('verification-desk')" class="p-3 bg-slate-50 border rounded-xl hover:bg-emerald-50">🔍 Verify</button>
              <button onclick="alert('Rules available at desk.')" class="p-3 bg-slate-50 border rounded-xl hover:bg-emerald-50">📜 Rules</button>
              <button onclick="window.navigate('register')" class="p-3 bg-slate-50 border rounded-xl hover:bg-emerald-50">📝 Register</button>
            </div>
            <div class="p-4 rounded-2xl bg-emerald-50 text-center text-emerald-950 text-xs font-semibold">
              تَآلُف — May this gathering strengthen our bonds of faith and brotherhood.
            </div>
          </div>
        </div>
      </section>

      <!-- Venue & Map -->
      <section id="contact" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div class="space-y-3">
            <span class="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Venue Information</span>
            <h3 class="text-2xl font-black text-slate-900">${eventMeta.venueName}</h3>
            <p class="text-xs font-semibold text-slate-500">${eventMeta.venueAddress}</p>
            <div class="text-xs space-y-1 text-slate-700 pt-2">
              <p>🚗 <strong>Parking:</strong> Free on-site parking available</p>
              <p>⏰ <strong>Hours:</strong> Entry: 8:00 AM | Exit: 5:00 PM</p>
              <p>📞 <strong>Contact:</strong> ${eventMeta.contactPhone}</p>
            </div>
            <div class="pt-2">
              <a href="https://maps.google.com/?q=${encodeURIComponent(eventMeta.venueMapQuery)}" target="_blank" class="inline-flex bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-900">View on Map ↗</a>
            </div>
          </div>
          <div class="h-56 rounded-2xl overflow-hidden border border-slate-200">
            <iframe title="Map" class="w-full h-full border-0" loading="lazy" src="https://maps.google.com/maps?q=${encodeURIComponent(eventMeta.venueMapQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed"></iframe>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="bg-slate-950 text-white pt-10 pb-6 border-t border-slate-800 text-xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
        <div>
          <h4 class="font-black text-sm uppercase">Izzathul Islam Madrasa</h4>
          <p class="text-slate-400 mt-2 italic">"Knowledge with Faith, for a Better Tomorrow."</p>
        </div>
        <div>
          <h5 class="font-bold text-slate-300 uppercase mb-2">Portal Links</h5>
          <ul class="space-y-1 text-slate-400">
            <li><a href="javascript:void(0)" onclick="window.navigate('register')" class="hover:text-white">Registration</a></li>
            <li><a href="javascript:void(0)" onclick="window.navigate('family-login')" class="hover:text-white">Pass Recovery</a></li>
            <li><a href="javascript:void(0)" onclick="window.navigate('verification-desk')" class="hover:text-white">Gate Scanner</a></li>
          </ul>
        </div>
        <div>
          <h5 class="font-bold text-slate-300 uppercase mb-2">Administration</h5>
          <ul class="space-y-1 text-slate-400">
            <li><a href="javascript:void(0)" onclick="window.navigate('login')" class="hover:text-white">Staff Login</a></li>
            <li><a href="javascript:void(0)" onclick="window.navigate('dashboard')" class="hover:text-white">Admin Dashboard</a></li>
          </ul>
        </div>
        <div>
          <h5 class="font-bold text-slate-300 uppercase mb-2">Contact</h5>
          <p class="text-slate-400">Bengaluru, Karnataka</p>
          <p class="text-slate-400 font-mono">${eventMeta.contactPhone}</p>
        </div>
      </div>
      <p class="text-center text-[10px] text-slate-500 pt-6">© 2025 Izzathul Islam Madrasa. Designed for Knowledge & Community.</p>
    </footer>
  `;

  startCountdown(eventMeta.eventDateISO);
}

function startCountdown(targetIsoDate) {
  const targetTime = new Date(targetIsoDate).getTime();
  const update = () => {
    const diff = targetTime - Date.now();
    if (diff <= 0) return;
    const pad = n => String(n).padStart(2, "0");
    document.getElementById("cd-days").textContent = pad(Math.floor(diff / 86400000));
    document.getElementById("cd-hours").textContent = pad(Math.floor((diff % 86400000) / 3600000));
    document.getElementById("cd-minutes").textContent = pad(Math.floor((diff % 3600000) / 60000));
    document.getElementById("cd-seconds").textContent = pad(Math.floor((diff % 60000) / 1000));
  };
  update();
  setInterval(update, 1000);
}