// API Endpoints
const apiUrl = "https://script.google.com/macros/s/AKfycbxgYi-QeCjL72FSM_jWExzgeFGIp44_ciOY-GwjGkuHaisi6ZvWVyw3NVEKeiv511nRgQ/exec"; // 2025-26
const online = "https://script.google.com/macros/s/AKfycbwXGHxq87nwa-vVAEObZgQpOqWLTM9JPBidk8aOX9N90VDoJ1q0TubVLUTpS0f1An0T/exec";

// ==========================================
// 1. LOGIN / REDIRECT LOGIC
// ==========================================

function fetchStudentData(event) {
    event.preventDefault();

    const admissionNumber = document.getElementById("admissionNumber").value.toUpperCase();
    const classInput = document.getElementById("class").value;
    const division = document.getElementById("division").value;
    
    // --- ADMIN LOGIN CHECK ---
    if (admissionNumber === "ONUSTH@D" || admissionNumber === "USTH@D") {
        const mode = admissionNumber === "ONUSTH@D" ? "online" : "offline";
        // Save session details
        sessionStorage.setItem("adminUser", "true");
        sessionStorage.setItem("adminMode", mode); // "online" or "offline"
        
        // Optional: Save the class/div user selected to auto-load on next page
        if(classInput) sessionStorage.setItem("defaultClass", classInput);
        if(division) sessionStorage.setItem("defaultDiv", division);

        // Redirect
        window.location.href = "masterResult.html";
        return;
    }
    // -------------------------

    const loadingElement = document.getElementById("loading");
    const resultElement = document.getElementById("result");
    loadingElement.style.display = "block";
    resultElement.innerHTML = "";

    if (!validateForm(admissionNumber, classInput, division)) {
        loadingElement.style.display = "none";
        return;
    }

    let url = `${apiUrl}?admission_number=${admissionNumber}&class=${classInput}&division=${division}`;
    const firstTwoChars = admissionNumber.slice(0, 2).toUpperCase();

    if (firstTwoChars === "ON") {
        url = `${online}?admission_number=${admissionNumber}&class=${classInput}&division=${division}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            loadingElement.style.display = "none";
            if (data.student) {
                if (firstTwoChars === "ON") {
                    displayOnlineResultnoOmr(data);
                } else {
                    displayResult(data);
                }
            } else {
                displayError("Student not found.");
            }
        })
        .catch(error => {
            loadingElement.style.display = "none";
            displayError("Error fetching data. Please try again.");
            console.error(error);
        });
}

// ==========================================
// 2. ADMIN PAGE FUNCTIONS
// ==========================================

function checkAdminSession() {
    const isAdmin = sessionStorage.getItem("adminUser");
    if (!isAdmin) {
        // Not logged in, go back home
        window.location.href = "secondTerm-exam.html"; 
    } else {
        // Pre-fill controls if available
        const defClass = sessionStorage.getItem("defaultClass");
        const defDiv = sessionStorage.getItem("defaultDiv");
        const mode = sessionStorage.getItem("adminMode");
        
        if(defClass) document.getElementById("adminClass").value = defClass;
        if(defDiv) document.getElementById("adminDivision").value = defDiv;
        
        document.getElementById("pageTitle").innerText = `MASTER RESULT (${mode.toUpperCase()})`;
    }
}

function logoutAdmin() {
    sessionStorage.clear();
    window.location.href = "secondTerm-exam.html";
}

function fetchMasterData() {
    const classInput = document.getElementById("adminClass").value;
    const division = document.getElementById("adminDivision").value;
    const mode = sessionStorage.getItem("adminMode"); // "online" or "offline"

    if (!classInput || !division) {
        alert("Please select both Class and Division.");
        return;
    }

    const loadingElement = document.getElementById("loading");
    const resultElement = document.getElementById("result");
    document.getElementById("resltsection").style.display = "none";
    loadingElement.style.display = "block";

    let url = "";

    if (mode === "online") {
        // Use Online URL for class marks
        url = `${online}?admission_number=""&action=get_class_marks&class=${classInput}&division=${division}`;
    } else {
        // Use Offline URL for class marks
        url = `${apiUrl}?action=get_class_marks&class=${classInput}&division=${division}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            loadingElement.style.display = "none";
            document.getElementById("resltsection").style.display = "block";
            
            if (mode === "online") {
                displayClasswiseResultBySubjectColumns(classInput, data);
            } else {
                displayClasswiseResulOffline(classInput, data);
            }
        })
        .catch(error => {
            loadingElement.style.display = "none";
            alert("Failed to load data.");
            console.error(error);
        });
}

// ==========================================
// 3. UTILITY & DISPLAY FUNCTIONS
// ==========================================

function validateForm(admissionNumber, classInput, division) {
    const allowedClasses = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
    const allowedDivisions = ["A", "B"];

    if (!allowedClasses.includes(classInput)) {
        alert("Please select a valid Class.");
        return false;
    }
    if (!allowedDivisions.includes(division)) {
        alert("Please select a valid Division.");
        return false;
    }
    return true;
}

function displayError(msg) {
    const resultElement = document.getElementById("result");
    document.getElementById("resltsection").style.display = "block";
    resultElement.innerHTML = `<p class="error">${msg}</p>`;
}

// Calculation Helpers
function calculateGrade(max, marks) { return calculateGradeoff(max, marks); } // Reusing logic
function calculateGradeoff(max, marks) {
    let percentage = (marks / max) * 100;
    if (max === 0) return "A+";
    
    if (percentage >= 95) return "A+";
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B+";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C+";
    if (percentage >= 50) return "C";
    if (percentage >= 36) return "D+"; // Changed to match offline logic
    return "D";
}

// ---------------------------------------------------
// STUDENT INDIVIDUAL RESULTS (Existing Logic)
// ---------------------------------------------------

async function displayResult(data) {
    document.getElementById("resltsection").style.display = "block";
    const resultElement = document.getElementById("result");
    
    let totalMarks = 0;
    let obtainedMarks = 0;
    let allGrades = [];
    const passingGrades = ["A+", "A", "B+", "B", "C+", "C", "D+"];
    
    let marksTable = `<h2>Exam Marks</h2>
        <table>
            <tr><th>Subject</th><th>Max Mark</th><th>Obtained Mark</th><th>Grade</th></tr>`;
            
    data.marks.forEach(mark => {
        const maxMark = parseInt(mark.max_mark) || 50;
        const obtained = parseInt(mark.obtained_mark);
        const grade = calculateGradeoff(maxMark, obtained);
        allGrades.push(grade);
        totalMarks += maxMark;
        obtainedMarks += obtained;
        marksTable += `<tr class="${passingGrades.includes(grade) ? "" : "faild"}">
            <td>${mark.subject}</td><td>${maxMark}</td><td>${obtained}</td><td>${grade}</td></tr>`;
    });
    marksTable += `</table>`;
    
    const isPassed = allGrades.every(grade => passingGrades.includes(grade));
    const studentInfo = await getstudentinfo(data, isPassed, totalMarks, obtainedMarks);
    resultElement.innerHTML = studentInfo + marksTable;
}

async function displayOnlineResultnoOmr(data) {
    document.getElementById("resltsection").style.display = "block";
    const resultElement = document.getElementById("result");

    let totalMarks = 0;
    let obtainedMarks = 0;
    let allGrades = [];
    const passingGrades = ["A+", "A", "B+", "B", "C+", "C", "D+"];

    let marksTable = `<h2>Exam Marks</h2>
        <table>
            <tr><th>Subject</th><th>Type</th><th>Max Mark</th><th>Obtained Mark</th><th>Grade</th></tr>`;

    data.marks.forEach(mark => {
        const maxMark = mark.subject === "VIVA" ? 100 :
                        mark.subject === "قرآن" ? 50 :
                        mark.subject === "حفظ" ? 50 :
                        data.student.class === 1 ? 50 : 50;
                        
        const obtained = parseInt(mark.written) || 0;
        const grade = calculateGradeoff(maxMark, obtained);
        allGrades.push(grade);
        totalMarks += maxMark;
        obtainedMarks += obtained;
        
        const examType = (mark.subject === "VIVA" || mark.subject === "قرآن" || mark.subject === "حفظ" || mark.subject === "Tafheem - Reading") 
                       ? "ORAL" : "WRITTEN";

        marksTable += `<tr class="${passingGrades.includes(grade) ? "" : "faild"}">
            <td>${mark.subject}</td><td>${examType}</td><td>${maxMark}</td><td>${mark.written}</td><td>${grade}</td></tr>`;
    });
    marksTable += `</table>`;

    const isPassed = allGrades.every(grade => passingGrades.includes(grade));
    const studentInfo = await getstudentinfo(data, isPassed, totalMarks, obtainedMarks);
    resultElement.innerHTML = studentInfo + marksTable;
}

async function getstudentinfo(data, isPassed, totalMarks, obtainedMarks) {
    return `
     <h2>Student Details</h2>
        <div class="student-basic">
            <p><strong>Name:</strong><span style="color:#007bff;text-transform: uppercase;"> ${data.student.name}</span></p>
            <p><strong>Class:</strong> ${data.student.class} ${data.student.division}</p>
        </div>
        <div class="student-stats">
            <p><strong>Status:</strong> <span class="status ${isPassed ? 'passed' : 'failed'}">${isPassed ? 'Passed' : 'Failed'}</span></p>
            <p><strong>Rank:</strong> ${isPassed ? data.student.rank : "-"}</p>
            <p><strong>Obtained Marks:</strong> ${obtainedMarks}</p>
            <p><strong>Total Marks:</strong> ${totalMarks}</p>
            <p><strong>Attendance:</strong> ${data.student.attendance}</p>
            <p><strong>Total Working Days:</strong> ${data.student.total_working_days}</p>
        </div>
    `;
}

// ---------------------------------------------------
// MASTER / CLASS-WISE RESULTS (Now used by masterResult.html)
// ---------------------------------------------------

function displayClasswiseResultBySubjectColumns(classInput, data) {
    const container = document.getElementById("result");
    
    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = "<p>No data available.</p>";
        return;
    }
  
    // 1. Get subjects
    const allSubjects = new Set();
    data.forEach(entry => entry.marks.forEach(mark => allSubjects.add(mark.subject)));
    const subjectList = Array.from(allSubjects);
  
    // 2. Build header
    let table = `<table class="result-table"><thead><tr>
      <th>Sl</th><th>Admission No</th><th>Name</th><th>Class-Div</th>`;
  
    subjectList.forEach(subject => {
        table += `<th>${subject}<br><small>(50)</small></th>`;
    });
  
    table += `<th>Attendance</th><th>Total Days</th><th>Total Marks</th><th>Status</th><th>Rank</th></tr></thead><tbody>`;
  
    // 3. Rows
    let sl = 1;
    data.forEach(entry => {
        const s = entry.student;
        let totalMarksw = 0;
        let passStatus = ["f"];
  
        let row = `<tr><td>${sl++}</td><td>${s.admission_number}</td><td>${s.name}</td><td>${s.class}${s.division}</td>`;
  
        const markMap = {};
        entry.marks.forEach(mark => markMap[mark.subject] = { written: Number(mark.written) || 0 });

        subjectList.forEach(subject => {
            if (markMap[subject]) {
                const w = markMap[subject].written;
                totalMarksw += w;
                const pw = (w / 50) * 100; // Assuming 50 max
                const subjectStatus = (pw >= 36) ? "✓" : "✗";
                if (subjectStatus === "✗") passStatus.push("F");
                
                row += `<td style="${subjectStatus === "✗" ? "background-color:#f8d7da;" : ""}">${w}</td>`;
            } else {
                passStatus.push("F");
                row += `<td>-</td>`;
            }
        });
  
        row += `<td>${s.attendance||"-"}</td><td>${s.total_working_days||"-"}</td><td>${totalMarksw}</td>
        <td class="${passStatus.includes("F") ? 'fail' : 'passed'}">${passStatus.includes("F") ? 'Fail' : 'Pass'}</td>
        <td>${s.rank||"-"}</td></tr>`;
        table += row;
    });
    table += "</tbody></table>";
    container.innerHTML = table;
}
  
function displayClasswiseResulOffline(classInput, data) {
    const container = document.getElementById("result");

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = "<p>No data available.</p>";
        return;
    }
  
    const allSubjects = new Set();
    data.forEach(entry => entry.marks.forEach(mark => allSubjects.add(mark.subject)));
    const subjectList = Array.from(allSubjects);
    let subcount = subjectList.length;

    let table = `<table class="result-table"><thead><tr>
      <th>Sl</th><th>Admission No</th><th>Name</th><th>Class-Div</th>`;
  
    subjectList.forEach(subject => {
      table += `<th>${subject}<br><small>(50)</small></th>`;
    });
  
    table += `<th>Attendance</th><th>Total Days</th><th>Total (${subcount*50})</th><th>Status</th><th>Rank</th></tr></thead><tbody>`;
  
    let sl = 1;
    data.forEach(entry => {
        const s = entry.student;
        let totalMarksw = 0;
        let passStatus = ["f"];
  
        let row = `<tr><td>${sl++}</td><td>${s.admission_number}</td><td>${s.name}</td><td>${s.class}${s.division}</td>`;
  
        const markMap = {};
        // Note: Offline data uses 'obtMark' and 'maxMark' keys usually, adapting based on your snippet
        entry.marks.forEach(mark => {
            markMap[mark.subject] = { written: Number(mark.obtMark) || 0 };
        });

        subjectList.forEach(subject => {
            if (markMap[subject]) {
                const w = markMap[subject].written;
                totalMarksw += w;
                const pw = (w / 50) * 100; 
                const subjectStatus = (pw >= 36) ? "✓" : "✗";
                if (subjectStatus === "✗") passStatus.push("F");

                row += `<td style="${subjectStatus === "✗" ? "background-color:#f8d7da;" : ""}">${w}</td>`;
            } else {
                passStatus.push("F");
                row += `<td>-</td>`;
            }
        });
  
        row += `<td>${s.attendance||"-"}</td><td>${s.total_working_days||"-"}</td><td>${totalMarksw}</td>
        <td class="${passStatus.includes("F") ? 'fail' : 'passed'}">${passStatus.includes("F") ? 'Fail' : 'Pass'}</td>
        <td>${s.rank||"-"}</td></tr>`;
        table += row;
    });
    table += "</tbody></table>";
    container.innerHTML = table;
}
