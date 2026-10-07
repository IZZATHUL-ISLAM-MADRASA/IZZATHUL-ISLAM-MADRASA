import { db, getCachedDocs } from "../core/firebase-config.js";
import { collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { calculateGrade, padAdmissionNo } from "../core/utils.js";
import { UI } from "../core/ui.js";

export const ConsolidatedResultsModule = {
  id: "consolidated-results",
  title: "Class Results & Rankings",
  roles: ["admin", "staff"],

  async render(container, user) {
    const isAdmin = user.role === "admin";

    container.innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--muted);">
        <p>Loading classes, examinations, and roster analytics...</p>
      </div>
    `;

    // 1. Fetch prerequisite records
    const [eSnap, cSnap, clSnap, csSnap] = await Promise.all([
      getCachedDocs(collection(db, "exams"), "exams"),
      getCachedDocs(collection(db, "classrooms"), "classrooms"),
      getCachedDocs(collection(db, "classes"), "classes"),
      getCachedDocs(collection(db, "classroom_subjects"), "classroom_subjects")
    ]);

    const exams = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    let classrooms = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const classes = clSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    const allocatedSubjects = csSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // If staff, filter classrooms to only those they teach[cite: 7]
    if (!isAdmin) {
      const taughtCrmIds = new Set();
      allocatedSubjects.forEach(cs => {
        if (cs.teacherId === user.id || cs.teacherName === user.name || cs.teacherId === user.username) {
          taughtCrmIds.add(cs.classroomId);
        }
      });
      classrooms.forEach(crm => {
        if (crm.ustadhId === user.id || crm.ustadhName === user.name) {
          taughtCrmIds.add(crm.id);
        }
      });
      classrooms = classrooms.filter(crm => taughtCrmIds.has(crm.id));
    }

    if (classrooms.length === 0) {
      container.innerHTML = `
        <div class="stat-card" style="text-align:center; padding:32px;">
          <h3>No Classrooms Assigned</h3>
          <p style="color:var(--muted); font-size:13px; margin-top:6px;">
            You have not been assigned to any classrooms or subjects yet. Please contact administration.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <style>
        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin: 14px 0;
        }
        .analytics-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .analytics-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
        }
        .analytics-val {
          font-size: 20px;
          font-weight: 800;
          color: var(--primary);
          margin-top: 2px;
        }
        .rank-badge {
          display: inline-block;
          min-width: 28px;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }
        .rank-1 { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .rank-2 { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .rank-3 { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
        .rank-normal { background: #f8fafc; color: #64748b; }
      </style>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
        <div>
          <h2 style="margin:0;">Class-Wise Results &amp; Ranking Ledger</h2>
          <p style="color:var(--muted); font-size:13px; margin:2px 0 0 0;">
            ${isAdmin ? 'Consolidated student marks, merit ranks, and classroom analytics across all batches.' : `Showing results for your assigned classrooms.`}
          </p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary btn-sm" id="export-excel-btn" disabled>📥 Export Excel (.csv)</button>
          <button class="btn-primary btn-sm" id="print-ledger-btn" disabled>📄 Generate PDF / Print</button>
        </div>
      </div>

      <!-- Filters Row -->
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:16px;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:flex-end;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">1. Select Examination</label>
            <select id="con-exam" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;">
              ${exams.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">2. Select Classroom</label>
            <select id="con-crm" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;">
              ${classrooms.map(c => `<option value="${c.id}" data-name="${c.name}" data-mode="${c.mode||'offline'}">${c.name} (${(c.mode||'offline').toUpperCase()})</option>`).join("")}
            </select>
          </div>

          <div>
            <button class="btn-primary" id="load-analytics-btn" style="width:100%; height:38px;">🔍 View Results &amp; Rankings</button>
          </div>
        </div>
      </div>

      <!-- Analytics and Table Target Area -->
      <div id="results-analytics-area"></div>
    `;

    const examSelect = container.querySelector("#con-exam");
    const crmSelect = container.querySelector("#con-crm");
    const loadBtn = container.querySelector("#load-analytics-btn");
    const analyticsArea = container.querySelector("#results-analytics-area");
    const excelBtn = container.querySelector("#export-excel-btn");
    const printBtn = container.querySelector("#print-ledger-btn");

    let activeLedgerData = null;

    loadBtn.onclick = async () => {
      const examId = examSelect.value;
      const crmId = crmSelect.value;
      const crmName = crmSelect.options[crmSelect.selectedIndex]?.dataset.name;
      const crmMode = (crmSelect.options[crmSelect.selectedIndex]?.dataset.mode || "offline").toLowerCase();
      const examName = examSelect.options[examSelect.selectedIndex]?.text;

      if (!crmId) return;

      analyticsArea.innerHTML = `<p style="text-align:center; padding:30px; color:var(--muted);">Consolidating student performance records...</p>`;
      excelBtn.disabled = true;
      printBtn.disabled = true;

      try {
        // Fetch students & results in parallel[cite: 7]
        const [studentsSnap, resultsSnap] = await Promise.all([
          getCachedDocs(query(collection(db, "students"), where("classroomId", "==", crmId)), "students", `crm_stds_${crmId}`),
          getCachedDocs(query(collection(db, "results"), where("examId", "==", examId), where("classroomId", "==", crmId)), "results", `res_${examId}_${crmId}`)
        ]);

        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (students.length === 0) {
          analyticsArea.innerHTML = `<p style="padding:16px; background:#fff; border-radius:8px; border:1px solid #cbd5e1;">No students enrolled in <strong>${crmName}</strong>.</p>`;
          return;
        }

        const resultsMap = new Map();
        resultsSnap.docs.forEach(d => resultsMap.set(d.data().studentId, d.data()));

        // Discover all unique evaluated subjects across this classroom's results
        const subjectColsMap = new Map();
        resultsSnap.docs.forEach(docSnap => {
          const rec = docSnap.data();
          Object.entries(rec).forEach(([k, v]) => {
            if (k.startsWith("marks_") && v && typeof v === "object") {
              const subId = v.subjectId || k.slice(6);
              if (!subjectColsMap.has(subId)) {
                subjectColsMap.set(subId, {
                  id: subId,
                  name: v.subjectName || subId,
                  maxTotal: Number(v.maxTotal) || 100
                });
              }
            }
          });
        });
        const subjectList = Array.from(subjectColsMap.values());

        // Process student performance records
        const ledger = students.map(st => {
          const resDoc = resultsMap.get(st.id) || {};
          let grandTotal = 0;
          let grandMax = 0;
          let allPassed = true;
          let hasAppeared = false;
          let isAbsentTotal = true;

          const subjectMarks = {};

          subjectList.forEach(sub => {
            const sm = resDoc[`marks_${sub.id}`];
            if (sm) {
              hasAppeared = true;
              const isAb = sm.isAbsent || sm.total === "AB";
              if (!isAb) isAbsentTotal = false;

              const val = isAb ? 0 : (parseFloat(sm.total) || 0);
              grandTotal += val;
              grandMax += Number(sm.maxTotal) || sub.maxTotal;
              if (!sm.isPassed) allPassed = false;

              subjectMarks[sub.id] = {
                score: isAb ? "AB" : val,
                grade: sm.grade || "F",
                isPassed: isAb ? false : Boolean(sm.isPassed)
              };
            } else {
              grandMax += sub.maxTotal;
              allPassed = false;
              subjectMarks[sub.id] = { score: "-", grade: "-", isPassed: false };
            }
          });

          const pct = grandMax > 0 ? (grandTotal / grandMax) * 100 : 0;
          let { grade: overallGrade } = calculateGrade(pct);
          if (!allPassed || isAbsentTotal) overallGrade = isAbsentTotal ? "AB" : "F";

          // Exam attendance tracking[cite: 7]
          const attObj = resDoc[`att_${examId}`] || resDoc.examAttendance || {};

          return {
            studentId: st.id,
            admissionNo: st.admissionNo,
            studentName: st.name,
            mode: st.mode || crmMode,
            subjectMarks,
            grandTotal,
            grandMax,
            percentage: pct,
            overallGrade,
            allPassed: hasAppeared && allPassed && !isAbsentTotal,
            isAbsent: isAbsentTotal,
            hasAppeared,
            attendance: attObj.present !== undefined ? `${attObj.present}/${attObj.total}` : "-"
          };
        });

        // Compute rankings
        // Order: Passed students with highest percentage first, then failed students, then absent[cite: 7]
        ledger.sort((a, b) => {
          if (a.allPassed && !b.allPassed) return -1;
          if (!a.allPassed && b.allPassed) return 1;
          if (!a.isAbsent && b.isAbsent) return -1;
          if (a.isAbsent && !b.isAbsent) return 1;
          return b.grandTotal - a.grandTotal;
        });

        let currentRank = 1;
        ledger.forEach((item, idx) => {
          if (item.allPassed) {
            if (idx > 0 && item.grandTotal === ledger[idx - 1].grandTotal) {
              item.rank = ledger[idx - 1].rank;
            } else {
              item.rank = currentRank;
            }
            currentRank++;
          } else {
            item.rank = "-";
          }
        });

        // Aggregate Analytics
        const totalEnrolled = ledger.length;
        const totalAppeared = ledger.filter(l => l.hasAppeared && !l.isAbsent).length;
        const totalPassed = ledger.filter(l => l.allPassed).length;
        const totalFailed = totalAppeared - totalPassed;
        const totalAbsent = ledger.filter(l => l.isAbsent).length;
        const passPercentage = totalAppeared > 0 ? ((totalPassed / totalAppeared) * 100).toFixed(1) : "0.0";
        
        const validPercentages = ledger.filter(l => l.hasAppeared && !l.isAbsent).map(l => l.percentage);
        const classAverage = validPercentages.length > 0 ? (validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length).toFixed(1) : "0.0";
        const classTopper = ledger.find(l => l.allPassed) || ledger[0];

        // Grade Distribution Breakdown
        const gradeCounts = { "A+": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0 };
        ledger.forEach(l => {
          if (gradeCounts[l.overallGrade] !== undefined) gradeCounts[l.overallGrade]++;
        });

        activeLedgerData = {
          examName,
          crmName,
          crmMode,
          subjectList,
          ledger,
          stats: { totalEnrolled, totalAppeared, totalPassed, totalFailed, totalAbsent, passPercentage, classAverage, classTopper, gradeCounts }
        };

        excelBtn.disabled = false;
        printBtn.disabled = false;

        // Render Analytics Overview & Consolidated Table
        analyticsArea.innerHTML = `
          <!-- Analytics KPI Counters -->
          <div class="analytics-grid">
            <div class="analytics-card">
              <span class="analytics-title">Class Pass Rate</span>
              <div class="analytics-val" style="color:#166534;">${passPercentage}%</div>
            </div>
            <div class="analytics-card">
              <span class="analytics-title">Class Average</span>
              <div class="analytics-val">${classAverage}%</div>
            </div>
            <div class="analytics-card">
              <span class="analytics-title">Appeared / Total</span>
              <div class="analytics-val">${totalAppeared} / ${totalEnrolled}</div>
            </div>
            <div class="analytics-card">
              <span class="analytics-title">Passed</span>
              <div class="analytics-val" style="color:#166534;">${totalPassed}</div>
            </div>
            <div class="analytics-card">
              <span class="analytics-title">Failed</span>
              <div class="analytics-val" style="color:#dc2626;">${totalFailed}</div>
            </div>
            <div class="analytics-card">
              <span class="analytics-title">Class Topper</span>
              <div class="analytics-val" style="font-size:14px; margin-top:6px; color:#d97706;">
                ${classTopper && classTopper.allPassed ? `${classTopper.studentName} (${classTopper.percentage.toFixed(1)}%)` : '-'}
              </div>
            </div>
          </div>

          <!-- Grade Breakdown Bar -->
          <div class="stat-card" style="margin-bottom:14px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <span style="font-size:12px; font-weight:700;">Grade Distribution:</span>
              <div style="display:flex; gap:12px; font-size:12px; font-weight:600;">
                <span style="color:#15803d;">A+: <strong>${gradeCounts["A+"]}</strong></span>
                <span style="color:#16a34a;">A: <strong>${gradeCounts["A"]}</strong></span>
                <span style="color:#2563eb;">B: <strong>${gradeCounts["B"]}</strong></span>
                <span style="color:#ca8a04;">C: <strong>${gradeCounts["C"]}</strong></span>
                <span style="color:#ea580c;">D: <strong>${gradeCounts["D"]}</strong></span>
                <span style="color:#dc2626;">F: <strong>${gradeCounts["F"]}</strong></span>
              </div>
            </div>
          </div>

          <!-- Consolidated Merit Ledger Table -->
          <div class="stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h4 style="margin:0; font-size:15px; color:var(--primary);">
                ${crmName} — Consolidated Score Sheet (${examName})
              </h4>
              <span class="badge ${crmMode === 'online' ? 'badge-online' : 'badge-offline'}">
                ${crmMode.toUpperCase()} BATCH
              </span>
            </div>

            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style="width:45px; text-align:center;">Rank</th>
                    <th style="width:75px;">Adm No</th>
                    <th>Student Name</th>
                    ${subjectList.map(s => `<th style="text-align:center;">${s.name}</th>`).join("")}
                    <th style="text-align:center;">Total</th>
                    <th style="text-align:center;">%</th>
                    <th style="text-align:center;">Grade</th>
                    <th style="text-align:center;">Result</th>
                    <th style="text-align:center;">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  ${ledger.map(row => {
                    const rankClass = row.rank === 1 ? 'rank-1' : (row.rank === 2 ? 'rank-2' : (row.rank === 3 ? 'rank-3' : 'rank-normal'));
                    return `
                      <tr>
                        <td style="text-align:center;">
                          <span class="rank-badge ${rankClass}">
                            ${row.rank === 1 ? '🥇 1' : (row.rank === 2 ? '🥈 2' : (row.rank === 3 ? '🥉 3' : (row.rank !== '-' ? `#${row.rank}` : '-')))}
                          </span>
                        </td>
                        <td><strong>${row.admissionNo}</strong></td>
                        <td>${row.studentName}</td>${subjectList.map(s => {
                          const mark = row.subjectMarks[s.id];
                          const isFailedSub = mark && !mark.isPassed && mark.score !== "-";
                          return `
                            <td style="text-align:center; color:${isFailedSub ? '#dc2626' : 'inherit'}; font-weight:${isFailedSub ? '700' : 'normal'};">
                              ${mark ? mark.score : '-'}
                            </td>
                          `;
                        }).join("")}
                        <td style="text-align:center; font-weight:700; color:var(--primary);">${row.isAbsent ? 'AB' : row.grandTotal}</td>
                        <td style="text-align:center; font-weight:600;">${row.isAbsent ? '-' : `${row.percentage.toFixed(1)}%`}</td>
                        <td style="text-align:center;">
                          <span class="badge ${row.overallGrade === 'F' || row.isAbsent ? 'badge-inactive' : 'badge-active'}">
                            ${row.overallGrade}
                          </span>
                        </td>
                        <td style="text-align:center; font-weight:700; color:${row.allPassed ? '#16a34a' : '#dc2626'};">
                          ${row.isAbsent ? 'ABSENT' : (row.allPassed ? 'PASSED' : 'FAILED')}
                        </td>
                        <td style="text-align:center; font-size:12px; color:var(--muted);">${row.attendance}</td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        console.error(err);
        analyticsArea.innerHTML = `<p style="color:#dc2626; padding:16px;">Error calculating class analytics: ${err.message}</p>`;
      }
    };

    // Excel / CSV Export
    excelBtn.onclick = () => {
      if (!activeLedgerData) return;
      const { crmName, examName, subjectList, ledger } = activeLedgerData;

      const headers = [
        "Rank",
        "Admission No",
        "Student Name",
        "Learning Mode",
        ...subjectList.map(s => s.name),
        "Grand Total",
        "Max Marks",
        "Percentage",
        "Overall Grade",
        "Status",
        "Attendance"
      ];

      const escapeCSV = v => `"${String(v ?? "").replace(/"/g, '""')}"`;

      const rows = ledger.map(l => [
        l.rank,
        l.admissionNo,
        l.studentName,
        l.mode.toUpperCase(),
        ...subjectList.map(s => l.subjectMarks[s.id]?.score ?? "-"),
        l.isAbsent ? "AB" : l.grandTotal,
        l.grandMax,
        l.isAbsent ? "0.0%" : `${l.percentage.toFixed(1)}%`,
        l.overallGrade,
        l.allPassed ? "PASSED" : (l.isAbsent ? "ABSENT" : "FAILED"),
        l.attendance
      ].map(escapeCSV).join(","));

      const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `ClassResults_${crmName.replace(/\s+/g, "_")}_${examName.replace(/\s+/g, "_")}.csv`;
      link.click();
      UI.toast("Excel file downloaded successfully!");
    };

    // Dedicated A4 Landscape Print Window Generator
    printBtn.onclick = () => {
      if (!activeLedgerData) return;
      const { crmName, examName, crmMode, subjectList, ledger, stats } = activeLedgerData;

      const printWin = window.open("", "_blank");
      if (!printWin) {
        UI.toast("Please allow popups to generate the printable PDF ledger.", "error");
        return;
      }

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${crmName} - ${examName} Results Ledger</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              line-height: 1.35;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #065f46;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header h1 {
              font-size: 18px;
              color: #065f46;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header p {
              font-size: 11px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              font-weight: 600;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 6px 12px;
              border-radius: 4px;
              margin-bottom: 10px;
            }
            .stats-bar {
              display: flex;
              justify-content: space-between;
              font-size: 10.5px;
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              margin-bottom: 12px;
              background: #ecfdf5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 5px 6px;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 700;
              text-align: center;
            }
            td.left { text-align: left; }
            td.center { text-align: center; }
            .passed { color: #166534; font-weight: 700; }
            .failed { color: #dc2626; font-weight: 700; }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 36px;
              font-size: 11px;
              text-align: center;
            }
            .signatures div {
              width: 180px;
              border-top: 1px dashed #64748b;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>IZZATHUL ISLAM MADRASA</h1>
            <p>Affiliated with Samastha Kerala Jam'iyyathul Ulama (Reg. No. 9016) • Bengaluru</p>
            <p style="font-size: 12px; font-weight: 700; color: #d97706; margin-top: 3px;">
              OFFICIAL CONSOLIDATED MARKS &amp; MERIT RANK LEDGER
            </p>
          </div>

          <div class="meta-bar">
            <div><strong>Examination:</strong> ${examName}</div>
            <div><strong>Classroom:</strong> ${crmName}</div>
            <div><strong>Batch Mode:</strong> ${crmMode.toUpperCase()}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}</div>
          </div>

          <div class="stats-bar">
            <div>Enrolled: <strong>${stats.totalEnrolled}</strong></div>
            <div>Appeared: <strong>${stats.totalAppeared}</strong></div>
            <div>Passed: <strong>${stats.totalPassed}</strong></div>
            <div>Failed: <strong>${stats.totalFailed}</strong></div>
            <div>Pass Rate: <strong>${stats.passPercentage}%</strong></div>
            <div>Class Average: <strong>${stats.classAverage}%</strong></div>
            <div>Topper: <strong>${stats.classTopper?.studentName || '-'}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 32px;">Rank</th>
                <th style="width: 50px;">Adm No</th>
                <th style="text-align: left;">Student Name</th>
                ${subjectList.map(s => `<th>${s.name}</th>`).join("")}
                <th>Total</th>
                <th>%</th>
                <th>Grade</th>
                <th>Result</th>
                <th>Attd</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map(row => `
                <tr>
                  <td class="center"><strong>${row.rank !== '-' ? row.rank : '-'}</strong></td>
                  <td class="center">${row.admissionNo}</td>
                  <td class="left"><strong>${row.studentName}</strong></td>${subjectList.map(s => {
                    const mark = row.subjectMarks[s.id];
                    const isFail = mark && !mark.isPassed && mark.score !== "-";
                    return `<td class="center" style="${isFail ? 'color:#dc2626;font-weight:bold;' : ''}">${mark ? mark.score : '-'}</td>`;
                  }).join("")}
                  <td class="center" style="font-weight: bold; color: #065f46;">${row.isAbsent ? 'AB' : row.grandTotal}</td>
                  <td class="center">${row.isAbsent ? '-' : `${row.percentage.toFixed(1)}%`}</td>
                  <td class="center"><strong>${row.overallGrade}</strong></td>
                  <td class="center ${row.allPassed ? 'passed' : 'failed'}">${row.isAbsent ? 'ABSENT' : (row.allPassed ? 'PASSED' : 'FAILED')}</td>
                  <td class="center">${row.attendance}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="signatures">
            <div>Class Ustadh</div>
            <div>Headmaster / Sadar Muallim</div>
            <div>Exam Controller / Principal</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    };
  }
};