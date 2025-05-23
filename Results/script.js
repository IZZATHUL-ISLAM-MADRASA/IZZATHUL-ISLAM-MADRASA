// const apiUrl = "https://script.google.com/macros/s/AKfycbwmxklwEAhoW2E4cP2skLjFrfBLFgKkwN9UfPCcTAwY5aeX4PHA2TWfEWsqKhHFll9qTQ/exec";
const apiUrl = "https://script.google.com/macros/s/AKfycbyGCX_uEJaSMDQ1jSFH7svanwI6mY_Dkm7aPS1Gu0EFFY9JLmafHAlmY5hSIxr9QB7P2A/exec";
const online ="https://script.google.com/macros/s/AKfycbwXGHxq87nwa-vVAEObZgQpOqWLTM9JPBidk8aOX9N90VDoJ1q0TubVLUTpS0f1An0T/exec";

function fetchStudentData(event) {
    event.preventDefault();

    const admissionNumber = document.getElementById("admissionNumber").value.toUpperCase();
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
    let url = `${apiUrl}?admission_number=${admissionNumber}&class=${classInput}&division=${division}`;
    
        const firstTwoChars = admissionNumber.slice(0, 2).toUpperCase();
        if(admissionNumber==="ONUSTH@D"){
            url = `${online}?admission_number=""&action=get_class_marks&class=${classInput}&division=${division}`;
        
        }else if(admissionNumber==="USTH@D"){
            url = `${apiUrl}?action=get_class_marks&class=${classInput}&division=${division}`;
        
        }else if(firstTwoChars === "ON") {
           url = `${online}?admission_number=${admissionNumber}&class=${classInput}&division=${division}`;
            //url = `${online}?admission_number=""&action=get_class_marks&class=${classInput}&division=${division}`;
        }
    fetch(url)
        .then(response => response.json())
        .then(data => {
            loadingElement.style.display = "none";
             console.log(data);
            if (admissionNumber && admissionNumber.length >= 2) {
                if(admissionNumber==="ONUSTH@D"){
                    displayClasswiseResultBySubjectColumns(classInput,data);
                    return
                }else if(admissionNumber==="USTH@D"){
                    displayClasswiseResulOffline(classInput,data);
                    return
                }

                const firstTwoChars = admissionNumber.slice(0, 2).toUpperCase();
                if (firstTwoChars === "ON") {
                    displayOnlineResult(data);
                } else {
                    displayResult(data);
                }
              } else {
                // Handle the case where admissionNumber is not valid 
                console.warn("Invalid admission number:", admissionNumber);
                // You might want to display an error message or take other appropriate action
                //displayResult(data); // Or a default action
              }
              

            
        })
        .catch(error => {
            loadingElement.style.display = "none";
            document.getElementById("resltsection").style.display="block";
            resultElement.innerHTML = `<p class="error">Error fetching data. Please try again.</p>`;
            console.error(error);
        });
}


function validateForm(admissionNumber, classInput, division) {
    const allowedClasses = ["1", "2", "3", "4","5", "6","7", "8", "9","10", "11"];
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

function calculateGrade(max,marks) {
   // console.log(marks,"/",max);
   
    let percentage = (marks / max) * 100;
    let grade = "";
    if(max===0){
        
        return "A+";
    }else{
    if (percentage >= 95) {
        grade = "A+";
        }else if (percentage >= 90) {
            grade = "A";
            } else if (percentage >= 80) {
            grade = "B+";
            } else if (percentage >= 70) {
                grade = "B";
                } else if (percentage >= 60) {
                    grade = "C+";
                    } else if (percentage >= 50) {
                        grade = "C";
                        }else if (percentage >= 40) {
                            grade = "D+";
                            } else {
                            grade = "D";
                            }
                            return grade;
                            
}
}
function calculateGradeoff(max,marks) {
   // console.log(marks,"/",max);
   
    let percentage = (marks / max) * 100;
    let grade = "";
    if(max===0){
        
        return "A+";
    }else{
    if (percentage >= 95) {
        grade = "A+";
        }else if (percentage >= 90) {
            grade = "A";
            } else if (percentage >= 80) {
            grade = "B+";
            } else if (percentage >= 70) {
                grade = "B";
                } else if (percentage >= 60) {
                    grade = "C+";
                    } else if (percentage >= 50) {
                        grade = "C";
                        }else if (percentage >= 36) {
                            grade = "D+";
                            } else {
                            grade = "D";
                            }
                            return grade;
                            
}
}

async function displayResult(data) {
    document.getElementById("resltsection").style.display="block";
    const resultElement = document.getElementById("result");

    if (!data.student) {
        resultElement.innerHTML = `<p class="error">Student not found</p>`;
        return;
    }
    
    let totalMarks = 0;
    let obtainedMarks = 0;
    let allGrades = [];
const passingGrades = ["A+", "A", "B+", "B", "C+", "C", "D+"];
    let marksTable = `<h2>Exam Marks</h2>
        <table>
            <tr><th>Subject</th><th>Max Mark</th><th>Obtained Mark</th><th>Grade</th></tr>`;
        data.marks.forEach(mark => {
            const maxMark = parseInt(mark.max_mark)||50; // or mark.maxMark or mark.maxmark
            const obtained = parseInt(mark.obtained_mark);
            const grade = calculateGradeoff(maxMark,obtained);
            allGrades.push(grade);
        
            totalMarks += maxMark;
            obtainedMarks += obtained;
            
            marksTable += `<tr class=${passingGrades.includes(grade) ? "" : "faild"} >
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
    
    const isPassed = allGrades.every(grade => passingGrades.includes(grade));

    const studentInfo = await getstudentinfo(data,isPassed,totalMarks,obtainedMarks);
    // `
    //     <h2>Student Details</h2>
    //     <div class="student-basic">
    //         <p><strong>Name:</strong> ${data.student.name}</p>
    //         <p><strong>Class:</strong> ${data.student.class}</p>
    //         <p><strong>Division:</strong> ${data.student.division}</p>
    //     </div>
    //     <div class="student-stats">
    //     <p><strong>Status:</strong> <span class="status ${isPassed ? 'passed' : 'failed'}">${isPassed ? 'Passed' : 'Failed'}</span></p>
    //         <p><strong>Rank:</strong> ${data.student.rank}</p>
    //         <p><strong>Obtained Marks:</strong> ${obtainedMarks}</p>
    //         <p><strong>Total Marks:</strong> ${totalMarks}</p>
    //         <p><strong>Attendance:</strong> ${data.student.attendance}</p>
    //         <p><strong>Total Working Days:</strong> ${data.student.total_working_days}</p>
    //     </div>
    // `;

    resultElement.innerHTML = studentInfo + marksTable;
}

async function displayOnlineResult(data) {
    document.getElementById("resltsection").style.display="block";
    const resultElement = document.getElementById("result");

    if (!data.student) {
        resultElement.innerHTML = `<p class="error">Student not found</p>`;
        return;
    }
    document.getElementById("resltsection").style.display="block";
    let totalMarks = 0;
    let obtainedMarks = 0;
    let allGrades = [];
    const passingGrades = ["A+", "A", "B+", "B", "C+", "C", "D+"];
    let marksTable = `<h2>Exam Marks</h2>
        <table>
            <tr><th>Subject</th><th>Type</th><th>Max Mark</th><th>Obtained Mark</th><th>Grade</th></tr>`;
        data.marks.forEach(mark => {
            const maxMark = mark.subject==="VIVA"?100:mark.subject==="قرآن"?50:mark.subject==="حفظ"?50:data.student.class ===1?50:40;
            
            //parseInt(mark.max_mark)||40; // or mark.maxMark or mark.maxmark
            const maxMarkOmr = mark.subject==="VIVA"?0:mark.subject==="قرآن"?0:mark.subject==="حفظ"?0:data.student.class ===1?0:60;
            // or mark.maxMark or mark.maxmark
            const obtainedOmr = parseInt(mark.omr)||0; // or mark.obtainedMark or mark
            const obtained = parseInt(mark.written)||0;
            //const grade = calculateGrade(obtained+obtainedOmr);
            const gradeOMR = calculateGrade(maxMarkOmr,obtainedOmr);
            const gradeWRI = calculateGrade(maxMark,obtained);
            
            allGrades.push(gradeOMR);
            allGrades.push(gradeWRI);
        
            if(data.student.class===1||data.student.class==="1"){

                totalMarks += maxMark;
            //totalMarks += maxMarkOmr;
            obtainedMarks += obtained;
           // obtainedMarks += obtainedOmr;
           marksTable += `<tr style="border:1px solid black" class=${passingGrades.includes(gradeWRI) ? "" : "faild"}>
           <td>${mark.subject}</td>
           <td>WRITTEN</td>
           <td>${maxMark}</td>
           <td>${obtained}</td>
           <td>${gradeWRI}</td>
       </tr>`;
            }else if(mark.subject==="VIVA"||mark.subject==="قرآن"||mark.subject==="حفظ"){
                totalMarks += maxMark;
                obtainedMarks += obtained;

                marksTable += `<tr class=${passingGrades.includes(gradeWRI) ? "" : "faild"}>
                <td>${mark.subject}</td>
                <td>ORAL</td>

                <td>${maxMark}</td>
                <td>${obtained}</td>
                <td >${gradeWRI}</td>
            </tr>`;
            }else{
                totalMarks += maxMark;
                totalMarks += maxMarkOmr;
                obtainedMarks += obtained;
                obtainedMarks += obtainedOmr;
                    marksTable += `<tr rowspan=2 class=${passingGrades.includes(gradeWRI) ? "" : "faild"} >
                    <td rowspan="2" class="${passingGrades.includes(gradeWRI) ? "" : "faild"} ${passingGrades.includes(gradeOMR) ? "" : "faild"}" >${mark.subject}</td>
                    <td>WRITTEN</td>
                    <td>${maxMark}</td>
                <td>${obtained}</td>
                <td>${gradeWRI}</td>
                    
                </tr>
                <tr class=${passingGrades.includes(gradeOMR) ? "" : "faild"}>
                <td>MCQ</td>
                <td>${maxMarkOmr}</td>
                    <td>${obtainedOmr}</td>
                    <td>${gradeOMR}</td>
            
                </tr>
                `;
            }
            
        });

    marksTable += `</table>`;

    // Check if the student is passed (all grades should be D+ or above)
    
    const isPassed = allGrades.every(grade => passingGrades.includes(grade));

    const studentInfo =  await getstudentinfo(data,isPassed,totalMarks,obtainedMarks);
    resultElement.innerHTML = studentInfo + marksTable;
}

async function getstudentinfo(data,isPassed,totalMarks,obtainedMarks){
   // console.log("GETSTUDENSINFO",data);
    document.getElementById("resltsection").style.display="block";
   if (!data.student) {
    resultElement.innerHTML = `<p class="error">Student not found</p>`;
    document.getElementById("searchForm").style.display="block";
    return;
}
   document.getElementById("resltsection").style.display="block";
   document.getElementById("searchForm").style.display="none";
    const studentInfo = `
     <h2>Student Details</h2>
     
        <div class="student-basic">
            <p ><strong>Name:</strong><span style="color:#007bff;text-transform: uppercase; "> ${data.student.name}</span></p>
            <p><strong>Class:</strong> ${data.student.class} ${data.student.division}</p>
        </div>
        <div class="student-stats">
        <p><strong>Status:</strong> <span class="status ${isPassed ? 'passed' : 'failed'}">${isPassed ? 'Passed' : 'Failed'}</span></p>
            <p><strong>Rank:</strong> ${isPassed ? data.student.rank:"-"}</p>
            <p><strong>Obtained Marks:</strong> ${obtainedMarks}</p>
            <p><strong>Total Marks:</strong> ${totalMarks}</p>
            <p><strong>Attendance:</strong> ${data.student.attendance}</p>
            <p><strong>Total Working Days:</strong> ${data.student.total_working_days}</p>
        </div>
    `;
    return studentInfo;
    
}


function displayClasswiseResultBySubjectColumns(classInput,data) {
    document.getElementById("resltsection").style.display="block";
   document.getElementById("searchForm").style.display="none";
    const container = document.getElementById("result");
    container.innerHTML = data;
  
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p>No data available.</p>";
      return;
    }
  
    // 1. Get all unique subjects across all students
    const allSubjects = new Set();
    data.forEach(entry => {
      entry.marks.forEach(mark => {
        allSubjects.add(mark.subject);
      });
    });
    const subjectList = Array.from(allSubjects);
  
    // 2. Build header
    let table = `<table class="result-table"><thead><tr>
      <th>Sl</th>
      <th>Admission No</th>
      <th>Name</th>
      <th>Class-Div</th>`;
  
    subjectList.forEach(subject => {
      table += `<th>${subject}<br><small>(${classInput==="1"?50:40}/${classInput==="1"?"":(subject==="قرآن"||subject==="حفظ"||subject==="VIVA")?0:60})</small></th>`;
    });
  
    table += `
      <th>Attendance</th>
      <th>Total Days</th>
      <th>Total Marks</th>
      <th>Status</th>
      <th>Rank</th>
    </tr></thead><tbody>`;
  
    // 3. Rows per student
    let sl = 1;
    data.forEach(entry => {
      const s = entry.student;
      const classDiv = `${s.class || ""}${s.division || ""}`;
      const attendance = s.attendance || "-";
      const totalDays = s.total_working_days || "-";
      const rank = s.rank || "-";
  
      let totalMarksw = 0;
      let totalMarkso = 0;
      let passStatus = ["f"]
  
      let row = `<tr><td>${sl++}</td>
        <td>${s.admission_number}</td>
        <td>${s.name}</td>
        <td>${classDiv}</td>`;
  
      // Map subject data for quick access
      const markMap = {};
      entry.marks.forEach(mark => {
        markMap[mark.subject] = {
          written: Number(mark.written) || 0,
          omr: Number(mark.omr) || 0,
        };
      });
            function per(max,mark){
                   return max===0?90:(mark/max)*100;
            }
      subjectList.forEach(subject => {
        const mark = markMap[subject];
        if (mark) {
            const maxw = classInput==="1"?50:40;
            const maxo = classInput==="1"?0:(subject==="قرآن"||subject==="حفظ"||subject==="VIVA")?0:60;
          const w = mark.written;
          const o = mark.omr;
          const t = w + o;
          totalMarksw += w;
          totalMarkso += o;
          const pw = per(maxw,w);
          const po = per(maxo,o); 
          const subjectStatus = (pw >= 40 && po >=40) ? "✓" : "✗";
          
          if (subjectStatus === "✗") passStatus.push("F");
          row += `<td style=" ${subjectStatus==="✗"?"background-Color:rgb(253, 187, 187);":""}"><span class=${pw>=40?"":"failText"}>${w}</span>/<span class=${po>=40?"":"failText"}>${o}</span></td>`;
        } else {
          passStatus.push("F"); // subject missing is considered fail
          row += `<td>-</td>`;
        }
      });
  
      row += `
        <td>${attendance}</td>
        <td>${totalDays}</td>
        <td>${totalMarksw}/${totalMarkso}</td>
        <td class=${passStatus.includes("F") ? 'fail' : 'Pass'}>${passStatus.includes("F") ? 'Fail' : 'Pass'}</td>
        <td>${rank}</td>
      </tr>`;
      table += row;
    });
  
    table += "</tbody></table>";
    container.innerHTML = table;
  }
  
  function displayClasswiseResulOffline(classInput,data) {
      document.getElementById("resltsection").style.display="block";
   document.getElementById("searchForm").style.display="none";
    const container = document.getElementById("result");
    container.innerHTML = data;
  
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p>No data available.</p>";
      return;
    }
  
    // 1. Get all unique subjects across all students
    const allSubjects = new Set();
    data.forEach(entry => {
      entry.marks.forEach(mark => {
        allSubjects.add(mark.subject);
      });
    });
    const subjectList = Array.from(allSubjects);
    var subcount = 0;
    // 2. Build header
    let table = `<table class="result-table"><thead><tr>
      <th>Sl</th>
      <th>Admission No</th>
      <th>Name</th>
      <th>Class-Div</th>`;
  
    subjectList.forEach(subject => {
        subcount++
      table += `<th>${subject}<br><small>(${classInput==="1"?50:50})</small></th>`;
    });
  
    table += `
      <th>Attendance</th>
      <th>Total Days</th>
      <th>Total Marks ( ${subcount*50} )</th>
      <th>Status</th>
      <th>Rank</th>
    </tr></thead><tbody>`;
  
    // 3. Rows per student
    let sl = 1;
    data.forEach(entry => {
      const s = entry.student;
      const classDiv = `${s.class || ""}${s.division || ""}`;
      const attendance = s.attendance || "-";
      const totalDays = s.total_working_days || "-";
      const rank = s.rank || "-";
  
      let totalMarksw = 0;
      let totalMarkso = 0;
      let passStatus = ["f"]
  
      let row = `<tr><td>${sl++}</td>
        <td>${s.admission_number}</td>
        <td>${s.name}</td>
        <td>${classDiv}</td>`;
  
      // Map subject data for quick access
      const markMap = {};
      entry.marks.forEach(mark => {
        markMap[mark.subject] = {
          written: Number(mark.obtMark) || 0,
          omr: Number(mark.maxMark) || 0,
        };
      });
            function per(max,mark){
                   return max===0?90:(mark/max)*100;
            }
      subjectList.forEach(subject => {
        const mark = markMap[subject];
        if (mark) {
            const maxw = classInput==="1"?50:40;
            const maxo = classInput==="1"?0:(subject==="قرآن"||subject==="حفظ"||subject==="VIVA")?0:60;
          const w = mark.written;
          const o = mark.omr;
          const t = w + o;
          totalMarksw += w;
          totalMarkso += maxw;
          const pw = per(maxw,w);
          //const po = per(maxo,o); 
          const subjectStatus = (pw >= 36) ? "✓" : "✗";
          
          if (subjectStatus === "✗") passStatus.push("F");
          row += `<td style=" ${subjectStatus==="✗"?"background-Color:rgb(253, 187, 187);":""}"><span class=${pw>=36?"":"failText"}>${w}</span></td>`;
        } else {
          passStatus.push("F"); // subject missing is considered fail
          row += `<td>-</td>`;
        }
      });
  
      row += `
        <td>${attendance}</td>
        <td>${totalDays}</td>
        <td>${totalMarksw}</td>
        <td class=${passStatus.includes("F") ? 'fail' : 'Pass'}>${passStatus.includes("F") ? 'Fail' : 'Pass'}</td>
        <td>${rank}</td>
      </tr>`;
      table += row;
    });
  
    table += "</tbody></table>";
    container.innerHTML = table;
  }

 var data32 ={
    "student": {
        "admission_number": "ON24028",
        "name": "Muhammad Aman",
        "class": 3,
        "division": "A",
        "attendance": 150,
        "total_working_days": 165,
        "rank": 10,
        "total_subject": 9,
        "total_marks": 344
    },
    "marks": [
        {
            "subject": "الأخلاق",
            "omr": 24,
            "written": 8
        },
        {
            "subject": "العقيدة",
            "omr": 2,
            "written": 17
        },
        {
            "subject": "لسان القرآن",
            "omr": 26,
            "written": 30
        },
        {
            "subject": "التاريخ",
            "omr": 25,
            "written": 18
        },
        {
            "subject": "التجويد",
            "omr": 24,
            "written": 16
        },
        {
            "subject": "الفقه",
            "omr": 24,
            "written": 22
        },
        {
            "subject": "قرآن",
            "omr": "",
            "written": 25
        },
        {
            "subject": "حفظ",
            "omr": "",
            "written": 20
        },
        {
            "subject": "VIVA",
            "omr": "",
            "written": 40
        }
    ]
}
//displayOnlineResult(data32);
