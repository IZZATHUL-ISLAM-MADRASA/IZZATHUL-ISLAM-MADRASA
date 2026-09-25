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
    eventDateISO: "2026-09-27T09:00:00+05:30",
    eventDateDisplay: "Sunday, 27 September 2026",
    eventTimeDisplay: "8:00 AM – 7:00 PM",
    venueName: "Khedda Farm Stay & Resort",
    venueAddress: "anakapura main road, Bangalore - 560083",//"Kengeri, Bengaluru – 560060",
    venueMapQuery: "Khedda Farm Stay & Resort Bengaluru",
    contactPhone: "+91 62383 330947 +91 94482 60420",
    contactEmail: "info@izzathulislam bangalore.in"
  },
  announcements: [
    { id: "1", dateDay: "21", dateMonth: "Sep", badgeType: "Important", badgeClass: "bg-rose-100 text-rose-700", title: "Registration closes on 25 September 2026", description: "Last date for online registration is 25 Sep, 5:00 PM." },
    { id: "2", dateDay: "18", dateMonth: "Sep", badgeType: "Update", badgeClass: "bg-blue-100 text-blue-700", title: "Game rules updated", description: "Please check the latest game rules in the Games section." },
    { id: "3", dateDay: "15", dateMonth: "Sep", badgeType: "Info", badgeClass: "bg-emerald-100 text-emerald-700", title: "Stall allocation list published", description: "Check your stall number in the Stall section." },
    { id: "4", dateDay: "10", dateMonth: "Sep", badgeType: "Reminder", badgeClass: "bg-purple-100 text-purple-700", title: "Bring your event pass / QR code", description: "Mandatory for entry and participation." }
  ],
  schedule: [
  { time: "08:00 – 09:00 AM", title: "Entry" },
  { time: "08:00 – 09:00 AM", title: "Breakfast" },
  { time: "09:00 AM", title: "Knowing Co-Travellers" },
  { time: "09:15 AM", title: "Qirath" },
  { time: "09:20 AM", title: "Moulid" },
  { time: "10:00 AM", title: "Welcome Speech & Overview of Madrasa" },
  { time: "10:10 AM", title: "Gift Distribution – Key Achievements" },
  { time: "10:25 AM", title: "Parenting & Family Bonding – by Bisher KC" },
  { time: "(Parallel)", title: "Kids' Session – Games & Learning" },
  { time: "01:00 PM", title: "Feedback Sharing" },
  { time: "01:30 PM", title: "Zuhr" },
  { time: "01:45 PM", title: "Lunch" },
  { time: "02:00 PM", title: "Stalls / Exhibition" },
  { time: "Free Time", title: "Indoor/Outdoor Games, Pool, etc." },
  { time: "04:30 PM", title: "Asr & High Tea" },
  { time: "04:45 PM", title: "Games (Gents/Ladies separately)" },
  { time: "05:30 PM", title: "Pathway to Spirituality – Session by Sharfudheen Hudawi Anamangadu" },
  { time: "06:30 PM", title: "Maghrib" },
  { time: "07:00 PM", title: "Gift Distribution – Closing" }
],
  // Inside defaultLandingContent in landing-data.js
leaderboard: [
  { rank: 1, team: "Red Team", color: "red", points: 485, badge: "🥇", accent: "bg-rose-50 text-rose-800 border-rose-200" },
  { rank: 2, team: "Blue Team", color: "blue", points: 462, badge: "🥈", accent: "bg-blue-50 text-blue-800 border-blue-200" },
  { rank: 3, team: "Green Team", color: "green", points: 438, badge: "🥉", accent: "bg-emerald-50 text-emerald-800 border-emerald-200" }
]
};

export async function fetchAnnouncements() {
  try {
    const snap = await getDocs(query(collection(db, "landingAnnouncements"), where("isDeleted", "!=", true)));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) { /* fallback to default */ }
  return defaultLandingContent.announcements;
}

// Dynamic Firestore aggregator in landing-data.js
export async function fetchLiveLeaderboard() {
  try {
    const q = query(
      collection(db, "meetupScores"),
      where("year", "==", 2026)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const totals = { red: 0, blue: 0, green: 0 };
      snap.docs.forEach(doc => {
        const data = doc.data();
        const color = (data.groupColor || "").toLowerCase();
        if (totals[color] !== undefined) {
          totals[color] += Number(data.score || 0);
        }
      });

      const teamStyles = {
        red: { name: "Red Team", badge: "🥇", accent: "bg-rose-50 text-rose-800 border-rose-200" },
        blue: { name: "Blue Team", badge: "🥈", accent: "bg-blue-50 text-blue-800 border-blue-200" },
        green: { name: "Green Team", badge: "🥉", accent: "bg-emerald-50 text-emerald-800 border-emerald-200" }
      };

      const sorted = Object.keys(totals)
        .map(color => ({
          color,
          points: totals[color],
          team: teamStyles[color].name
        }))
        .sort((a, b) => b.points - a.points);

      const badges = ["🥇", "🥈", "🥉"];
      return sorted.map((item, idx) => ({
        rank: idx + 1,
        team: item.team,
        color: item.color,
        points: item.points,
        badge: badges[idx] || "",
        accent: teamStyles[item.color].accent
      }));
    }
  } catch (err) {
    console.warn("Using offline house leaderboard:", err);
  }

  return defaultLandingContent.leaderboard;
}