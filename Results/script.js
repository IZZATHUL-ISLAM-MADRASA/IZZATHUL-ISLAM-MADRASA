// const apiUrl = "https://script.google.com/macros/s/AKfycbwmxklwEAhoW2E4cP2skLjFrfBLFgKkwN9UfPCcTAwY5aeX4PHA2TWfEWsqKhHFll9qTQ/exec";
const apiUrl = "https://script.google.com/macros/s/AKfycbyGCX_uEJaSMDQ1jSFH7svanwI6mY_Dkm7aPS1Gu0EFFY9JLmafHAlmY5hSIxr9QB7P2A/exec";

function fetchStudentData(event) {
    event.preventDefault();

    const admissionNumber = document.getElementById("admissionNumber").value;
    const classInput = document.getElementById("class").value;
    const division = document.getElementById("division").value;

    const loadingElement = document.getElementById("loading");
    const resultElement = document.getElementById("result");
    loadingElement.style.display = "block";
    resultElement.innerHTML = "";

    if (!validateForm(admissionNumber, classInput, division)) {
        loadingElement.style.display = "none";
        return;
    }

    const url = `${apiUrl}?admission_number=${admissionNumber}&class=${classInput}&division=${division}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            loadingElement.style.display = "none";
            displayResult(data);
        })
        .catch(error => {
            loadingElement.style.display = "none";
            resultElement.innerHTML = `<p class="error">Error fetching data. Please try again.</p>`;
            console.error(error);
        });
}

function validateForm(admissionNumber, classInput, division) {
    const allowedClasses = ["1", "2", "3", "4", "6", "8", "9", "11"];
    const allowedDivisions = ["A", "B"];

    if (admissionNumber <= 0) {
        alert("Admission Number must be a positive number.");
        return false;
    }

    if (!allowedClasses.includes(classInput)) {
        alert("Class must be one of the following: 1, 2, 3, 4, 6, 8, 9, 11.");
        return false;
    }

    if (!allowedDivisions.includes(division)) {
        alert("Division must be A or B.");
        return false;
    }

    return true;
}

function calculateGrade(marks) {
    if (marks >= 45) return "A+";
    if (marks >= 40) return "A";
    if (marks >= 35) return "B+";
    if (marks >= 30) return "B";
    if (marks >= 25) return "C+";
    if (marks >= 20) return "C";
    if (marks >= 18) return "D+";
    return "D";
}

function displayResult(data) {
    const resultElement = document.getElementById("result");

    if (!data.student) {
        resultElement.innerHTML = `<p class="error">Student not found</p>`;
        return;
    }
    
    let totalMarks = 0;
    let obtainedMarks = 0;
    let allGrades = [];

    let marksTable = `<h2>Exam Marks</h2>
        <table>
            <tr><th>Subject</th><th>Max Mark</th><th>Obtained Mark</th><th>Grade</th></tr>`;
        data.marks.forEach(mark => {
            const maxMark = parseInt(mark.max_mark); // or mark.maxMark or mark.maxmark
            const obtained = parseInt(mark.obtained_mark);
            const grade = calculateGrade(obtained);
            allGrades.push(grade);
        
            totalMarks += maxMark;
            obtainedMarks += obtained;
        
            marksTable += `<tr>
                <td>${mark.subject}</td>
                <td>${maxMark}</td>
                <td>${obtained}</td>
                <td>${grade}</td>
            </tr>`;
        });

//     data.marks.forEach(mark => {
//     const maxMark = parseInt(mark.max_mark); // or mark.maxMark or mark.maxmark
//     const obtained = parseInt(mark.obtained_mark);
//     const grade = calculateGrade(obtained);
//     allGrades.push(grade);

//     totalMarks += maxMark;
//     obtainedMarks += obtained;

//     marksTable += `<tr>
//         <td>${mark.subject}</td>
//         <td>${maxMark}</td>
//         <td>${obtained}</td>
//         <td>${grade}</td>
//     </tr>`;
// });

    marksTable += `</table>`;

    // Check if the student is passed (all grades should be D+ or above)
    const passingGrades = ["A+", "A", "B+", "B", "C+", "C", "D+"];
    const isPassed = allGrades.every(grade => passingGrades.includes(grade));

    const studentInfo = `
        <h2>Student Details</h2>
        <div class="student-basic">
            <p><strong>Name:</strong> ${data.student.name}</p>
            <p><strong>Class:</strong> ${data.student.class}</p>
            <p><strong>Division:</strong> ${data.student.division}</p>
        </div>
        <div class="student-stats">
        <p><strong>Status:</strong> <span class="status ${isPassed ? 'passed' : 'failed'}">${isPassed ? 'Passed' : 'Failed'}</span></p>
            <p><strong>Rank:</strong> ${data.student.rank}</p>
            <p><strong>Obtained Marks:</strong> ${obtainedMarks}</p>
            <p><strong>Total Marks:</strong> ${totalMarks}</p>
            <p><strong>Attendance:</strong> ${data.student.attendance}</p>
            <p><strong>Total Working Days:</strong> ${data.student.total_working_days}</p>
        </div>
    `;

    resultElement.innerHTML = studentInfo + marksTable;
}
