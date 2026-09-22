// landing-data.js
import { db, collection, getDocs, query, where } from "./firebase-config.js";

export const defaultLandingContent = {
  eventMeta: {
    title: "Ta'aluf",
    subtitle: "FAMILY GATHERING",
    tagline: "Togetherness • Harmony • Barakah",
    quranVerseArabic: "وَأَلَّفَ بَيْنَ قُلُوبِكُمْ فَأَصْبَحْتُم بِنِعْمَتِهِ إِخْوَانًا",
    quranVerseTranslation: '"And He united your hearts, so that you became by His grace brothers."',
    quranRef: "(Al-Imran 3:103)",
    eventDateISO: "2025-09-27T09:00:00+05:30",
    eventDateDisplay: "Sunday, 27 September 2025",
    eventTimeDisplay: "9:00 AM – 5:00 PM",
    venueName: "Khedda Farm Stay & Resort",
    venueAddress: "Kengeri, Bengaluru – 560060",
    venueMapQuery: "Khedda Farm Stay & Resort Bengaluru",
    contactPhone: "+91 98765 43210",
    contactEmail: "info@izzathulislam bangalore.in"
  },
  announcements: [
    { id: "1", dateDay: "21", dateMonth: "Sep", badgeType: "Important", badgeClass: "bg-rose-100 text-rose-700", title: "Registration closes on 25 September 2025", description: "Last date for online registration is 25 Sep, 5:00 PM." },
    { id: "2", dateDay: "18", dateMonth: "Sep", badgeType: "Update", badgeClass: "bg-blue-100 text-blue-700", title: "Game rules updated", description: "Please check the latest game rules in the Games section." },
    { id: "3", dateDay: "15", dateMonth: "Sep", badgeType: "Info", badgeClass: "bg-emerald-100 text-emerald-700", title: "Stall allocation list published", description: "Check your stall number in the Stall section." },
    { id: "4", dateDay: "10", dateMonth: "Sep", badgeType: "Reminder", badgeClass: "bg-purple-100 text-purple-700", title: "Bring your event pass / QR code", description: "Mandatory for entry and participation." }
  ],
  schedule: [
    { time: "09:00 AM", title: "Registration & Check-in" },
    { time: "10:00 AM", title: "Inauguration & Welcome" },
    { time: "11:00 AM", title: "Games (Morning Session)" },
    { time: "01:00 PM", title: "Lunch Break" },
    { time: "02:00 PM", title: "Games (Afternoon Session)" },
    { time: "04:00 PM", title: "Prize Distribution & Closing" }
  ],
  leaderboard: [
    { rank: 1, family: "Al-Farhan Family", points: 485, badge: "🥇" },
    { rank: 2, family: "Noor Family", points: 462, badge: "🥈" },
    { rank: 3, family: "Hidaya Family", points: 438, badge: "🥉" },
    { rank: 4, family: "Safa Family", points: 420 },
    { rank: 5, family: "Rahman Family", points: 398 }
  ]
};

export async function fetchAnnouncements() {
  try {
    const snap = await getDocs(query(collection(db, "landingAnnouncements"), where("isDeleted", "!=", true)));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) { /* fallback to default */ }
  return defaultLandingContent.announcements;
}

export async function fetchLiveLeaderboard() {
  try {
    const snap = await getDocs(query(collection(db, "meetupRegistrations"), where("status", "==", "confirmed")));
    const rows = snap.docs.map(d => d.data()).filter(d => !d.isDeleted && d.totalPoints !== undefined);
    if (rows.length >= 3) {
      return rows.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).slice(0, 5).map((fam, idx) => ({
        rank: idx + 1,
        family: `${fam.familyName} Family`,
        points: fam.totalPoints || 0,
        badge: idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : ""
      }));
    }
  } catch (err) { /* fallback to default */ }
  return defaultLandingContent.leaderboard;
}