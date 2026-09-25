// // admin-meetup-export.js

// export function calculateGridTotals(rows = [], attendees = []) {
//   let grandAdults = 0;
//   let grandChildren = 0;
//   let grandInfants = 0;
//   let grandChecked = 0;
//   let grandTotal = 0;

//   const dataRows = (rows || []).map((r, idx) => {
//     const regId = String(r.id || r.registrationNo || "").trim();

//     // 1. Locate individual member badges linked to this registration
//     const fMembers = (attendees || []).filter(a => {
//       const aRegId = String(a.registrationId || "").trim();
//       return aRegId === regId || 
//              (regId && a.id && String(a.id).startsWith(regId));
//     });

//     // 2. Extract Names or fallback lists
//     const parseNames = (field) => {
//       if (!field) return [];
//       if (Array.isArray(field)) return field.map(n => String(n).trim()).filter(Boolean);
//       return String(field).split(/[\n;,]+/).map(n => n.trim()).filter(Boolean);
//     };

//     const adultNames = fMembers.length 
//       ? fMembers.filter(a => a.category === "above12").map(a => a.memberName || "Guest").filter(Boolean)
//       : parseNames(r.membersAbove12 || r["Adults (12+ yrs) - Names"]);

//     const childNames = fMembers.length 
//       ? fMembers.filter(a => a.category === "age5to12" || a.category === "5to12").map(a => a.memberName || "Guest").filter(Boolean)
//       : parseNames(r.members5to12 || r["Children (5-12 yrs) - Names"]);

//     const infantNames = fMembers.length 
//       ? fMembers.filter(a => a.category === "below5").map(a => a.memberName || "Guest").filter(Boolean)
//       : parseNames(r.membersBelow5 || r["Infants (below 5 yrs) - Names"]);

//     // 3. Resolve numerical counts
//     let cAdults = adultNames.length || Number(r.attendeeCounts?.above12 || 0);
//     let cChildren = childNames.length || Number(r.attendeeCounts?.age5to12 || 0);
//     let cInfants = infantNames.length || Number(r.attendeeCounts?.below5 || 0);

//     const checked = fMembers.filter(a => a.status === "checked_in").length || Number(r.checkedInCount || 0);
//     const rowTotal = (cAdults + cChildren + cInfants) || 
//                      fMembers.length || 
//                      Number(r.totalAttendees || 1);

//     grandAdults += cAdults;
//     grandChildren += cChildren;
//     grandInfants += cInfants;
//     grandChecked += checked;
//     grandTotal += rowTotal;

//     return {
//       slNo: idx + 1,
//       id: r.registrationNo || r.id || `REG2026-${String(idx + 1).padStart(3, "0")}`,
//       family: r.familyName || r["Family (Reference Name)"] || r["Family Name"] || "Family",
//       adultsText: adultNames.join("\n"),
//       childrenText: childNames.join("\n"),
//       infantsText: infantNames.join("\n"),
//       cAdults,
//       cChildren,
//       cInfants,
//       checked,
//       rowTotal,
//       team: (r.groupColor || "general").toUpperCase(),
//       mobile: r.mobileNo || r["Contact Number 1"] || r["Mobile"] || "-"
//     };
//   });

//   return {
//     rows: dataRows,
//     summary: {
//       grandAdults,
//       grandChildren,
//       grandInfants,
//       grandChecked,
//       grandTotal
//     }
//   };
// }

// // -------------------------------------------------------------
// // EXCEL EXPORT HANDLER
// // -------------------------------------------------------------
// export function exportRegistrationsExcel(rows = [], attendees = [], filterName = "All") {
//   if (!window.XLSX) {
//     alert("Excel export library is loading. Please wait a moment.");
//     return;
//   }

//   const dataToExport = rows.length > 0 ? rows : [];
//   if (dataToExport.length === 0) {
//     alert("No records to export.");
//     return;
//   }

//   const { rows: gridRows, summary } = calculateGridTotals(dataToExport, attendees);

//   const excelData = gridRows.map(r => ({
//     "S.No": r.slNo,
//     "Family Reference Name": r.family,
//     "Mobile Number": r.mobile,
//     "Adults (12+)": r.cAdults,
//     "Children (5-12)": r.cChildren,
//     "Infants (<5)": r.cInfants,
//     "Total Passes": r.rowTotal,
//     "Team Color": r.team,
//     "Checked-in Gate": r.checked
//   }));

//   // Append Grand Total Row at bottom
//   excelData.push({
//     "S.No": "TOTAL",
//     "Family Reference Name": `Grand Total (${gridRows.length} Families)`,
//     "Mobile Number": "",
//     "Adults (12+)": summary.grandAdults,
//     "Children (5-12)": summary.grandChildren,
//     "Infants (<5)": summary.grandInfants,
//     "Total Passes": summary.grandTotal,
//     "Team Color": "",
//     "Checked-in Gate": summary.grandChecked
//   });

//   const ws = window.XLSX.utils.json_to_sheet(excelData);

//   ws["!cols"] = [
//     { wch: 6 },  // S.No
//     { wch: 26 }, // Family Name
//     { wch: 16 }, // Mobile
//     { wch: 14 }, // Adults
//     { wch: 14 }, // Children
//     { wch: 14 }, // Infants
//     { wch: 14 }, // Total
//     { wch: 14 }, // Team Color
//     { wch: 16 }  // Checked
//   ];

//   const wb = window.XLSX.utils.book_new();
//   window.XLSX.utils.book_append_sheet(wb, ws, "Attendance Summary");
//   window.XLSX.writeFile(wb, `Taaluf_2026_Report_${filterName.replace(/\s+/g, "_")}.xlsx`);
// }

// // -------------------------------------------------------------
// // PDF EXPORT HANDLER (Color Header + Double Totals)
// // -------------------------------------------------------------
// export function exportRegistrationsPdf(rows = [], attendees = [], filterName = "All") {
//   if (!window.jspdf?.jsPDF) {
//     alert("PDF library is loading. Please wait a moment.");
//     return;
//   }

//   const dataToExport = rows.length > 0 ? rows : [];
//   if (dataToExport.length === 0) {
//     alert("No records to export.");
//     return;
//   }

//   const { rows: gridRows, summary } = calculateGridTotals(dataToExport, attendees);
//   const doc = new window.jspdf.jsPDF({ 
//     orientation: "portrait", 
//     unit: "mm", 
//     format: "a4" 
//   });

//   const pageWidth = doc.internal.pageSize.getWidth();

//   // 1. BRANDED BANNER
//   doc.setFillColor(6, 78, 59); // emerald-900
//   doc.rect(0, 0, pageWidth, 28, "F");

//   doc.setFillColor(217, 119, 6); // amber-600
//   doc.rect(0, 28, pageWidth, 1.5, "F");

//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(15);
//   doc.setTextColor(255, 255, 255);
//   doc.text("TA'ALUF FAMILY GATHERING 2026", pageWidth / 2, 11, { align: "center" });

//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(8.5);
//   doc.setTextColor(167, 243, 208); // emerald-200
//   doc.text("IZZATHUL ISLAM MADRASA • TOGETHERNESS • HARMONY • BARAKAH", pageWidth / 2, 17, { align: "center" });

//   doc.setFontSize(7.5);
//   doc.setTextColor(209, 250, 229); // emerald-100
//   doc.text("Venue: Khedda Resort, Kanakapura Road  |  Date: 27 September 2026", pageWidth / 2, 23, { align: "center" });

//   // 2. SUB-BAR
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(8.5);
//   doc.setTextColor(15, 23, 42); // slate-900
//   doc.text(`REGISTER REPORT: ${filterName.toUpperCase()} TEAMS`, 14, 36);

//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(7.5);
//   doc.setTextColor(100, 116, 139); // slate-500
//   doc.text(`Total Families: ${gridRows.length}  |  Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 36, { align: "right" });

//   // 3. COLOR-CODED TABLE STRUCTURE
//   const tableHead = [[
//     "Sl", 
//     "Family Reference Name", 
//     "12+", 
//     "5-12", 
//     "<5", 
//     "Total", 
//     "Team Color"
//   ]];

//   const tableBody = gridRows.map(r => [
//     r.slNo,
//     r.family,
//     r.cAdults,
//     r.cChildren,
//     r.cInfants,
//     r.rowTotal,
//     r.team
//   ]);

//   const tableFoot = [[
//     "TOTAL",
//     `Grand Total (${gridRows.length} Families)`,
//     summary.grandAdults,
//     summary.grandChildren,
//     summary.grandInfants,
//     summary.grandTotal,
//     ""
//   ]];

//   if (doc.autoTable) {
//     doc.autoTable({
//       head: tableHead,
//       body: tableBody,
//       foot: tableFoot,
//       startY: 40,
//       theme: "grid",
//       headStyles: {
//         fillColor: [15, 23, 42],      // slate-900
//         textColor: [255, 255, 255],
//         fontStyle: "bold",
//         fontSize: 8.5,
//         halign: "center",
//         valign: "middle"
//       },
//       bodyStyles: {
//         fontSize: 8,
//         textColor: [30, 41, 59],       // slate-800
//         cellPadding: 2.4,
//         valign: "middle"
//       },
//       alternateRowStyles: {
//         fillColor: [248, 250, 252]     // slate-50
//       },
//       footStyles: {
//         fillColor: [236, 253, 245],    // emerald-50
//         textColor: [6, 78, 59],        // emerald-900
//         fontStyle: "bold",
//         fontSize: 8.5,
//         halign: "center",
//         valign: "middle"
//       },
//       columnStyles: {
//         0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
//         1: { cellWidth: "auto", fontStyle: "bold" },
//         2: { cellWidth: 16, halign: "center" },
//         3: { cellWidth: 16, halign: "center" },
//         4: { cellWidth: 16, halign: "center" },
//         5: { 
//           cellWidth: 20, 
//           halign: "center", 
//           fontStyle: "bold",
//           fillColor: [241, 245, 249]   // slate-100 highlighted
//         },
//         6: { cellWidth: 26, halign: "center", fontStyle: "bold" }
//       },
//       didParseCell: function(data) {
//         // Apply team color chips in column index 6
//         if (data.section === "body" && data.column.index === 6) {
//           const val = String(data.cell.raw || "").toLowerCase();
//           if (val.includes("red")) {
//             data.cell.styles.fillColor = [255, 228, 230]; // rose-100
//             data.cell.styles.textColor = [190, 18, 60];   // rose-700
//           } else if (val.includes("blue")) {
//             data.cell.styles.fillColor = [219, 234, 254]; // blue-100
//             data.cell.styles.textColor = [29, 78, 216];   // blue-700
//           } else if (val.includes("green")) {
//             data.cell.styles.fillColor = [209, 250, 229]; // emerald-100
//             data.cell.styles.textColor = [4, 120, 87];    // emerald-700
//           }
//         }
//       },
//       margin: { left: 14, right: 14, bottom: 14 }
//     });
//   } else {
//     alert("jsPDF-AutoTable plugin is required to format the PDF table. Ensure it is included in your index.html.");
//     return;
//   }

//   doc.save(`Taaluf_2026_Family_Summary_${filterName.replace(/\s+/g, "_")}.pdf`);
// }