/**
 * app.js - Advanced Timetable, Exam & Substitution Engine
 * Version: Ultimate Master Build + Human-Machine Editor + Master Sheet Optimizer
 */

const APP_CONFIG = {
    fullName: "AGMHSS PATTEESWARAM", 
    shortName: "AGMHSS PSW",                                           
    scriptUrl: "https://script.google.com/macros/s/AKfycbz1lQXlw5mIxgZPZzRrGFpkFiZBmLBTm7fE_mH-P9iy7oaFtsh0I-XGo527fzyz1xe0/exec" 
};
const SCRIPT_URL = APP_CONFIG.scriptUrl;

// --- Global Trackers ---
let generatedWeeklyTimetable = [];
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
let currentSession = 'FN'; 
window.examDutyTracker = window.examDutyTracker || {};
window.subDutyTracker = window.subDutyTracker || {};
window.teacherWorkload = {}; 
window.teacherLevels = {}; 
window.teacherMaxGrade = {};
window.dailyExamTracker = {}; 
window.teacherPartTimeStatus = {};

window.rawAssignmentsData = null;
window.rawTrackerData = null;

// 🌟 Collaborative Editing Trackers
window.isEditMode = false;
window.swapSource = null;

function updateStatus(msg) {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) indicator.innerText = msg;
}

// =========================================================
// 🌟 GLOBAL HELPERS
// =========================================================
function getGradeValue(clsStr) {
    let match = String(clsStr).toUpperCase().match(/^(\d+|LKG|UKG)/);
    if (!match) return -1;
    if (match[1] === 'LKG' || match[1] === 'UKG') return 0;
    return parseInt(match[1]);
}

function getTeacherCategory(gradeVal) {
    if (gradeVal === -1) return 'Unknown';
    if (gradeVal <= 5) return 'Primary';
    if (gradeVal <= 10) return 'High School';
    return 'Hr. Secondary';
}

function getIndividualClasses(classNameStr) {
    if (!classNameStr) return [];
    let result = [];
    let groups = String(classNameStr).split(',');
    groups.forEach(group => {
        let parts = group.trim().split('-');
        if (parts.length < 2) {
            if(group.trim()) result.push(group.trim());
            return;
        }
        let grade = parts[0].trim();
        let sections = parts[1].split(/[&]/); 
        sections.forEach(sec => {
            if(sec.trim()) result.push(`${grade}-${sec.trim()}`);
        });
    });
    return result;
}

function isPartTimeTeacherAvailable(teacherName, sessionType) {
    let tName = String(teacherName).replace('⭐ ', '').trim();
    let status = window.teacherPartTimeStatus[tName] || 'FULL';
    if (status === 'MORNING' && sessionType === 'AN') return false; 
    if (status === 'AFTERNOON' && sessionType === 'FN') return false; 
    return true; 
}

function abbreviateSubject(sub) {
    if (!sub) return "-";
    let s = sub.toUpperCase().trim();
    if (s.includes('COMMERCE') || s.includes('ACCOUNTANCY')) return 'COM/ACC';
    if (s.includes('ECONOMICS')) return 'ECO';
    if (s.includes('CHEMISTRY')) return 'CHEM';
    if (s.includes('PHYSICS')) return 'PHY';
    if (s.includes('BIOLOGY')) return 'BIO';
    if (s.includes('COMPUTER')) return 'CSC';
    if (s.includes('HISTORY')) return 'HIST';
    if (s.includes('SOCIAL')) return 'SOC.SCI';
    if (s.includes('SCIENCE')) return 'SCI';
    if (s.includes('ENGLISH')) return 'ENG';
    if (s.includes('MATHS')) return 'MAT';
    if (s.includes('DRAWING')) return 'DRAW';
    if (s.includes('TAMIL')) return 'TAM';
    return s.length > 8 ? s.substring(0, 8) + '.' : s;
}

// --- UI EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    document.title = `${APP_CONFIG.shortName} - Timetable Engine`;
    const headerDisplay = document.getElementById('schoolNameDisplay');
    if(headerDisplay) headerDisplay.innerText = APP_CONFIG.fullName;

    const viewType = document.getElementById('viewType');
    const viewFilter = document.getElementById('viewFilter');
    const opMode = document.getElementById('opMode');
    const examGroup = document.getElementById('examPatternGroup');
    const subGroup = document.getElementById('substituteGroup');
    const dailyTools = document.getElementById('dailyToolsGroup');

    const dateInput = document.getElementById('workDate');
    if(dateInput) dateInput.valueAsDate = new Date();

    if(opMode) {
        opMode.addEventListener('change', (e) => {
            if(examGroup) examGroup.classList.add('hidden');
            if(subGroup) subGroup.classList.add('hidden');
            if(dailyTools) dailyTools.classList.add('hidden');
            if (e.target.value === 'exam') {
                if(examGroup) examGroup.classList.remove('hidden');
                if(dailyTools) dailyTools.classList.remove('hidden'); 
            }
            if (e.target.value === 'substitution') {
                if(subGroup) subGroup.classList.remove('hidden');
                if(dailyTools) dailyTools.classList.remove('hidden'); 
            }
        });
    }

    if(viewType && viewFilter) {
        viewType.addEventListener('change', (e) => {
            viewFilter.innerHTML = ''; 
            let options = new Set();
            if (e.target.value === 'class') {
                viewFilter.classList.remove('hidden');
                generatedWeeklyTimetable.forEach(slot => {
                    getIndividualClasses(slot.className).forEach(c => options.add(c));
                });
            } else if (e.target.value === 'teacher') {
                viewFilter.classList.remove('hidden');
                generatedWeeklyTimetable.forEach(slot => options.add(slot.teacherName.replace('⭐ ', '')));
            } else {
                viewFilter.classList.add('hidden');
            }
            Array.from(options).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(opt => {
                viewFilter.innerHTML += `<option value="${opt}">${opt}</option>`;
            });
            
            if (document.getElementById('opMode').value === 'regular') window.generateGrid(true);
        });

        viewFilter.addEventListener('change', () => {
            if (document.getElementById('opMode').value === 'regular') window.generateGrid(true);
        });
    }

    const sessionBtns = document.querySelectorAll('#btnFN, #btnAN');
    sessionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            sessionBtns.forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-blue-700', 'font-bold'));
            sessionBtns.forEach(b => b.classList.add('text-gray-500', 'hover:bg-gray-200'));
            e.target.classList.remove('text-gray-500', 'hover:bg-gray-200');
            e.target.classList.add('bg-white', 'shadow-sm', 'text-blue-700', 'font-bold');
            currentSession = e.target.id.replace('btn', '');
            if (document.getElementById('opMode').value === 'exam') window.generateGrid(false);
        });
    });
});

function getSelectedDateStr() {
    const dateVal = document.getElementById('workDate')?.value;
    if (!dateVal) return "N/A";
    const d = new Date(dateVal);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

window.generateGrid = function(isEngineCall = false) {
    const mode = document.getElementById('opMode').value;
    
    if (isEngineCall !== true && mode === 'regular' && window.rawAssignmentsData) {
        window.runCalculationEngine(true);
        return;
    }

    if (mode === 'regular') renderRegularTimetable();
    else if (mode === 'exam') renderExamSchedule();
    else if (mode === 'substitution') renderSubstituteSchedule();
};

function updateClassLoadUI() {
    const loadStatusDiv = document.getElementById('loadStatus');
    if (!loadStatusDiv) return;

    let classCounts = {};
    generatedWeeklyTimetable.forEach(slot => {
        let indClasses = getIndividualClasses(slot.className);
        indClasses.forEach(cls => {
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        });
    });

    let allUniqueClasses = new Set();
    SCHOOL_CONFIG.assignments.forEach(req => {
        getIndividualClasses(req.className).forEach(cls => allUniqueClasses.add(cls));
    });
    
    Object.keys(classCounts).forEach(cls => allUniqueClasses.add(cls));

    let html = '<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 w-full">';
    
    Array.from(allUniqueClasses).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(cls => {
        let count = classCounts[cls] || 0;
        let percentage = Math.min((count / 40) * 100, 100);
        let statusColor = count === 40 ? 'bg-green-500' : (count > 40 ? 'bg-red-500' : 'bg-blue-500');
        
        html += `
            <div class="bg-gray-50 p-2 rounded border border-gray-200">
                <div class="flex justify-between text-[10px] font-bold text-gray-700 mb-1">
                    <span>${cls}</span>
                    <span>${count}/40</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                    <div class="${statusColor} h-1.5 rounded-full" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    loadStatusDiv.innerHTML = html || '<span class="text-gray-400 text-xs">No active classes monitored.</span>';
}

function generateAutoTimetable() {
    generatedWeeklyTimetable = []; 
    let teacherAvail = {};
    let classAvail = {};
    let dailySubjectCount = {}; 

    if (!SCHOOL_CONFIG.assignments || SCHOOL_CONFIG.assignments.length === 0) return;

    SCHOOL_CONFIG.assignments.sort((a, b) => {
        let isPartTimeA = window.teacherPartTimeStatus[a.teacherName] !== 'FULL' ? 1 : 0;
        let isPartTimeB = window.teacherPartTimeStatus[b.teacherName] !== 'FULL' ? 1 : 0;
        if (isPartTimeA !== isPartTimeB) return isPartTimeB - isPartTimeA; 
        return b.periodsPerWeek - a.periodsPerWeek;
    });

    const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class');
    const firstPeriod = teachingPeriods[0];
    const fnPeriodLabels = teachingPeriods.slice(0, 4).map(p => p.label);

    function attemptPlacement(req, reqIndex, allowLimitBypass) {
        let indClasses = getIndividualClasses(req.className);
        let maxDailyAllowed = Math.max(1, Math.ceil(req.periodsPerWeek / 5));
        let placedCount = 0;
        let startDayIdx = reqIndex % 5; 

        for (let i = 0; i < req.periodsPerWeek; i++) {
            if (req.assignedCount >= req.periodsPerWeek) break; 

            let placed = false;
            for (let offset = 0; offset < daysOfWeek.length; offset++) {
                let day = daysOfWeek[(startDayIdx + offset + i) % 5];
                let currentDayCount = dailySubjectCount[`${req.className}-${day}-${req.subjectName}`] || 0;
                
                if (!allowLimitBypass && currentDayCount >= maxDailyAllowed) continue; 

                for (let period of teachingPeriods) {
                    if (!req.isClassTeacher && period.label === firstPeriod.label) continue; 

                    let isFN = fnPeriodLabels.includes(period.label);
                    let sessionType = isFN ? 'FN' : 'AN';

                    if (!isPartTimeTeacherAvailable(req.teacherName, sessionType)) continue;

                    let timeKey = `${day}-${period.label}`;
                    let isClassBusy = indClasses.some(cls => classAvail[cls]?.[timeKey]);
                    let isTeacherBusy = teacherAvail[req.teacherName]?.[timeKey];
                    
                    if (!isTeacherBusy && !isClassBusy) {
                        generatedWeeklyTimetable.push({
                            day: day, period: period.label, time: `${period.start} - ${period.end}`,
                            className: req.className, subjectName: req.subjectName, teacherName: req.teacherName
                        });
                        
                        if(!teacherAvail[req.teacherName]) teacherAvail[req.teacherName] = {};
                        teacherAvail[req.teacherName][timeKey] = true;
                        
                        indClasses.forEach(cls => {
                            if(!classAvail[cls]) classAvail[cls] = {};
                            classAvail[cls][timeKey] = true;
                        });
                        
                        dailySubjectCount[`${req.className}-${day}-${req.subjectName}`] = currentDayCount + 1;
                        req.assignedCount++;
                        placedCount++;
                        placed = true;
                        break; 
                    }
                }
                if (placed) break; 
            }
        }
        return placedCount;
    }

    SCHOOL_CONFIG.assignments.forEach(req => req.assignedCount = 0);
    SCHOOL_CONFIG.assignments.forEach((req, reqIndex) => attemptPlacement(req, reqIndex, false));
    SCHOOL_CONFIG.assignments.forEach((req, reqIndex) => {
        if (req.assignedCount < req.periodsPerWeek) attemptPlacement(req, reqIndex, true);
    });

    updateClassLoadUI();
}

// =========================================================
// 🌟 NEW: SHEET OPTIMIZER & AUDIT TOOL
// =========================================================
window.openOptimizerModal = function() {
    if (!SCHOOL_CONFIG.assignments || SCHOOL_CONFIG.assignments.length === 0) {
        alert("Please Sync Data first to generate an audit report.");
        return;
    }

    let classData = {};
    
    // Group assignments by class to find totals
    SCHOOL_CONFIG.assignments.forEach(req => {
        let indClasses = getIndividualClasses(req.className);
        indClasses.forEach(cls => {
            if (!classData[cls]) classData[cls] = { total: 0, subjects: {} };
            classData[cls].total += req.periodsPerWeek;
            
            // Track specific subjects to give intelligent recommendations
            let subLabel = abbreviateSubject(req.subjectName);
            classData[cls].subjects[subLabel] = (classData[cls].subjects[subLabel] || 0) + req.periodsPerWeek;
        });
    });

    let sortedClasses = Object.keys(classData).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    let reportHtml = '';
    let perfectCount = 0;

    sortedClasses.forEach(cls => {
        let data = classData[cls];
        
        if (data.total === 40) {
            perfectCount++;
            reportHtml += `
                <div class="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center shadow-sm">
                    <span class="font-bold text-green-800 text-lg">${cls}</span>
                    <span class="text-xs font-black bg-green-200 text-green-900 px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> PERFECT 40/40</span>
                </div>`;
        } else if (data.total < 40) {
            let def = 40 - data.total;
            let sug = [];
            
            // Intelligent suggestions based on typical missing co-curriculars
            if (!data.subjects['LIB'] && !data.subjects['LIBRARY']) sug.push('Library (LIB)');
            if (!data.subjects['PET'] && !data.subjects['GAMES']) sug.push('Physical Ed (PET)');
            if (!data.subjects['DRAW']) sug.push('Drawing (DRAW)');
            if (!data.subjects['VE'] && !data.subjects['CO']) sug.push('Value Ed (VE) / Co-curricular (CO)');
            
            let extraText = sug.length > 0 
                ? `<div class="mt-2 pt-2 border-t border-red-200"><span class="text-xs text-red-700 block"><b class="uppercase tracking-wider">💡 Suggestions:</b> Try adding periods for: ${sug.join(', ')}</span></div>` 
                : '';

            reportHtml += `
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-red-800 text-lg">${cls}</span>
                        <span class="text-xs font-black bg-red-200 text-red-900 px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> SHORTAGE: ${data.total}/40</span>
                    </div>
                    <div class="text-sm text-red-700 mt-2 font-medium">📉 Action: Add <b class="text-red-900 bg-red-200 px-1 rounded">+${def}</b> more periods for this class in the Master Sheet.</div>
                    ${extraText}
                </div>`;
        } else {
            let exc = data.total - 40;
            reportHtml += `
                <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-yellow-800 text-lg">${cls}</span>
                        <span class="text-xs font-black bg-yellow-200 text-yellow-900 px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="alert-octagon" class="w-3 h-3"></i> EXCESS: ${data.total}/40</span>
                    </div>
                    <div class="text-sm text-yellow-800 mt-2 font-medium">📈 Action: Overloaded! Reduce <b class="text-yellow-900 bg-yellow-200 px-1 rounded">-${exc}</b> periods in the Master Sheet.</div>
                </div>`;
        }
    });

    document.getElementById('optimizerContent').innerHTML = reportHtml;
    
    let summaryColor = perfectCount === sortedClasses.length ? "text-green-700" : "text-indigo-900";
    document.getElementById('optimizerSummary').innerHTML = `<span class="${summaryColor}"><b class="text-lg">${perfectCount}</b> out of <b>${sortedClasses.length}</b> classes are perfectly balanced.</span>`;
    
    document.getElementById('optimizerModal').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
};

window.closeOptimizerModal = function() {
    document.getElementById('optimizerModal').classList.add('hidden');
};

// =========================================================
// 🌟 INTERACTIVE EDITING LOGIC (SWAP & DIRECT TEXT EDIT)
// =========================================================
window.toggleEditMode = function() {
    window.isEditMode = !window.isEditMode;
    window.swapSource = null; 
    renderRegularTimetable(); 
    updateStatus(window.isEditMode ? "EDIT MODE: Click to Swap | Dbl-Click to Type" : "GRID LOCKED");
};

window.handleCellClick = function(day, period) {
    if (!window.isEditMode) return;
    
    if (!window.swapSource) {
        window.swapSource = { day, period };
        renderRegularTimetable(); 
    } else {
        let target = { day, period };
        
        if (window.swapSource.day === target.day && window.swapSource.period === target.period) {
            window.swapSource = null;
            renderRegularTimetable();
            return;
        }

        let viewType = document.getElementById('viewType')?.value;
        let filterVal = document.getElementById('viewFilter')?.value;

        let slot1Index = generatedWeeklyTimetable.findIndex(d => 
            d.day === window.swapSource.day && d.period === window.swapSource.period &&
            (viewType === 'teacher' ? d.teacherName.replace('⭐ ', '') === filterVal : getIndividualClasses(d.className).includes(filterVal))
        );
        
        let slot2Index = generatedWeeklyTimetable.findIndex(d => 
            d.day === target.day && d.period === target.period &&
            (viewType === 'teacher' ? d.teacherName.replace('⭐ ', '') === filterVal : getIndividualClasses(d.className).includes(filterVal))
        );

        if (slot1Index !== -1) {
            generatedWeeklyTimetable[slot1Index].day = target.day;
            generatedWeeklyTimetable[slot1Index].period = target.period;
        }
        if (slot2Index !== -1) {
            generatedWeeklyTimetable[slot2Index].day = window.swapSource.day;
            generatedWeeklyTimetable[slot2Index].period = window.swapSource.period;
        }

        window.swapSource = null; 
        renderRegularTimetable(); 
    }
};

window.openEditModal = function(event, day, period) {
    if(event) event.stopPropagation(); 
    
    let viewType = document.getElementById('viewType')?.value;
    let filterVal = document.getElementById('viewFilter')?.value;
    
    let slotIndex = generatedWeeklyTimetable.findIndex(d => 
        d.day === day && d.period === period &&
        (viewType === 'teacher' ? d.teacherName.replace('⭐ ', '') === filterVal : getIndividualClasses(d.className).includes(filterVal))
    );

    document.getElementById('editDay').value = day;
    document.getElementById('editPeriod').value = period;

    if (slotIndex !== -1) {
        let slot = generatedWeeklyTimetable[slotIndex];
        document.getElementById('editClass').value = slot.className;
        document.getElementById('editSubject').value = slot.subjectName;
        document.getElementById('editTeacher').value = slot.teacherName.replace('⭐ ', '');
    } else {
        document.getElementById('editClass').value = viewType === 'class' ? filterVal : '';
        document.getElementById('editSubject').value = '';
        document.getElementById('editTeacher').value = viewType === 'teacher' ? filterVal : '';
    }

    document.getElementById('editModal').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
};

window.closeEditModal = function() {
    document.getElementById('editModal').classList.add('hidden');
};

window.saveCellEdit = function() {
    let day = document.getElementById('editDay').value;
    let period = document.getElementById('editPeriod').value;
    let cls = document.getElementById('editClass').value;
    let sub = document.getElementById('editSubject').value.toUpperCase();
    let teacher = document.getElementById('editTeacher').value;

    let viewType = document.getElementById('viewType')?.value;
    let filterVal = document.getElementById('viewFilter')?.value;

    let slotIndex = generatedWeeklyTimetable.findIndex(d => 
        d.day === day && d.period === period &&
        (viewType === 'teacher' ? d.teacherName.replace('⭐ ', '') === filterVal : getIndividualClasses(d.className).includes(filterVal))
    );

    if (slotIndex !== -1) {
        if(cls && sub && teacher) {
            generatedWeeklyTimetable[slotIndex].className = cls;
            generatedWeeklyTimetable[slotIndex].subjectName = sub;
            generatedWeeklyTimetable[slotIndex].teacherName = teacher;
        } else {
            generatedWeeklyTimetable.splice(slotIndex, 1);
        }
    } else {
        if(cls && sub && teacher) {
            generatedWeeklyTimetable.push({
                day: day, period: period, time: "Manually Added",
                className: cls, subjectName: sub, teacherName: teacher
            });
        }
    }

    closeEditModal();
    window.swapSource = null; 
    renderRegularTimetable();
    updateClassLoadUI(); 
};

window.deleteCellData = function() {
    let day = document.getElementById('editDay').value;
    let period = document.getElementById('editPeriod').value;
    let viewType = document.getElementById('viewType')?.value;
    let filterVal = document.getElementById('viewFilter')?.value;

    let slotIndex = generatedWeeklyTimetable.findIndex(d => 
        d.day === day && d.period === period &&
        (viewType === 'teacher' ? d.teacherName.replace('⭐ ', '') === filterVal : getIndividualClasses(d.className).includes(filterVal))
    );

    if (slotIndex !== -1) {
        generatedWeeklyTimetable.splice(slotIndex, 1);
    }

    closeEditModal();
    window.swapSource = null;
    renderRegularTimetable();
    updateClassLoadUI(); 
}

// --- RENDER 1: REGULAR TIMETABLE (UPDATED WITH EDIT UI) ---
function renderRegularTimetable() {
    const mainGrid = document.getElementById('mainGrid');
    const viewType = document.getElementById('viewType')?.value || 'all';
    const filterVal = document.getElementById('viewFilter')?.value || '';

    if (generatedWeeklyTimetable.length === 0) {
        mainGrid.innerHTML = `<div class="text-red-500 font-bold p-4">No data generated. Click Sync Data first!</div>`;
        return;
    }

    if (viewType === 'all') {
        mainGrid.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-500 py-20">
            <i data-lucide="grid" class="w-12 h-12 mb-2 opacity-30"></i>
            <p class="text-lg">Please select <b>By Class</b> or <b>By Teacher</b> to view the Grid.</p>
        </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class');
    
    let btnText = window.isEditMode ? "🔒 Lock Grid (Save Changes)" : "✏️ Enable Edit Mode";
    let btnClass = window.isEditMode ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200";
    
    let html = `<div class="mb-4 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h3 class="font-black text-xl text-blue-900">${filterVal}</h3>
                    <button onclick="toggleEditMode()" class="px-5 py-2 border rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${btnClass}">${btnText}</button>
                </div>
                <div class="overflow-x-auto pb-4"><table id="scheduleTable" class="w-full text-center border-collapse min-w-[800px] bg-white text-sm shadow-sm rounded-lg overflow-hidden"><thead class="bg-blue-100 text-blue-900"><tr><th class="p-3 border border-blue-200 text-left w-24">Day</th>`;
    
    teachingPeriods.forEach((p, index) => { html += `<th class="p-3 border border-blue-200"><div class="font-bold text-lg">${index + 1}</div></th>`; });
    html += `</tr></thead><tbody>`;

    let displayData = [];
    if (viewType === 'class') {
        displayData = generatedWeeklyTimetable.filter(d => getIndividualClasses(d.className).includes(filterVal));
    } else if (viewType === 'teacher') {
        displayData = generatedWeeklyTimetable.filter(d => d.teacherName.replace('⭐ ', '') === filterVal);
    }

    daysOfWeek.forEach(day => {
        html += `<tr><td class="p-3 border border-gray-200 font-bold text-gray-700 bg-gray-50 text-left">${day}</td>`;
        teachingPeriods.forEach(period => {
            let slot = displayData.find(d => d.day === day && d.period === period.label);
            
            let isSourceCell = window.swapSource && window.swapSource.day === day && window.swapSource.period === period.label;
            let cursorClass = window.isEditMode ? "cursor-pointer hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-400 z-10" : "";
            let cellBgClass = isSourceCell ? "bg-yellow-200 ring-2 ring-yellow-500 shadow-inner" : (slot ? "hover:bg-blue-50" : "bg-gray-50/30 text-gray-300");
            
            let clickEvent = `onclick="handleCellClick('${day}', '${period.label}')"`;
            let dblClickEvent = window.isEditMode ? `ondblclick="openEditModal(event, '${day}', '${period.label}')"` : "";

            let editBtnHtml = isSourceCell ? `<button onclick="openEditModal(event, '${day}', '${period.label}')" class="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1.5 shadow-lg hover:bg-blue-700 border-2 border-white z-50 transform hover:scale-110 transition-transform" title="Type Text"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>` : '';

            if (slot) {
                let cellText = viewType === 'class' 
                    ? `<span class="font-semibold text-gray-800">${abbreviateSubject(slot.subjectName)}</span><br><span class="text-xs text-blue-600 font-bold">${slot.teacherName.replace('⭐ ', '')}</span>`
                    : `<span class="font-bold text-green-700">${slot.className.replace(/\s+/g, '')}</span><br><span class="text-xs text-gray-600">${abbreviateSubject(slot.subjectName)}</span>`;
                html += `<td ${clickEvent} ${dblClickEvent} class="p-2 border border-gray-200 transition-all align-middle leading-tight relative ${cursorClass} ${cellBgClass}">
                            ${editBtnHtml}
                            ${cellText}
                         </td>`;
            } else {
                let cellText = window.isEditMode && isSourceCell ? `<span class="text-[10px] font-bold text-yellow-800">Swap here?</span>` : `-`;
                html += `<td ${clickEvent} ${dblClickEvent} class="p-2 border border-gray-200 relative ${cursorClass} ${cellBgClass}">
                            ${editBtnHtml}
                            ${cellText}
                         </td>`;
            }
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    mainGrid.innerHTML = html;
}

// ... [EXAM AND SUBSTITUTION RENDER FUNCTIONS REMAIN THE SAME] ...
function renderExamSchedule() {
    const pattern = document.getElementById('patternSelect').value;
    const activeGrades = SCHOOL_CONFIG.examPatterns[pattern][currentSession];
    const examData = SCHOOL_CONFIG.examSettings[currentSession];
    const mainGrid = document.getElementById('mainGrid');
    const selectedDate = getSelectedDateStr();

    if (!window.dailyExamTracker[selectedDate]) {
        window.dailyExamTracker[selectedDate] = { FN: [], AN: [] };
    }
    window.dailyExamTracker[selectedDate][currentSession] = [];
    const oppositeSession = currentSession === 'FN' ? 'AN' : 'FN';
    const busyInOtherSession = window.dailyExamTracker[selectedDate][oppositeSession];

    const absentCheckboxes = document.querySelectorAll('.absent-chk:checked');
    const absentTeachers = Array.from(absentCheckboxes).map(cb => cb.value);

    let teacherProfiles = {};
    if (SCHOOL_CONFIG.assignments && SCHOOL_CONFIG.assignments.length > 0) {
        SCHOOL_CONFIG.assignments.forEach(req => {
            let name = req.teacherName.replace('⭐ ', '');
            if (!teacherProfiles[name]) {
                teacherProfiles[name] = { subjects: new Set() };
            }
            teacherProfiles[name].subjects.add(req.subjectName);
        });
    }

    let allTeachers = Object.keys(teacherProfiles);
    if (allTeachers.length === 0) return;

    let presentTeachers = allTeachers.filter(t => 
        !absentTeachers.includes(t) && 
        !busyInOtherSession.includes(t) &&
        isPartTimeTeacherAvailable(t, currentSession) 
    );

    if (presentTeachers.length === 0) {
        mainGrid.innerHTML = `<div class="text-red-500 font-bold p-4">அனைத்து ஆசிரியர்களும் விடுப்பிலோ அல்லது மாற்று செஷன் டியூட்டியிலோ உள்ளனர்!</div>`;
        return;
    }

    let html = `<div id="examContainer" class="space-y-6">
        <div class="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-2">
            <div>
                <h3 class="font-bold text-orange-900 text-lg">Session: ${currentSession === 'FN' ? 'Morning' : 'Afternoon'}</h3>
                <p class="text-sm text-orange-800 font-medium mt-1"><i data-lucide="calendar" class="w-4 h-4 inline-block mr-1"></i>Date: ${selectedDate}</p>
            </div>
            <div class="text-sm bg-orange-200 text-orange-900 px-3 py-1 rounded font-bold">Starts @ ${examData.writingStart}</div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

    let tempExamTracker = { ...window.examDutyTracker };

    activeGrades.forEach((grade, index) => {
        const isJunior = grade <= 8;
        const finishTime = isJunior ? examData.juniorEnd : examData.seniorEnd;
        
        let examGradeVal = getGradeValue(grade);
        let examCategory = getTeacherCategory(examGradeVal);

        let eligibleTeachers = presentTeachers.filter(t => !teacherProfiles[t].subjects.has("English")); 
        if (eligibleTeachers.length === 0) eligibleTeachers = presentTeachers; 
        
        let levelMatchedTeachers = eligibleTeachers.filter(t => window.teacherLevels[t] === examCategory);
        if (levelMatchedTeachers.length > 0) {
            eligibleTeachers = levelMatchedTeachers; 
        }
        
        eligibleTeachers.sort((a, b) => {
            let examA = tempExamTracker[a] || 0;
            let examB = tempExamTracker[b] || 0;
            if (examA !== examB) return examA - examB; 
            let loadA = window.teacherWorkload[a] || 0;
            let loadB = window.teacherWorkload[b] || 0;
            return loadA - loadB;
        });
        
        let dutyTeacher = eligibleTeachers[0];

        window.dailyExamTracker[selectedDate][currentSession].push(dutyTeacher);
        presentTeachers = presentTeachers.filter(t => t !== dutyTeacher);
        
        let teacherCat = window.teacherLevels[dutyTeacher];
        tempExamTracker[dutyTeacher] = (tempExamTracker[dutyTeacher] || 0) + 1;
        let teacherLoad = window.teacherWorkload[dutyTeacher] || 0;

        html += `
            <div class="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-400 transition-all relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 ${isJunior ? 'bg-green-400' : 'bg-blue-500'}"></div>
                <div class="flex justify-between items-start mb-4 mt-1">
                    <div><h4 class="text-2xl font-black text-gray-800">Class ${grade}</h4><span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">${examCategory} Hall</span></div>
                    <span class="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-bold border border-gray-200">Hall ${index + 1}</span>
                </div>
                <div class="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div class="flex justify-between text-sm"><span class="text-gray-500">Duration:</span><span class="font-bold text-gray-700">${isJunior ? '2.5 Hrs' : '3.0 Hrs'}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-gray-500">Ends at:</span><span class="font-bold ${isJunior ? 'text-green-600' : 'text-blue-600'}">${finishTime}</span></div>
                </div>
                <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invigilator Duty</span>
                        <span class="text-base font-bold text-blue-700 flex items-center gap-1"><i data-lucide="user-check" class="w-4 h-4"></i> ${dutyTeacher} <span class="text-[10px] font-normal text-gray-400 bg-gray-100 px-1 rounded">${teacherCat}</span></span>
                    </div>
                    <div class="text-right flex flex-col">
                        <span class="text-[10px] font-bold text-gray-400 uppercase">Regular Load</span>
                        <span class="text-sm font-black text-gray-600">${teacherLoad} Per.</span>
                    </div>
                </div>
            </div>`;
    });

    html += `</div></div>`;
    mainGrid.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    updateStatus("Exam Schedule Loaded");
}

function renderSubstituteSchedule() {
    const mainGrid = document.getElementById('mainGrid');
    const day = document.getElementById('subDay').value;
    const selectedDate = getSelectedDateStr();
    
    const absentCheckboxes = document.querySelectorAll('.absent-chk:checked');
    const absentTeachers = Array.from(absentCheckboxes).map(cb => cb.value);

    if (absentTeachers.length === 0) {
        mainGrid.innerHTML = `<div class="p-6 bg-red-50 text-red-600 font-bold border rounded-lg"><i data-lucide="alert-circle" class="inline"></i> Select absent teachers.</div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    let vacantSlots = generatedWeeklyTimetable.filter(slot =>
        slot.day === day && absentTeachers.includes(slot.teacherName.replace('⭐ ', ''))
    );

    if (vacantSlots.length === 0) {
        mainGrid.innerHTML = `<div class="p-6 bg-green-50 text-green-700 font-bold border border-green-200 rounded-lg flex items-center gap-2"><i data-lucide="check-circle"></i> No classes scheduled for the selected absent teachers on ${day}.</div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    vacantSlots.sort((a,b) => a.period.localeCompare(b.period, undefined, {numeric: true}));
    let allTeachers = [...new Set(SCHOOL_CONFIG.assignments.map(a => a.teacherName.replace('⭐ ', '')))];
    let presentTeachers = allTeachers.filter(t => !absentTeachers.includes(t));

    const fnLabels = SCHOOL_CONFIG.regularTimings.slice(0, 4).map(p => p.label);

    let html = `<div class="mb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
                    <div>
                        <h3 class="font-black text-2xl text-red-700 uppercase tracking-tight">Substitution Register</h3>
                        <p class="text-gray-600 font-bold mt-1"><i data-lucide="calendar" class="w-4 h-4 inline-block mr-1"></i>${selectedDate} <span class="text-gray-400">(${day})</span></p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.print()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded shadow font-bold flex items-center gap-2"><i data-lucide="printer" class="w-4 h-4"></i> Print</button>
                    </div>
                </div>
                <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse bg-white shadow-sm border border-gray-200">
            <thead class="bg-red-50 text-red-900 border-b border-red-200">
                <tr><th class="p-3 border-r">Period</th><th class="p-3 border-r">Class</th><th class="p-3 border-r">Absent Teacher</th><th class="p-3">Assign Substitute (Level Matched)</th></tr>
            </thead>
            <tbody>`;

    let tempDutyTracker = { ...window.subDutyTracker };

    vacantSlots.forEach(slot => {
        let slotGradeVal = getGradeValue(slot.className);
        let slotCategory = getTeacherCategory(slotGradeVal); 
        let currentSlotSession = fnLabels.includes(slot.period) ? 'FN' : 'AN'; 

        let busyThisPeriod = generatedWeeklyTimetable
            .filter(s => s.day === day && s.period === slot.period)
            .map(s => s.teacherName.replace('⭐ ', ''));

        let freeTeachers = presentTeachers.filter(t => 
            !busyThisPeriod.includes(t) && 
            isPartTimeTeacherAvailable(t, currentSlotSession) 
        );
        
        freeTeachers.sort((a, b) => {
            let aMatch = window.teacherLevels[a] === slotCategory ? 0 : 1;
            let bMatch = window.teacherLevels[b] === slotCategory ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            
            let subA = tempDutyTracker[a] || 0;
            let subB = tempDutyTracker[b] || 0;
            if (subA !== subB) return subA - subB;
            
            let loadA = window.teacherWorkload[a] || 0;
            let loadB = window.teacherWorkload[b] || 0;
            return loadA - loadB; 
        });

        let suggestedTeacher = freeTeachers.length > 0 ? freeTeachers[0] : null;
        if (suggestedTeacher) {
            tempDutyTracker[suggestedTeacher] = (tempDutyTracker[suggestedTeacher] || 0) + 1;
        }

        let optionsHtml = freeTeachers.map(t => {
            let dutyCount = window.subDutyTracker[t] || 0;
            let regLoad = window.teacherWorkload[t] || 0;
            let teacherCat = window.teacherLevels[t];
            let catShort = teacherCat === 'Primary' ? 'PR' : (teacherCat === 'High School' ? 'HS' : 'HSS');
            let isSelected = (t === suggestedTeacher) ? 'selected' : '';
            
            return `<option value="${t}" ${isSelected}>${t} (${catShort} | Sub: ${dutyCount} | Ld: ${regLoad})</option>`;
        }).join('');

        let noFreeTeacherMsg = freeTeachers.length === 0 ? `<option value="">⚠️ No Free Teachers Available!</option>` : '';

        html += `<tr class="border-b hover:bg-gray-50">
            <td class="p-3 border-r font-bold text-gray-700">${slot.period}</td>
            <td class="p-3 border-r font-black text-blue-800">${slot.className} <span class="block text-[10px] text-gray-400 font-normal mt-1">${slotCategory}</span></td>
            <td class="p-3 border-r text-red-600 font-medium line-through">${slot.teacherName.replace('⭐ ', '')} <span class="text-xs text-gray-400">(${slot.subjectName})</span></td>
            <td class="p-3">
                <select class="w-full p-2 border ${freeTeachers.length === 0 ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300'} rounded font-semibold text-green-700 outline-none focus:ring-2 focus:ring-green-400">
                    ${noFreeTeacherMsg} ${optionsHtml}
                </select>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    mainGrid.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    updateStatus("Substitution Manager Loaded");
}

function populateAbsentTeachersList() {
    let allTeachers = [...new Set(SCHOOL_CONFIG.assignments.map(a => a.teacherName.replace('⭐ ', '')))].sort();
    const listDiv = document.getElementById('absentTeachersList');
    if(!listDiv) return;
    listDiv.innerHTML = allTeachers.map(t => `<label class="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors"><input type="checkbox" class="absent-chk" value="${t}"> <span class="font-medium text-gray-700">${t}</span></label>`).join('');
}

window.syncFromCloud = async function() {
    updateStatus("Downloading Allot Sheet...");
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const cloudData = await response.json();

        window.rawAssignmentsData = cloudData.assignments || [];
        window.rawTrackerData = cloudData.tracker || [];

        window.runCalculationEngine(true);
        
    } catch (error) {
        updateStatus("Sync Failed!");
        console.error("Cloud Error:", error);
    }
};

window.runCalculationEngine = function(renderGrid = true) {
    if (!window.rawAssignmentsData || window.rawAssignmentsData.length < 2) {
        updateStatus("Allot data empty.");
        return;
    }

    window.subDutyTracker = {};
    if (window.rawTrackerData && window.rawTrackerData.length > 1) {
        window.rawTrackerData.slice(1).forEach(row => {
            let tName = String(row[0]).trim();
            window.subDutyTracker[tName] = parseInt(row[1]) || 0;
        });
    }

    SCHOOL_CONFIG.assignments = [];
    window.teacherWorkload = {}; 
    window.teacherMaxGrade = {}; 
    let tempTeacherSubjects = {}; 

    let calcMode = document.getElementById('calcMode')?.value || 'hybrid';

    window.rawAssignmentsData.slice(1).forEach(row => {
        let teacherName = String(row[1] || '').trim(); 
        if (!teacherName) return; 

        let classTeacherClass = String(row[5] || '').trim(); 

        let blocks = [{ act: row[2], cls: row[3], per: row[4] }];
        for(let i = 6; i + 2 < row.length; i += 3) {
             blocks.push({ act: row[i], cls: row[i+1], per: row[i+2] });
        }

        blocks.forEach(block => {
            let activity = String(block.act || '').trim();
            let classSecStr = String(block.cls || '').trim();
            let periodsVal = String(block.per || '').trim();

            if (!activity || !classSecStr || activity.length < 2 || !isNaN(activity)) return; 

            let distinctClasses = classSecStr.split(',');

            distinctClasses.forEach(distinctClassGroup => {
                 distinctClassGroup = distinctClassGroup.trim();
                 if(!distinctClassGroup) return;

                 let gradeVal = getGradeValue(distinctClassGroup);
                 let finalPeriods = 0;

                 if (calcMode === 'auto') {
                     finalPeriods = typeof SCHOOL_CONFIG.getPeriodsForActivity === 'function' ? SCHOOL_CONFIG.getPeriodsForActivity(activity, gradeVal) : 6;
                 } else if (calcMode === 'allotted') {
                     finalPeriods = parseInt(periodsVal) || 0; 
                 } else {
                     if (periodsVal.toUpperCase() === 'AUTO' || !periodsVal) {
                        finalPeriods = typeof SCHOOL_CONFIG.getPeriodsForActivity === 'function' ? SCHOOL_CONFIG.getPeriodsForActivity(activity, gradeVal) : 6;
                    } else {
                        finalPeriods = parseInt(periodsVal) || 0;
                    }
                 }

                if (finalPeriods > 0) {
                    let isCT = false;
                    if (classTeacherClass) {
                        let ctParts = classTeacherClass.split('-');
                        if(ctParts.length === 2 && distinctClassGroup.includes(ctParts[0]) && distinctClassGroup.includes(ctParts[1])){
                            isCT = true;
                        }
                    }

                    SCHOOL_CONFIG.assignments.push({
                        teacherName: teacherName,
                        subjectName: activity,
                        className: distinctClassGroup, 
                        periodsPerWeek: finalPeriods,
                        isClassTeacher: isCT
                    });
                    
                    window.teacherWorkload[teacherName] = (window.teacherWorkload[teacherName] || 0) + finalPeriods;
                    window.teacherMaxGrade[teacherName] = Math.max((window.teacherMaxGrade[teacherName] || 0), gradeVal);

                    if (!tempTeacherSubjects[teacherName]) tempTeacherSubjects[teacherName] = [];
                    tempTeacherSubjects[teacherName].push(activity.toUpperCase());
                }
            });
        });
    });

    window.teacherLevels = {};
    window.teacherPartTimeStatus = {};
    
    for (let t in window.teacherMaxGrade) {
        window.teacherLevels[t] = getTeacherCategory(window.teacherMaxGrade[t]);
        let isMorn = tempTeacherSubjects[t]?.some(s => s.includes('PART TIME TEACHER MORNING') || s.includes('PT-FN'));
        let isAft = tempTeacherSubjects[t]?.some(s => s.includes('PART TIME TEACHER AFTERNOON') || s.includes('PT-AN'));
        if (isMorn) window.teacherPartTimeStatus[t] = 'MORNING';
        else if (isAft) window.teacherPartTimeStatus[t] = 'AFTERNOON';
        else window.teacherPartTimeStatus[t] = 'FULL';
    }
    
    updateStatus("Generating Matrix...");
    generateAutoTimetable(); 
    populateAbsentTeachersList(); 
    
    if (renderGrid) {
        window.generateGrid(true); 
    }
    setTimeout(updateClassLoadUI, 500); 
};

window.saveDutiesToCloud = async function() {
    updateStatus("Saving Duty Counts...");
    const selects = document.querySelectorAll('select.w-full'); 
    let finalDutyTracker = { ...window.subDutyTracker }; 
    
    selects.forEach(select => {
        let assignedTeacher = select.value;
        if (assignedTeacher) {
            finalDutyTracker[assignedTeacher] = (finalDutyTracker[assignedTeacher] || 0) + 1;
        }
    });

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "updateSubTracker", data: finalDutyTracker })
        });
        await response.text();
        updateStatus("Saved Successfully!");
        window.subDutyTracker = finalDutyTracker; 
        alert("Duty counts successfully saved to cloud ledger!");
    } catch (error) {
        updateStatus("Save Failed!");
    }
};

window.exportPDF = function() {
    const { jsPDF } = window.jspdf;
    const mode = document.getElementById('opMode').value;
    const selectedDate = getSelectedDateStr();
    
    if (mode === 'exam') {
        const doc = new jsPDF('l', 'mm', 'a4'); 
        doc.setFontSize(14); doc.text(`${APP_CONFIG.shortName} Exam Invigilation Schedule`, 14, 15); doc.setFontSize(11); doc.text(`Date: ${selectedDate} | Session: ${currentSession}`, 14, 25); doc.save(`${APP_CONFIG.shortName}_Exam_Schedule_${selectedDate}.pdf`);
    } else if (mode === 'substitution') {
        const doc = new jsPDF('l', 'mm', 'a4'); 
        const day = document.getElementById('subDay').value;
        doc.setFontSize(14); doc.text(`${APP_CONFIG.shortName} Substitution Duty - ${selectedDate} (${day})`, 14, 15); doc.save(`${APP_CONFIG.shortName}_Sub_Schedule_${selectedDate}.pdf`);
    } else {
        const viewType = document.getElementById('viewType')?.value || 'all';
        const filterVal = document.getElementById('viewFilter')?.value || '';

        if (viewType === 'all') {
            if (generatedWeeklyTimetable.length === 0) { alert("No data generated. Click Sync Data first!"); return; }

            const doc = new jsPDF('p', 'mm', 'a4'); 
            let allTeachers = [...new Set(SCHOOL_CONFIG.assignments.map(a => a.teacherName.replace('⭐ ', '')))].sort();
            
            const cW = 90; const cH = 52; const marginX = 12; const marginY = 12; const gapX = 6; const gapY = 4; 
            let cardsOnPage = 0;
            const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class');
            const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; 

            allTeachers.forEach((teacher) => {
                if (cardsOnPage === 10) { doc.addPage(); cardsOnPage = 0; }
                let col = cardsOnPage % 2; let row = Math.floor(cardsOnPage / 2);
                let x = marginX + col * (cW + gapX); let y = marginY + row * (cH + gapY);

                doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3); doc.rect(x, y, cW, cH);
                doc.setFontSize(9); doc.setTextColor(0); doc.setFont("helvetica", "bold");
                let displayName = teacher.length > 20 ? teacher.substring(0, 18) + "..." : teacher;
                doc.text(`${APP_CONFIG.shortName} - ${displayName}`, x + 2, y + 5);

                let head = [['Day', ...teachingPeriods.map((_, i) => i + 1)]];
                let body = [];
                
                daysOfWeek.forEach((day, dIdx) => {
                    let rowData = [dayLabels[dIdx]];
                    teachingPeriods.forEach(period => {
                        let slot = generatedWeeklyTimetable.find(d => d.day === day && d.period === period.label && d.teacherName.replace('⭐ ', '') === teacher);
                        if (slot) {
                            let printSub = abbreviateSubject(slot.subjectName);
                            let printClass = slot.className.replace(/\s+/g, '');
                            rowData.push(`${printClass}\n${printSub}`);
                        } else {
                            rowData.push('-');
                        }
                    });
                    body.push(rowData);
                });

                doc.autoTable({
                    head: head, body: body, startY: y + 7, margin: { left: x + 2, bottom: 0 }, tableWidth: cW - 4, pageBreak: 'avoid', theme: 'grid',
                    styles: { fontSize: 5.5, cellPadding: 0.8, halign: 'center', valign: 'middle', lineColor: [150, 150, 150], lineWidth: 0.1, overflow: 'linebreak' },
                    headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold' },
                    columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 8 } }
                });
                cardsOnPage++;
            });
            doc.save(`${APP_CONFIG.shortName}_All_Teacher_Cards.pdf`);
        } else {
            const doc = new jsPDF('l', 'mm', 'a4'); 
            doc.setFontSize(16);
            doc.setTextColor(30, 58, 138); 
            doc.text(`${APP_CONFIG.shortName} Timetable - ${filterVal}`, 14, 18);
            
            doc.autoTable({ 
                html: '#scheduleTable', startY: 25, theme: 'grid', 
                styles: { fontSize: 10, cellPadding: 4, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 11, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] }
            });
            doc.save(`${APP_CONFIG.shortName}_Schedule_${filterVal.replace(' ', '_')}.pdf`);
        }
    }
};
