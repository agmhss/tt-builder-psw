/**
 * app.js - Advanced Timetable, Exam & Substitution Engine
 * Version: The Ultimate Master Build V9.0 (Optimizer, Top Priority & Total Periods)
 */

const APP_CONFIG = {
    fullName: "GHSS Thirumanur", 
    shortName: "GHSS Thirumanur",                                           
    scriptUrl: "https://script.google.com/macros/s/AKfycbygOhSbX1l66UnNXcqWT5zDG8T8l-S5EsNU76l_JJhF4Nhey5hc7u4wAhlKy_73U6p9/exec" 
};
const SCRIPT_URL = APP_CONFIG.scriptUrl;

// ==========================================
// 🌟 UI DROPDOWN LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const viewType = document.getElementById('viewType');
    const viewFilter = document.getElementById('viewFilter');
    
    if(viewType && viewFilter) {
        viewType.addEventListener('change', (e) => {
            viewFilter.innerHTML = ''; 
            let options = new Set();
            
            if (generatedWeeklyTimetable.length === 0) {
                viewFilter.innerHTML = '<option value="">No Data (Process Engine First)</option>';
                viewFilter.classList.remove('hidden');
                return;
            }

            if (e.target.value === 'class') {
                viewFilter.classList.remove('hidden');
                generatedWeeklyTimetable.forEach(slot => {
                    getIndividualClasses(slot.className).forEach(c => options.add(c));
                });
            } else if (e.target.value === 'teacher') {
                viewFilter.classList.remove('hidden');
                generatedWeeklyTimetable.forEach(slot => options.add(slot.teacherName));
            } else {
                viewFilter.classList.add('hidden');
                renderRegularTimetable();
                return;
            }
            
            let sortedOptions = Array.from(options).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
            sortedOptions.forEach(opt => { viewFilter.innerHTML += `<option value="${opt}">${opt}</option>`; });
            
            if(sortedOptions.length > 0) {
                viewFilter.value = sortedOptions[0];
                renderRegularTimetable();
            }
        });
        viewFilter.addEventListener('change', renderRegularTimetable);
    }
});

// ==========================================
// 🌟 GLOBAL TRACKERS & STATE
// ==========================================
let generatedWeeklyTimetable = [];
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
window.examDutyTracker = {};
window.subDutyTracker = {};
window.teacherWorkload = {}; 
window.teacherLevels = {}; 
window.teacherMaxGrade = {};
window.dailyExamTracker = {}; 
window.teacherPartTimeStatus = {};

window.rawAssignmentsData = null;
window.uiAllotments = []; 
window.rawTrackerData = null;
window.rawSavedGrid = null; 
window.serverAuthData = {}; 
window.dynamicRules = [];

let currentUserRole = null;
let currentUserName = null;
window.isEditMode = false;
window.swapSource = null;

function updateStatus(msg) {
    const indicator = document.getElementById('adminStatusIndicator');
    if (indicator) indicator.innerText = msg;
}

// 🌟 HIGHER CLASS PRIORITY HELPER (10 > 9 > 8 > 7 > 6)
function getGradeValue(clsStr) {
    let match = String(clsStr).toUpperCase().match(/^(\d+|LKG|UKG)/);
    if (!match) return -1;
    if (match[1] === 'LKG' || match[1] === 'UKG') return 0;
    return parseInt(match[1]); // 10 returns 10, 9 returns 9 etc.
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
    classNameStr.split(',').forEach(group => {
        let cleanGroup = group.trim();
        let parts = cleanGroup.split(/[&]/);
        if (parts.length > 1) {
            let baseMatch = parts[0].match(/^(\d+|LKG|UKG)/);
            let baseGrade = baseMatch ? baseMatch[0] : '';
            parts.forEach(p => {
                p = p.trim();
                if (p.match(/^(\d+|LKG|UKG)/)) result.push(p);
                else result.push((p.includes('-') ? baseGrade : baseGrade + '-') + p.replace(/^-/, ''));
            });
        } else if (cleanGroup) result.push(cleanGroup);
    });
    return result;
}

function isPartTimeTeacherAvailable(teacherName, sessionType) {
    let status = window.teacherPartTimeStatus[teacherName] || 'FULL';
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
    if (s.includes('SEWING') || s.includes('EC')) return 'SEWING';
    return s.length > 8 ? s.substring(0, 8) + '.' : s;
}

function populateAbsentTeachersList() {
    try {
        let allTeachers = [...new Set(SCHOOL_CONFIG.assignments.map(a => String(a.teacherName)))].filter(Boolean).sort();
        const listDiv = document.getElementById('absentTeachersList');
        if(!listDiv) return;
        if (allTeachers.length === 0) { listDiv.innerHTML = `<span class="text-xs text-red-500 font-bold p-2">No teachers found.</span>`; return; }
        listDiv.innerHTML = allTeachers.map(t => `<label class="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"><input type="checkbox" class="absent-chk w-4 h-4 text-red-600 rounded focus:ring-red-500" value="${t}"> <span class="font-bold text-gray-700">${t}</span></label>`).join('');
    } catch (err) {}
}

// ==========================================
// 🌟 PORTAL ROUTING & AUTHENTICATION
// ==========================================
const ADMIN_PASSKEY = "MASTER@2026"; 

window.toggleTeacherNameInput = function() {
    const role = document.getElementById('loginRole').value;
    const nameGroup = document.getElementById('teacherNameGroup');
    if (role === 'teacher') nameGroup.classList.remove('hidden');
    else nameGroup.classList.add('hidden');
};
// ==========================================
// 🌟 PASSWORD VISIBILITY TOGGLE
// ==========================================
window.togglePasswordVisibility = function() {
    const passInput = document.getElementById('loginPasskey');
    const eyeOpen = document.getElementById('eyeIconOpen');
    const eyeClosed = document.getElementById('eyeIconClosed');
    
    if (passInput.type === 'password') {
        passInput.type = 'text'; 
        eyeOpen.classList.add('hidden');
        eyeClosed.classList.remove('hidden'); 
    } else {
        passInput.type = 'password'; 
        eyeOpen.classList.remove('hidden'); 
        eyeClosed.classList.add('hidden');
    }
};

window.attemptLogin = async function() {
    const role = document.getElementById('loginRole').value;
    const passkey = document.getElementById('loginPasskey').value;
    const teacherName = document.getElementById('loginTeacherName').value.trim().toUpperCase();
    const errorMsg = document.getElementById('loginError');

    errorMsg.classList.add('hidden');

    if (role === 'admin') {
        if (passkey === ADMIN_PASSKEY) {
            currentUserRole = 'admin'; currentUserName = 'ADMIN';
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminPortal').classList.remove('hidden');
            updateStatus("Syncing Data...");
            
            await window.syncFromCloud(); 
            await checkAndGenerateTeacherPasskeys();
            
            renderUIAllotmentTable(); renderPasskeysUI(); renderDynamicRulesTable();
            updateStatus("System Ready");
        } else {
            errorMsg.innerText = "Incorrect Admin Passkey!"; errorMsg.classList.remove('hidden');
        }
    } else if (role === 'teacher') {
        if (!teacherName) { errorMsg.innerText = "Please enter Teacher Name!"; errorMsg.classList.remove('hidden'); return; }
        errorMsg.innerText = "Verifying Secure Ledger..."; errorMsg.classList.remove('hidden'); errorMsg.classList.replace('text-red-500', 'text-blue-500');

        try {
            const response = await fetch(SCRIPT_URL);
            const cloudData = JSON.parse(await response.text());
            window.serverAuthData = cloudData.authData || {};

            if (window.serverAuthData[teacherName] && window.serverAuthData[teacherName] === passkey) {
                currentUserRole = 'teacher'; currentUserName = teacherName;
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('teacherPortal').classList.remove('hidden');
                document.getElementById('teacherWelcomeText').innerText = `Welcome, ${teacherName}`;
                
                await window.syncFromCloud(); 
                setupTeacherPortalUI();
            } else {
                errorMsg.classList.replace('text-blue-500', 'text-red-500'); errorMsg.innerText = "Access Denied: Invalid ID or Passkey.";
            }
        } catch (e) {
            errorMsg.classList.replace('text-blue-500', 'text-red-500'); errorMsg.innerText = "Network Error.";
        }
    }
};

window.logout = function() {
    currentUserRole = null; currentUserName = null;
    document.getElementById('adminPortal').classList.add('hidden');
    document.getElementById('teacherPortal').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginPasskey').value = '';
};

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach(el => {
        el.classList.remove('border-blue-600', 'text-blue-700', 'border-purple-600', 'text-purple-700');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById(tabId).classList.remove('hidden');
    let activeColorClass = tabId === 'tabRules' ? ['border-purple-600', 'text-purple-700'] : ['border-blue-600', 'text-blue-700'];
    event.currentTarget.classList.remove('border-transparent', 'text-gray-500');
    event.currentTarget.classList.add(...activeColorClass);
    
    if(tabId === 'tabGenerator') {
        const viewType = document.getElementById('viewType');
        if(viewType && generatedWeeklyTimetable.length > 0) { viewType.value = 'class'; viewType.dispatchEvent(new Event('change')); }
    }
};

// ==========================================
// 🌟 DATA SYNC & CALCULATION ENGINE SETUP
// ==========================================
window.syncFromCloud = async function() {
    try {
        const response = await fetch(SCRIPT_URL);
        const cloudData = JSON.parse(await response.text());

        window.rawAssignmentsData = cloudData.assignments || [];
        window.rawTrackerData = cloudData.tracker || [];
        window.rawSavedGrid = cloudData.savedGrid || []; 
        window.serverAuthData = cloudData.authData || {};
        window.dynamicRules = cloudData.dynamicRules || [];

        window.runCalculationEngine(true, false); 
    } catch (error) { console.error("Sync Failed", error); }
};

window.runCalculationEngine = function(renderGrid = true, forceRecalculate = false) {
    try {
        if (!window.rawAssignmentsData || window.rawAssignmentsData.length < 2) return;

        window.uiAllotments = [];
        window.rawAssignmentsData.slice(1).forEach(row => {
            let tName = String(row[1] || '').trim();
            if(!tName) return;
            window.uiAllotments.push({
                teacherName: tName, act1: String(row[2] || '').trim(), cls1: String(row[3] || '').trim(), per1: String(row[4] || '').trim(),
                ct: String(row[5] || '').trim(), act2: String(row[6] || '').trim(), cls2: String(row[7] || '').trim(), per2: String(row[8] || '').trim(),
                act3: String(row[9] || '').trim(), cls3: String(row[10] || '').trim(), per3: String(row[11] || '').trim()
            });
        });

        window.subDutyTracker = {}; window.examDutyTracker = {}; 
        if (window.rawTrackerData && window.rawTrackerData.length > 1) {
            window.rawTrackerData.slice(1).forEach(row => {
                let tName = String(row[0]).trim();
                window.subDutyTracker[tName] = parseInt(row[1]) || 0;
                window.examDutyTracker[tName] = parseInt(row[2]) || 0;
            });
        }

        SCHOOL_CONFIG.assignments = []; window.teacherWorkload = {}; window.teacherMaxGrade = {}; let tempTeacherSubjects = {}; 

        window.uiAllotments.forEach(req => {
            let teacherName = req.teacherName; let classTeacherClass = req.ct.toUpperCase();
            let blocks = [{ act: req.act1, cls: req.cls1, per: req.per1 }, { act: req.act2, cls: req.cls2, per: req.per2 }, { act: req.act3, cls: req.cls3, per: req.per3 }];

            blocks.forEach(block => {
                let activity = block.act, classSecStr = block.cls, periodsVal = block.per;
                if (!activity || !classSecStr || activity.length < 2) return; 

                classSecStr.split(',').forEach(distinctClassGroup => {
                     let cleanGroup = distinctClassGroup.trim(); if(!cleanGroup) return;
                     let gradeVal = getGradeValue(cleanGroup); let finalPeriods = parseInt(periodsVal) || 0; 

                    if (finalPeriods > 0) {
                        let isCT = classTeacherClass && (cleanGroup.toUpperCase() === classTeacherClass || cleanGroup.toUpperCase().includes(classTeacherClass));
                        SCHOOL_CONFIG.assignments.push({ teacherName: teacherName, subjectName: activity, className: cleanGroup, periodsPerWeek: finalPeriods, isClassTeacher: isCT });
                        window.teacherWorkload[teacherName] = (window.teacherWorkload[teacherName] || 0) + finalPeriods;
                        window.teacherMaxGrade[teacherName] = Math.max((window.teacherMaxGrade[teacherName] || 0), gradeVal);
                        if (!tempTeacherSubjects[teacherName]) tempTeacherSubjects[teacherName] = [];
                        tempTeacherSubjects[teacherName].push(activity.toUpperCase());
                    }
                });
            });
        });

        window.teacherLevels = {}; window.teacherPartTimeStatus = {};
        for (let t in window.teacherMaxGrade) {
            window.teacherLevels[t] = getTeacherCategory(window.teacherMaxGrade[t]);
            let upperName = t.toUpperCase();
            let isMorn = upperName.includes('MORNING') || upperName.includes('PT-FN') || tempTeacherSubjects[t]?.some(s => s.includes('MORNING') || s.includes('PT-FN'));
            let isAft = upperName.includes('AFTERNOON') || upperName.includes('PT-AN') || tempTeacherSubjects[t]?.some(s => s.includes('AFTERNOON') || s.includes('PT-AN'));
            if (isMorn) window.teacherPartTimeStatus[t] = 'MORNING'; else if (isAft) window.teacherPartTimeStatus[t] = 'AFTERNOON'; else window.teacherPartTimeStatus[t] = 'FULL';
        }
        populateAbsentTeachersList();

        if (!forceRecalculate && window.rawSavedGrid && window.rawSavedGrid.length > 0) {
            generatedWeeklyTimetable = [...window.rawSavedGrid];
            if (renderGrid && currentUserRole === 'admin') renderRegularTimetable(); 
        } else if (forceRecalculate) {
            generateAutoTimetable(); 
        }
    } catch (err) {}
};

// ==========================================
// 🌟 THE CORE TIMETABLE ENGINE
// ==========================================
window.generateGrid = function() {
    // 🌟 NEW SAFETY CHECK: Warn if a grid already exists
    if (generatedWeeklyTimetable && generatedWeeklyTimetable.length > 0) {
        let userConfirmed = confirm("⚠️ WARNING: A Timetable Grid already exists!\n\nIf you click 'OK', the engine will run again, which will OVERWRITE your current grid and DESTROY any manual edits (swaps/fills) you have made.\n\nAre you sure you want to proceed and generate a new grid?");
        if (!userConfirmed) {
            return; // Stop the engine from running if user clicks Cancel
        }
    }

    const mainGrid = document.getElementById('mainGrid');
    const loadStatus = document.getElementById('loadStatus');
    if(loadStatus) loadStatus.innerHTML = '';
    
    mainGrid.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-blue-600 py-20"><svg class="animate-spin h-14 w-14 mb-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><h2 class="text-2xl font-black tracking-widest animate-pulse uppercase">Engine Processing...</h2><p class="text-sm font-bold text-gray-500 mt-2 bg-gray-100 px-4 py-1 rounded-full">Executing 2000x Monte Carlo Iterations</p></div>`;

    setTimeout(() => {
        window.runCalculationEngine(false, true); 
        const viewType = document.getElementById('viewType');
        if(viewType) { viewType.value = 'class'; viewType.dispatchEvent(new Event('change')); }
    }, 100);
};

function generateAutoTimetable() {
    let bestTimetable = []; let bestScore = -1; 
    if (!SCHOOL_CONFIG.assignments || SCHOOL_CONFIG.assignments.length === 0) return;
    let TARGET_SCORE = SCHOOL_CONFIG.assignments.reduce((sum, req) => sum + req.periodsPerWeek, 0);

    const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class');
    const firstPeriod = teachingPeriods[0]; const fnPeriodLabels = teachingPeriods.slice(0, 4).map(p => p.label);
    const MAX_ITERATIONS = 2000; 

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        let tempTimetable = []; let teacherAvail = {}; let classAvail = {}; let dailySubjectCount = {}; let fnSubjectCount = {}; let anSubjectCount = {}; 
        let currentScore = 0;

        let currentAssignments = JSON.parse(JSON.stringify(SCHOOL_CONFIG.assignments));
        currentAssignments.forEach(req => { req.assignedCount = 0; req.hasDouble = false; });

        function getMaxFnAn(req) {
            if (req.isClassTeacher) return { fn: 5, an: Math.max(0, req.periodsPerWeek - 5) };
            let sub = abbreviateSubject(req.subjectName).toUpperCase();
            if (sub.includes('TAM') || sub.includes('ENG') || sub.includes('SOC') || sub.includes('HIS')) return { fn: 3, an: 3 };
            if (sub.includes('MAT') || sub.includes('SCI')) return { fn: 4, an: 3 };
            return { fn: Math.ceil(req.periodsPerWeek / 2), an: Math.floor(req.periodsPerWeek / 2) };
        }

        let placeSlot = (day, p, req) => {
            tempTimetable.push({ day, period: p.label, time: `${p.start} - ${p.end}`, className: req.className, subjectName: req.subjectName, teacherName: req.teacherName });
            let timeKey = `${day}-${p.label}`;
            if(!teacherAvail[req.teacherName]) teacherAvail[req.teacherName] = {}; teacherAvail[req.teacherName][timeKey] = true;
            getIndividualClasses(req.className).forEach(cls => { if(!classAvail[cls]) classAvail[cls] = {}; classAvail[cls][timeKey] = true; });
            dailySubjectCount[`${req.className}-${day}-${req.subjectName}`] = (dailySubjectCount[`${req.className}-${day}-${req.subjectName}`] || 0) + 1;
            let key = `${req.className}-${req.subjectName}`;
            if (fnPeriodLabels.includes(p.label)) fnSubjectCount[key] = (fnSubjectCount[key] || 0) + 1; else anSubjectCount[key] = (anSubjectCount[key] || 0) + 1;
            req.assignedCount++; currentScore++;
        };

        // PHASE 1: CLASS TEACHERS ON PERIOD 1
        currentAssignments.filter(req => req.isClassTeacher).forEach(req => {
            daysOfWeek.forEach(day => {
                if (req.assignedCount < req.periodsPerWeek) {
                    let timeKey = `${day}-${firstPeriod.label}`;
                    let isClassBusy = getIndividualClasses(req.className).some(cls => classAvail[cls]?.[timeKey]);
                    let isTeacherBusy = teacherAvail[req.teacherName]?.[timeKey];
                    if (!isTeacherBusy && !isClassBusy && isPartTimeTeacherAvailable(req.teacherName, 'FN')) placeSlot(day, firstPeriod, req);
                }
            });
        });

        // PHASE 2: CONTINUOUS LAST TWO PERIODS (SCI, PET, ETC)
        currentAssignments.forEach(req => {
            let sub = req.subjectName.toUpperCase();
            if ((sub.includes('SCI') || sub.includes('PET') || sub.includes('CE') || sub.includes('CC') || sub.includes('EC')) && !req.hasDouble && (req.periodsPerWeek - req.assignedCount) >= 2) {
                let daysToTry = [...daysOfWeek]; if (iteration > 0) daysToTry.sort(() => Math.random() - 0.5);
                for (let day of daysToTry) {
                    if ((dailySubjectCount[`${req.className}-${day}-${req.subjectName}`] || 0) > 0) continue; 
                    let p1 = teachingPeriods[6], p2 = teachingPeriods[7]; let t1Key = `${day}-${p1.label}`, t2Key = `${day}-${p2.label}`;
                    let isClassBusy = getIndividualClasses(req.className).some(cls => classAvail[cls]?.[t1Key] || classAvail[cls]?.[t2Key]);
                    if (!teacherAvail[req.teacherName]?.[t1Key] && !teacherAvail[req.teacherName]?.[t2Key] && !isClassBusy && isPartTimeTeacherAvailable(req.teacherName, 'AN')) {
                        placeSlot(day, p1, req); placeSlot(day, p2, req); req.hasDouble = true; break;
                    }
                }
            }
        });

        // PHASE 3: CLUB IN LAST PERIOD
        currentAssignments.forEach(req => {
            if (req.subjectName.toUpperCase().includes('CLUB') || req.subjectName.toUpperCase().includes('JRC')) {
                let p = teachingPeriods[7]; let daysToTry = [...daysOfWeek]; if (iteration > 0) daysToTry.sort(() => Math.random() - 0.5);
                for (let day of daysToTry) {
                    let timeKey = `${day}-${p.label}`;
                    if (!teacherAvail[req.teacherName]?.[timeKey] && !getIndividualClasses(req.className).some(cls => classAvail[cls]?.[timeKey]) && isPartTimeTeacherAvailable(req.teacherName, 'AN') && req.assignedCount < req.periodsPerWeek) {
                        placeSlot(day, p, req); break;
                    }
                }
            }
        });

        // 🌟 PHASE 4: MAIN PLACEMENT (PRIORITY FOR HIGH CLASSES)
        currentAssignments.sort((a, b) => {
            let gradeA = getGradeValue(a.className); let gradeB = getGradeValue(b.className);
            // 🌟 In first 1000 iterations, strictly force 10th > 9th > 8th to secure 40/40!
            if (iteration < 1000) {
                if (gradeA !== gradeB) return gradeB - gradeA; 
                return b.periodsPerWeek - a.periodsPerWeek; 
            }
            // Add entropy later to avoid deadlocks
            let scoreA = gradeA * 100 + a.periodsPerWeek; let scoreB = gradeB * 100 + b.periodsPerWeek;
            return (scoreB - scoreA) * Math.random() + (Math.random() - 0.5) * 50;
        });

        function attemptMainPlacement(req, bypassLevel) {
            let maxDailyAllowed = Math.max(1, Math.ceil(req.periodsPerWeek / 5));
            let startDayIdx = iteration === 0 ? 0 : Math.floor(Math.random() * 5); 
            let key = `${req.className}-${req.subjectName}`; let maxLimits = getMaxFnAn(req);
            let isPT = window.teacherPartTimeStatus[req.teacherName] !== 'FULL';
            let tNameOnly = req.teacherName.replace('⭐ ', '').replace('*', '');

            for (let i = 0; i < req.periodsPerWeek; i++) {
                if (req.assignedCount >= req.periodsPerWeek) break; 
                let placed = false;
                for (let offset = 0; offset < daysOfWeek.length; offset++) {
                    let day = daysOfWeek[(startDayIdx + offset + i) % 5];
                    if (bypassLevel < 1 && (dailySubjectCount[`${req.className}-${day}-${req.subjectName}`] || 0) >= maxDailyAllowed) continue; 
                    let periodsToTry = [...teachingPeriods]; if (iteration > 0) periodsToTry.sort(() => Math.random() - 0.5);

                    for (let period of periodsToTry) {
                        if (bypassLevel < 2 && !req.isClassTeacher && period.label === firstPeriod.label) continue; 
                        let isFN = fnPeriodLabels.includes(period.label);
                        if (bypassLevel < 1 && !isPT) {
                            if (isFN && (fnSubjectCount[key] || 0) >= maxLimits.fn) continue;
                            if (!isFN && (anSubjectCount[key] || 0) >= maxLimits.an) continue;
                        }
                        if (!isPartTimeTeacherAvailable(req.teacherName, isFN ? 'FN' : 'AN')) continue;

                        let violatesRule = false;
                        for (let r of window.dynamicRules) {
                            let applies = (r.targetType === 'Teacher' && tNameOnly === r.targetName.replace('*','')) || (r.targetType === 'Subject' && abbreviateSubject(req.subjectName) === r.targetName) || (r.targetType === 'Class' && getIndividualClasses(req.className).includes(r.targetName));
                            if (!applies || (bypassLevel >= 1 && r.action === 'Soft') || bypassLevel >= 2) continue;
                            if (r.constraintType === 'Block Day' && day.toLowerCase() === String(r.parameter).toLowerCase()) violatesRule = true;
                            if (r.constraintType === 'Block Period' && period.label === String(r.parameter)) violatesRule = true;
                            if (r.constraintType === 'Block Slot' && `${day}-${period.label}` === String(r.parameter)) violatesRule = true;
                            if (r.constraintType === 'Max Per Day' && r.targetType === 'Teacher') {
                                let tCount = 0; tempTimetable.forEach(slot => { if(slot.day === day && slot.teacherName.includes(tNameOnly)) tCount++; });
                                if (tCount >= parseInt(r.parameter)) violatesRule = true;
                            }
                            if(violatesRule) break;
                        }
                        if (violatesRule) continue; 

                        let timeKey = `${day}-${period.label}`;
                        if (!teacherAvail[req.teacherName]?.[timeKey] && !getIndividualClasses(req.className).some(cls => classAvail[cls]?.[timeKey])) {
                            placeSlot(day, period, req); placed = true; break; 
                        }
                    }
                    if (placed) break; 
                }
            }
        }

        currentAssignments.forEach(req => attemptMainPlacement(req, 0));
        currentAssignments.forEach(req => { if (req.assignedCount < req.periodsPerWeek) attemptMainPlacement(req, 1); });
        currentAssignments.forEach(req => { if (req.assignedCount < req.periodsPerWeek) attemptMainPlacement(req, 2); }); 

        if (currentScore > bestScore) { bestScore = currentScore; bestTimetable = JSON.parse(JSON.stringify(tempTimetable)); }
        if (bestScore === TARGET_SCORE) break;
    }
    
    generatedWeeklyTimetable = bestTimetable;
    
    const loadStatusDiv = document.getElementById('loadStatus');
    if (loadStatusDiv) {
        let percentage = Math.round((bestScore / TARGET_SCORE) * 100) || 0;
        let color = percentage === 100 ? 'text-green-700 bg-green-50 border-green-200' : 'text-orange-700 bg-orange-50 border-orange-200';
        let icon = percentage === 100 ? 'check-circle' : 'alert-triangle';
        loadStatusDiv.innerHTML = `<div class="p-4 border-2 rounded-xl shadow-sm flex justify-between items-center ${color}"><div class="font-black flex items-center gap-2 text-lg"><i data-lucide="${icon}" class="w-6 h-6"></i>Engine Optimization Complete</div><div class="font-bold text-sm bg-white px-4 py-2 rounded-lg shadow-sm border border-opacity-50 border-current">Successfully Placed: <span class="text-xl font-black">${bestScore} / ${TARGET_SCORE}</span> Periods</div></div>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

// ==========================================
// 🌟 ALLOTMENT & RULE MANAGER UI (WITH EDIT BUTTON)
// ==========================================
window.renderUIAllotmentTable = function() {
    const tbody = document.getElementById('uiAllotmentTableBody');
    if(!tbody) return;

    let teacherTotals = {};
    window.uiAllotments.forEach(req => {
        let sum = (parseInt(req.per1) || 0) + (parseInt(req.per2) || 0) + (parseInt(req.per3) || 0);
        teacherTotals[req.teacherName] = (teacherTotals[req.teacherName] || 0) + sum;
    });

    tbody.innerHTML = window.uiAllotments.map((req, i) => `
        <tr class="hover:bg-blue-50 border-b border-gray-100">
            <td class="p-3">
                <div class="font-bold text-gray-800 text-base">${req.teacherName}</div>
                <div class="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded inline-block mt-1">Total: ${teacherTotals[req.teacherName]} Per</div>
            </td>
            <td class="p-3 text-xs" colspan="3">
                ${req.act1 ? `<div class="flex gap-2 mb-1"><span class="w-16 font-black text-blue-700">${req.act1}</span> <span class="bg-gray-100 px-2 rounded">${req.cls1}</span> <span class="text-red-500 font-bold">(${req.per1} Per)</span></div>` : ''}
                ${req.act2 ? `<div class="flex gap-2 mb-1"><span class="w-16 font-black text-blue-700">${req.act2}</span> <span class="bg-gray-100 px-2 rounded">${req.cls2}</span> <span class="text-red-500 font-bold">(${req.per2} Per)</span></div>` : ''}
                ${req.act3 ? `<div class="flex gap-2"><span class="w-16 font-black text-blue-700">${req.act3}</span> <span class="bg-gray-100 px-2 rounded">${req.cls3}</span> <span class="text-red-500 font-bold">(${req.per3} Per)</span></div>` : ''}
            </td>
            <td class="p-3 text-center">${req.ct ? `<span class="bg-green-100 text-green-800 px-2 py-1 rounded font-bold">${req.ct}</span>` : '-'}</td>
            <td class="p-3 text-center whitespace-nowrap">
                <button onclick="editAllotmentRow(${i})" class="text-blue-600 hover:text-blue-800 mr-3" title="Edit"><i data-lucide="edit" class="w-4 h-4 mx-auto"></i></button>
                <button onclick="deleteAllotmentRow(${i})" class="text-red-500 hover:text-red-700" title="Delete"><i data-lucide="trash" class="w-4 h-4 mx-auto"></i></button>
            </td>
        </tr>
    `).join('');
    if(window.lucide) window.lucide.createIcons();
};

window.addTeacherAllotmentUI = function() {
    let tName = document.getElementById('newTName').value.trim().toUpperCase(); let tSub = document.getElementById('newTSub').value.trim().toUpperCase(); let tClass = document.getElementById('newTClass').value.trim().toUpperCase(); let tPeriods = parseInt(document.getElementById('newTPeriods').value); let tCT = document.getElementById('newTCT').value.trim().toUpperCase(); 
    if(!tName || !tSub || !tClass || !tPeriods) return alert("Please fill all required fields!");
    window.uiAllotments.push({ teacherName: tName, ct: tCT, act1: tSub, cls1: tClass, per1: tPeriods, act2: "", cls2: "", per2: "", act3: "", cls3: "", per3: "" });
    document.getElementById('newTSub').value = ''; document.getElementById('newTClass').value = ''; document.getElementById('newTCT').value = ''; renderUIAllotmentTable();
};

// 🌟 NEW: EDIT FUNCTION
window.editAllotmentRow = function(index) {
    let req = window.uiAllotments[index];
    document.getElementById('newTName').value = req.teacherName;
    document.getElementById('newTSub').value = req.act1;
    document.getElementById('newTClass').value = req.cls1;
    document.getElementById('newTPeriods').value = req.per1;
    document.getElementById('newTCT').value = req.ct || "";
    
    // Remove the old entry so the user can save the updated one
    window.uiAllotments.splice(index, 1);
    renderUIAllotmentTable();
    document.getElementById('newTName').focus(); // Auto-scroll to inputs
};

window.deleteAllotmentRow = function(index) { if(confirm("Delete this allotment?")) { window.uiAllotments.splice(index, 1); renderUIAllotmentTable(); } };
window.saveAllotmentToCloud = async function() {
    updateStatus("Saving Master Ledger...");
    try { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "saveAllotment", data: window.uiAllotments }) }); alert("Master Allotment Ledger Saved to Cloud securely!"); updateStatus("System Ready"); } catch(e) { alert("Error saving allotment."); }
};

async function checkAndGenerateTeacherPasskeys() {
    let updated = false; let allTeachers = [...new Set(window.uiAllotments.map(a => a.teacherName))];
    allTeachers.forEach(teacher => {
        if (!window.serverAuthData[teacher] && !teacher.includes('*')) { window.serverAuthData[teacher] = teacher + "@2026"; updated = true; }
    });
    if (updated) await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "saveAuth", data: window.serverAuthData }) });
}

window.renderPasskeysUI = function() {
    const grid = document.getElementById('passkeyGridDisplay'); if(!grid) return;
    grid.innerHTML = Object.entries(window.serverAuthData).map(([t, key]) => `<div class="border border-gray-200 rounded-lg p-3 text-center bg-gray-50 hover:bg-white hover:shadow-md transition-all"><div class="font-black text-gray-800 text-sm truncate" title="${t}">${t}</div><div class="text-xs text-blue-600 font-bold mt-1 tracking-widest bg-blue-100 py-1 rounded">${key}</div></div>`).join('');
};

window.downloadPasskeysPDF = function() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); doc.setFontSize(16); doc.text("ORIENTAL GAHSS - Staff Portal Passkeys", 14, 20); doc.setFontSize(10); doc.text("CONFIDENTIAL: Hand over to respective staff only.", 14, 28); let tableBody = Object.entries(window.serverAuthData).map(([t, k]) => [t, k]); doc.autoTable({ startY: 35, head: [['Teacher Name', 'Secure Passkey']], body: tableBody, theme: 'grid', headStyles: { fillColor: [30, 58, 138] }}); doc.save('Staff_Portal_Passkeys.pdf');
};

window.addDynamicRule = function() {
    let targetType = document.getElementById('ruleTargetType').value; let targetName = document.getElementById('ruleTargetName').value.trim().toUpperCase(); let constraint = document.getElementById('ruleConstraint').value; let parameter = document.getElementById('ruleParameter').value.trim(); let action = document.getElementById('ruleAction').value;
    if(!targetName || !parameter) return alert("Please fill Target Name and Parameter");
    window.dynamicRules.push({ ruleId: 'R' + Date.now(), targetType, targetName, constraintType: constraint, parameter, action }); renderDynamicRulesTable();
};

window.renderDynamicRulesTable = function() {
    const tbody = document.getElementById('uiRulesTableBody'); if(!tbody) return;
    tbody.innerHTML = window.dynamicRules.map((r, index) => `<tr class="hover:bg-purple-50 transition-colors"><td class="p-3 font-bold text-gray-600">${r.targetType}</td><td class="p-3 text-purple-700 font-black">${r.targetName}</td><td class="p-3 text-sm">${r.constraintType}</td><td class="p-3 font-bold bg-gray-100 rounded text-center">${r.parameter}</td><td class="p-3 font-bold ${r.action === 'Hard' ? 'text-red-600' : 'text-orange-500'}">${r.action}</td><td class="p-3 text-center"><button onclick="deleteRule(${index})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 mx-auto"></i></button></td></tr>`).join(''); if (window.lucide) window.lucide.createIcons();
};

window.deleteRule = function(index) { window.dynamicRules.splice(index, 1); renderDynamicRulesTable(); };

window.saveRulesToCloud = async function() {
    updateStatus("Syncing Rules...");
    try { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "saveRules", data: window.dynamicRules }) }); alert("Rules constraints saved successfully!"); updateStatus("System Ready"); } catch(err) { alert("Error saving rules."); }
};

// ==========================================
// 🌟 SHEET OPTIMIZER MODAL (NEW)
// ==========================================
window.openOptimizerModal = function() {
    if (!window.uiAllotments || window.uiAllotments.length === 0) return alert("No allotment data found.");
    let classData = {};
    
    window.uiAllotments.forEach(req => {
        let blocks = [
            { act: req.act1, cls: req.cls1, per: parseInt(req.per1)||0 },
            { act: req.act2, cls: req.cls2, per: parseInt(req.per2)||0 },
            { act: req.act3, cls: req.cls3, per: parseInt(req.per3)||0 }
        ];
        blocks.forEach(b => {
            if (b.per > 0 && b.cls) {
                getIndividualClasses(b.cls).forEach(c => {
                    if (!classData[c]) classData[c] = { total: 0, subjects: {} };
                    classData[c].total += b.per;
                    classData[c].subjects[b.act] = (classData[c].subjects[b.act] || 0) + b.per;
                });
            }
        });
    });

    let sortedClasses = Object.keys(classData).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    let reportHtml = ''; let perfectCount = 0;

    sortedClasses.forEach(cls => {
        let data = classData[cls];
        if (data.total === 40) {
            perfectCount++;
            reportHtml += `<div class="p-3 bg-green-50 border border-green-200 rounded-lg shadow-sm flex justify-between items-center"><span class="font-bold text-green-900 text-lg">${cls}</span><span class="text-xs font-black bg-green-200 text-green-900 px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> 40/40</span></div>`;
        } else if (data.total < 40) {
            let def = 40 - data.total;
            reportHtml += `<div class="p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm"><div class="flex justify-between items-center"><span class="font-bold text-red-900 text-lg">${cls}</span><span class="text-xs font-black bg-red-200 text-red-900 px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> ${data.total}/40</span></div><div class="text-sm text-red-700 mt-2 font-bold">📉 Shortage: Add <b class="bg-red-200 px-1 rounded">${def}</b> periods.</div></div>`;
        } else {
            let exc = data.total - 40;
            reportHtml += `<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm"><div class="flex justify-between items-center"><span class="font-bold text-yellow-900 text-lg">${cls}</span><span class="text-xs font-black bg-yellow-200 text-yellow-900 px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="alert-octagon" class="w-3 h-3"></i> ${data.total}/40</span></div><div class="text-sm text-yellow-800 mt-2 font-bold">📈 Excess: Remove <b class="bg-yellow-200 px-1 rounded">${exc}</b> periods.</div></div>`;
        }
    });

    document.getElementById('optimizerContent').innerHTML = reportHtml;
    let summaryColor = perfectCount === sortedClasses.length ? "text-green-700" : "text-indigo-900";
    document.getElementById('optimizerSummary').innerHTML = `<span class="${summaryColor} flex items-center gap-2"><i data-lucide="pie-chart" class="w-5 h-5"></i> <b class="text-lg">${perfectCount}</b> out of <b>${sortedClasses.length}</b> classes are perfectly balanced (40/40).</span>`;
    document.getElementById('optimizerModal').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
};
window.closeOptimizerModal = function() { document.getElementById('optimizerModal').classList.add('hidden'); };

// ==========================================
// 🌟 GRID RENDERING & MANUAL EDITING 
// ==========================================
window.toggleEditMode = function() { window.isEditMode = !window.isEditMode; window.swapSource = null; renderRegularTimetable(); };

window.handleCellClick = function(day, period) {
    if (!window.isEditMode) return;
    if (!window.swapSource) { window.swapSource = { day, period }; renderRegularTimetable(); } 
    else {
        let target = { day, period };
        if (window.swapSource.day === target.day && window.swapSource.period === target.period) { window.swapSource = null; renderRegularTimetable(); return; }

        let viewType = document.getElementById('viewType')?.value; let filterVal = document.getElementById('viewFilter')?.value;
        let slot1Index = generatedWeeklyTimetable.findIndex(d => d.day === window.swapSource.day && d.period === window.swapSource.period && (viewType === 'teacher' ? d.teacherName === filterVal : getIndividualClasses(d.className).includes(filterVal)));
        let slot2Index = generatedWeeklyTimetable.findIndex(d => d.day === target.day && d.period === target.period && (viewType === 'teacher' ? d.teacherName === filterVal : getIndividualClasses(d.className).includes(filterVal)));

        if (slot1Index !== -1) { generatedWeeklyTimetable[slot1Index].day = target.day; generatedWeeklyTimetable[slot1Index].period = target.period; }
        if (slot2Index !== -1) { generatedWeeklyTimetable[slot2Index].day = window.swapSource.day; generatedWeeklyTimetable[slot2Index].period = window.swapSource.period; }

        window.swapSource = null; renderRegularTimetable(); 
    }
};

window.openEditModal = function(event, day, period) {
    if(event) event.stopPropagation(); 
    let viewType = document.getElementById('viewType')?.value; let filterVal = document.getElementById('viewFilter')?.value;
    let slotIndex = generatedWeeklyTimetable.findIndex(d => d.day === day && d.period === period && (viewType === 'teacher' ? d.teacherName === filterVal : getIndividualClasses(d.className).includes(filterVal)));
    document.getElementById('editDay').value = day; document.getElementById('editPeriod').value = period;

    if (slotIndex !== -1) {
        let slot = generatedWeeklyTimetable[slotIndex];
        document.getElementById('editClass').value = slot.className; document.getElementById('editSubject').value = slot.subjectName; document.getElementById('editTeacher').value = slot.teacherName;
    } else {
        document.getElementById('editClass').value = viewType === 'class' ? filterVal : ''; document.getElementById('editSubject').value = ''; document.getElementById('editTeacher').value = viewType === 'teacher' ? filterVal : '';
    }
    document.getElementById('editModal').classList.remove('hidden'); if (window.lucide) window.lucide.createIcons();
};

window.closeEditModal = function() { document.getElementById('editModal').classList.add('hidden'); };

window.saveCellEdit = function() {
    let day = document.getElementById('editDay').value;
    let period = document.getElementById('editPeriod').value;
    let cls = document.getElementById('editClass').value.toUpperCase();
    let sub = document.getElementById('editSubject').value.toUpperCase();
    let newTeacher = document.getElementById('editTeacher').value.toUpperCase();
    
    if(!cls || !sub || !newTeacher) return window.deleteCellData();

    // 1. இந்த வகுப்பில் இந்த பீரியடில் ஏற்கனவே யார் இருந்தார்?
    let targetClassSlotIndex = generatedWeeklyTimetable.findIndex(d => d.day === day && d.period === period && getIndividualClasses(d.className).includes(cls));
    let oldTeacher = null;
    let oldSub = null;
    
    if (targetClassSlotIndex !== -1) {
        oldTeacher = generatedWeeklyTimetable[targetClassSlotIndex].teacherName;
        oldSub = generatedWeeklyTimetable[targetClassSlotIndex].subjectName;
    }

    // 2. புதிய ஆசிரியர் வேறு வகுப்பில் பிஸியா என சரிபார்த்தல்
    let teacherBusySlotIndex = generatedWeeklyTimetable.findIndex(d => d.day === day && d.period === period && d.teacherName === newTeacher);

    // 3. புதிய டேட்டாவை அப்டேட் செய்தல்
    if (targetClassSlotIndex !== -1) {
        generatedWeeklyTimetable[targetClassSlotIndex].className = cls;
        generatedWeeklyTimetable[targetClassSlotIndex].subjectName = sub;
        generatedWeeklyTimetable[targetClassSlotIndex].teacherName = newTeacher;
    } else {
        generatedWeeklyTimetable.push({ day, period, time: "Manual", className: cls, subjectName: sub, teacherName: newTeacher });
    }

    // 🌟 4. DOUBLE BOOKING EXCEPTION (PET & CLUB)
    // இந்தப் பாடங்களுக்கு மட்டும் ஒரே ஆசிரியர் பல வகுப்புகளில் ஒரே நேரத்தில் இருக்க அனுமதிக்கப்படும்
    let isDoubleBookingAllowed = sub.includes('PET') || sub.includes('CLUB') || sub.includes('JRC') || sub.includes('NCC') || sub.includes('NSS') || sub.includes('VE/CC') || sub.includes('CC') || sub.includes('EC');

    // Double booking அனுமதிக்கப்படாத மற்ற பாடங்களுக்கு (Maths, English etc.) மட்டும் Auto-Swap வேலை செய்யும்
    if (!isDoubleBookingAllowed && teacherBusySlotIndex !== -1 && teacherBusySlotIndex !== targetClassSlotIndex) {
        if (oldTeacher && oldTeacher !== newTeacher) {
            generatedWeeklyTimetable[teacherBusySlotIndex].teacherName = oldTeacher;
            generatedWeeklyTimetable[teacherBusySlotIndex].subjectName = oldSub;
        } else {
            generatedWeeklyTimetable.splice(teacherBusySlotIndex, 1);
        }
    }

    window.closeEditModal(); 
    window.swapSource = null; 
    renderRegularTimetable(); 
};

window.deleteCellData = function() {
    let day = document.getElementById('editDay').value, period = document.getElementById('editPeriod').value, viewType = document.getElementById('viewType')?.value, filterVal = document.getElementById('viewFilter')?.value;
    let slotIndex = generatedWeeklyTimetable.findIndex(d => d.day === day && d.period === period && (viewType === 'teacher' ? d.teacherName === filterVal : getIndividualClasses(d.className).includes(filterVal)));
    if (slotIndex !== -1) generatedWeeklyTimetable.splice(slotIndex, 1);
    window.closeEditModal(); window.swapSource = null; renderRegularTimetable(); 
};

window.saveGridToCloud = async function() {
    updateStatus("Saving Master Grid...");
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "saveGrid", data: generatedWeeklyTimetable }) });
        alert("Timetable Grid successfully saved to Cloud!"); updateStatus("System Ready");
    } catch (e) { alert("Error saving Grid."); }
};

window.resetTimetableUI = function() {
    if(confirm("⚠️ CRITICAL WARNING!\n\nThis will completely wipe the generated Grid Matrix. Are you absolutely sure?")) {
        generatedWeeklyTimetable = []; document.getElementById('loadStatus').innerHTML = '';
        document.getElementById('mainGrid').innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 py-10"><p class="text-lg font-bold">Grid Matrix Wiped.</p></div>`;
        window.saveGridToCloud(); 
    }
};

function renderRegularTimetable() {
    const mainGrid = document.getElementById('mainGrid');
    const viewType = document.getElementById('viewType')?.value || 'all';
    const filterVal = document.getElementById('viewFilter')?.value || '';

    if (generatedWeeklyTimetable.length === 0) { mainGrid.innerHTML = `<div class="text-red-500 font-bold p-4 text-center">Matrix is empty. Hit Process Engine!</div>`; return; }
    if (viewType === 'all' || !filterVal) { mainGrid.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-500 py-20"><i data-lucide="grid" class="w-12 h-12 mb-2 opacity-30"></i><p class="text-lg">Select <b>By Class</b> or <b>By Teacher</b> to view Grid.</p></div>`; if (window.lucide) window.lucide.createIcons(); return; }

    const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class');
    let btnText = window.isEditMode ? "🔒 Lock Grid" : "✏️ Enable Edit Mode";
    let btnClass = window.isEditMode ? "bg-red-100 text-red-700 border-red-300" : "bg-gray-100 text-gray-700 border-gray-300";
    
    let html = `<div class="mb-4 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100"><h3 class="font-black text-xl text-blue-900">${filterVal}</h3><button onclick="toggleEditMode()" class="px-5 py-2 border rounded-lg text-sm font-bold shadow-sm ${btnClass}">${btnText}</button></div><div class="overflow-x-auto pb-4"><table id="scheduleTable" class="w-full text-center border-collapse min-w-[800px] bg-white text-sm shadow-sm rounded-lg overflow-hidden"><thead class="bg-blue-100 text-blue-900"><tr><th class="p-3 border border-blue-200 text-left w-24">Day</th>`;
    teachingPeriods.forEach((p, index) => { html += `<th class="p-3 border border-blue-200"><div class="font-bold text-lg">${index + 1}</div></th>`; });
    html += `</tr></thead><tbody>`;

    let displayData = viewType === 'class' ? generatedWeeklyTimetable.filter(d => getIndividualClasses(d.className).includes(filterVal)) : generatedWeeklyTimetable.filter(d => d.teacherName === filterVal);

    daysOfWeek.forEach(day => {
        html += `<tr><td class="p-3 border border-gray-200 font-bold text-gray-700 bg-gray-50 text-left">${day}</td>`;
        teachingPeriods.forEach(period => {
            let slot = displayData.find(d => d.day === day && d.period === period.label);
            let isSourceCell = window.swapSource && window.swapSource.day === day && window.swapSource.period === period.label;
            let cursorClass = window.isEditMode ? "cursor-pointer hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-400 z-10" : "";
            let cellBgClass = isSourceCell ? "bg-yellow-200 ring-2 ring-yellow-500 shadow-inner" : (slot ? "hover:bg-blue-50" : "bg-gray-50/30 text-gray-300");
            let clickEvent = `onclick="handleCellClick('${day}', '${period.label}')"`;
            let dblClickEvent = window.isEditMode ? `ondblclick="openEditModal(event, '${day}', '${period.label}')"` : "";
            let editBtnHtml = isSourceCell ? `<button onclick="openEditModal(event, '${day}', '${period.label}')" class="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1.5 shadow-lg"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>` : '';

            if (slot) {
                let cellText = viewType === 'class' ? `<span class="font-semibold text-gray-800">${abbreviateSubject(slot.subjectName)}</span><br><span class="text-xs text-blue-600 font-bold">${slot.teacherName}</span>` : `<span class="font-bold text-green-700">${slot.className.replace(/\s+/g, '')}</span><br><span class="text-xs text-gray-600">${abbreviateSubject(slot.subjectName)}</span>`;
                html += `<td ${clickEvent} ${dblClickEvent} class="p-2 border border-gray-200 relative ${cursorClass} ${cellBgClass}">${editBtnHtml}${cellText}</td>`;
            } else {
                let cellText = window.isEditMode && isSourceCell ? `<span class="text-[10px] font-bold text-yellow-800">Swap here?</span>` : `-`;
                html += `<td ${clickEvent} ${dblClickEvent} class="p-2 border border-gray-200 relative ${cursorClass} ${cellBgClass}">${editBtnHtml}${cellText}</td>`;
            }
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    mainGrid.innerHTML = html;
}

// ==========================================
// 🌟 EXAM & SUB MANAGER
// ==========================================
window.renderExamSchedule = function() {
    const pattern = document.getElementById('patternSelect').value; const currentSession = document.getElementById('examSession').value; const selectedDate = document.getElementById('examDate').value ? new Date(document.getElementById('examDate').value).toLocaleDateString('en-GB') : "N/A"; const activeGrades = SCHOOL_CONFIG.examPatterns[pattern][currentSession]; const examData = SCHOOL_CONFIG.examSettings[currentSession]; const examGrid = document.getElementById('examGrid');
    if (!window.dailyExamTracker[selectedDate]) window.dailyExamTracker[selectedDate] = { FN: [], AN: [] }; window.dailyExamTracker[selectedDate][currentSession] = []; const busyInOtherSession = window.dailyExamTracker[selectedDate][currentSession === 'FN' ? 'AN' : 'FN'];

    let teacherProfiles = {};
    if (SCHOOL_CONFIG.assignments) SCHOOL_CONFIG.assignments.forEach(req => { if (!teacherProfiles[req.teacherName]) teacherProfiles[req.teacherName] = { subjects: new Set() }; teacherProfiles[req.teacherName].subjects.add(req.subjectName); });
    let allTeachers = Object.keys(teacherProfiles); let presentTeachers = allTeachers.filter(t => !busyInOtherSession.includes(t) && window.teacherPartTimeStatus[t] === 'FULL' && !t.includes('*') && !t.includes('⭐'));

    if (presentTeachers.length === 0) { examGrid.innerHTML = `<div class="text-red-500 font-bold p-4">No available teachers for Invigilation!</div>`; return; }
    let html = `<div id="examContainer" class="space-y-6"><div class="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg flex justify-between items-center"><div><h3 class="font-bold text-orange-900 text-lg">Session: ${currentSession}</h3><p class="text-sm text-orange-800 font-medium">${selectedDate}</p></div><div class="bg-orange-200 text-orange-900 px-3 py-1 rounded font-bold">Starts @ ${examData.writingStart}</div></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

    let tempExamTracker = { ...window.examDutyTracker };
    activeGrades.forEach((grade, index) => {
        const isJunior = grade <= 8; let examCategory = getTeacherCategory(getGradeValue(grade));
        let eligibleTeachers = presentTeachers.filter(t => !teacherProfiles[t].subjects.has("English")); if (eligibleTeachers.length === 0) eligibleTeachers = presentTeachers; 
        let levelMatchedTeachers = eligibleTeachers.filter(t => window.teacherLevels[t] === examCategory); if (levelMatchedTeachers.length > 0) eligibleTeachers = levelMatchedTeachers; 
        
        eligibleTeachers.sort((a, b) => { let examA = tempExamTracker[a] || 0, examB = tempExamTracker[b] || 0; if (examA !== examB) return examA - examB; return (window.teacherWorkload[a] || 0) - (window.teacherWorkload[b] || 0); });
        
        if (eligibleTeachers.length === 0) return; let dutyTeacher = eligibleTeachers[0];
        window.dailyExamTracker[selectedDate][currentSession].push(dutyTeacher); presentTeachers = presentTeachers.filter(t => t !== dutyTeacher); tempExamTracker[dutyTeacher] = (tempExamTracker[dutyTeacher] || 0) + 1;

        html += `<div class="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-400 relative overflow-hidden"><div class="absolute top-0 left-0 w-full h-1 ${isJunior ? 'bg-green-400' : 'bg-blue-500'}"></div><div class="flex justify-between items-start mb-4 mt-1"><div><h4 class="text-2xl font-black text-gray-800">Class ${grade}</h4><span class="text-xs font-semibold text-gray-500 uppercase">${examCategory} Hall</span></div><span class="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-bold">Hall ${index + 1}</span></div><div class="pt-3 border-t border-gray-100 flex items-center justify-between"><div class="flex flex-col"><span class="text-[10px] font-bold text-gray-400 uppercase">Invigilator Duty</span><span class="text-base font-bold text-blue-700 flex items-center gap-1">${dutyTeacher}</span></div></div></div>`;
    });
    html += `</div></div>`; examGrid.innerHTML = html;
};

window.renderSubstituteSchedule = function() {
    const day = document.getElementById('subDay').value; const selectedDate = document.getElementById('subDate').value ? new Date(document.getElementById('subDate').value).toLocaleDateString('en-GB') : "N/A"; const subGrid = document.getElementById('subGrid');
    const absentCheckboxes = document.querySelectorAll('.absent-chk:checked'); const absentTeachers = Array.from(absentCheckboxes).map(cb => cb.value);

    if (absentTeachers.length === 0) { subGrid.innerHTML = `<div class="p-6 bg-red-50 text-red-600 font-bold border rounded-lg">Select absent teachers from the left panel.</div>`; return; }
    let vacantSlots = generatedWeeklyTimetable.filter(slot => slot.day === day && absentTeachers.includes(slot.teacherName));
    if (vacantSlots.length === 0) { subGrid.innerHTML = `<div class="p-6 bg-green-50 text-green-700 font-bold border rounded-lg">No classes scheduled for absent teachers on ${day}.</div>`; return; }

    vacantSlots.sort((a,b) => a.period.localeCompare(b.period, undefined, {numeric: true}));
    let allTeachers = [...new Set(SCHOOL_CONFIG.assignments.map(a => a.teacherName))]; let presentTeachers = allTeachers.filter(t => !absentTeachers.includes(t)); const fnLabels = SCHOOL_CONFIG.regularTimings.slice(0, 4).map(p => p.label);

    let html = `<div class="mb-4 flex justify-between items-end border-b pb-4"><div><h3 class="font-black text-2xl text-red-700 uppercase">Substitution Register</h3><p class="text-gray-600 font-bold mt-1">${selectedDate} (${day})</p></div></div><div class="overflow-x-auto"><table class="w-full text-left border-collapse bg-white shadow-sm border border-gray-200"><thead class="bg-red-50 text-red-900 border-b border-red-200"><tr><th class="p-3 border-r">Period</th><th class="p-3 border-r">Class</th><th class="p-3 border-r">Absent Teacher</th><th class="p-3">Assign Substitute</th></tr></thead><tbody>`;

    let tempDutyTracker = { ...window.subDutyTracker };
    vacantSlots.forEach(slot => {
        let slotCategory = getTeacherCategory(getGradeValue(slot.className)); let currentSlotSession = fnLabels.includes(slot.period) ? 'FN' : 'AN'; let busyThisPeriod = generatedWeeklyTimetable.filter(s => s.day === day && s.period === slot.period).map(s => s.teacherName);
        let freeTeachers = presentTeachers.filter(t => !busyThisPeriod.includes(t) && window.teacherPartTimeStatus[t] === 'FULL' && !t.includes('*') && !t.includes('⭐'));
        
        freeTeachers.sort((a, b) => { let aMatch = window.teacherLevels[a] === slotCategory ? 0 : 1, bMatch = window.teacherLevels[b] === slotCategory ? 0 : 1; if (aMatch !== bMatch) return aMatch - bMatch; let subA = tempDutyTracker[a] || 0, subB = tempDutyTracker[b] || 0; if (subA !== subB) return subA - subB; return (window.teacherWorkload[a] || 0) - (window.teacherWorkload[b] || 0); });

        let suggestedTeacher = freeTeachers.length > 0 ? freeTeachers[0] : null; if (suggestedTeacher) tempDutyTracker[suggestedTeacher] = (tempDutyTracker[suggestedTeacher] || 0) + 1;
        let optionsHtml = freeTeachers.map(t => `<option value="${t}" ${(t === suggestedTeacher) ? 'selected' : ''}>${t} (Sub: ${window.subDutyTracker[t] || 0})</option>`).join('');

        html += `<tr class="border-b hover:bg-gray-50"><td class="p-3 border-r font-bold text-gray-700">${slot.period}</td><td class="p-3 border-r font-black text-blue-800">${slot.className}</td><td class="p-3 border-r text-red-600 font-medium line-through">${slot.teacherName}</td><td class="p-3"><select class="w-full p-2 border border-gray-300 rounded font-semibold text-green-700 outline-none">${freeTeachers.length === 0 ? '<option value="">⚠️ No Free Teachers!</option>' : optionsHtml}</select></td></tr>`;
    });
    html += `</tbody></table></div>`; subGrid.innerHTML = html;
};

window.saveDutiesToCloud = async function(mode) {
    let actionType = ""; let payloadData = {};
    if (mode === 'sub') {
        const selects = document.querySelectorAll('#subGrid select'); let finalDutyTracker = { ...window.subDutyTracker }; selects.forEach(select => { if (select.value) finalDutyTracker[select.value] = (finalDutyTracker[select.value] || 0) + 1; });
        actionType = "updateSubTracker"; payloadData = finalDutyTracker;
    } else if (mode === 'exam') {
        const currentSession = document.getElementById('examSession').value; const selectedDate = document.getElementById('examDate').value ? new Date(document.getElementById('examDate').value).toLocaleDateString('en-GB') : "N/A"; const saveKey = `${selectedDate}_${currentSession}_saved`;
        if (window.dailyExamTracker[saveKey]) return alert("Exam duties already saved for this session!");
        let finalExamTracker = { ...window.examDutyTracker }; let assignedTeachers = window.dailyExamTracker[selectedDate]?.[currentSession] || []; if (assignedTeachers.length === 0) return alert("No teachers assigned.");
        assignedTeachers.forEach(t => { finalExamTracker[t] = (finalExamTracker[t] || 0) + 1; });
        actionType = "updateExamTracker"; payloadData = finalExamTracker; window.dailyExamTracker[saveKey] = true;
    }
    updateStatus("Saving Duties...");
    try { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: actionType, data: payloadData }) }); alert(`${mode.toUpperCase()} Duty counts saved!`); updateStatus("System Ready"); } catch (e) { alert("Error saving data."); }
};

// ==========================================
// 🌟 TEACHER PORTAL & PDF EXPORT
// ==========================================
function setupTeacherPortalUI() {
    let myWorkload = SCHOOL_CONFIG.assignments.filter(r => r.teacherName === currentUserName);
    const wDiv = document.getElementById('teacherWorkloadDisplay');
    wDiv.innerHTML = myWorkload.map(w => `<div class="bg-gray-50 border border-gray-200 p-3 rounded-xl flex justify-between items-center"><div><span class="font-black text-gray-800">${w.className}</span><br><span class="text-xs font-bold text-green-700">${w.subjectName}</span></div><div class="bg-white border border-gray-300 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-gray-700">${w.periodsPerWeek}</div></div>`).join('');

    const tbody = document.getElementById('restSelectorGrid'); const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class');
    tbody.innerHTML = daysOfWeek.map(day => {
        let rowHtml = `<tr><td class="p-3 border border-gray-200 font-bold text-gray-700 bg-white text-left shadow-sm">${day}</td>`;
        teachingPeriods.forEach(p => {
            let isSelected = window.dynamicRules.some(r => r.targetName === currentUserName && r.constraintType === 'Block Slot' && r.parameter === `${day}-${p.label}`);
            let colorClass = isSelected ? 'selected' : 'bg-gray-50 hover:bg-red-50 hover:border-red-300 cursor-pointer';
            rowHtml += `<td onclick="toggleRestSlot(this)" data-val="${day}-${p.label}" class="rest-slot p-2 border border-gray-200 transition-colors ${colorClass}"><div class="w-full h-8 rounded border border-transparent flex items-center justify-center text-xs font-bold text-transparent select-none">Rest</div></td>`;
        });
        return rowHtml + `</tr>`;
    }).join('');
    updateRestCount();
}

window.toggleRestSlot = function(cell) {
    let currentlySelected = document.querySelectorAll('.rest-slot.selected').length;
    if (!cell.classList.contains('selected') && currentlySelected >= 3) return alert("Max 3 rest periods allowed.");
    cell.classList.toggle('selected');
    if (cell.classList.contains('selected')) { cell.classList.remove('bg-gray-50', 'hover:bg-red-50', 'hover:border-red-300'); cell.querySelector('div').innerText = "REST"; cell.querySelector('div').classList.remove('text-transparent'); } 
    else { cell.classList.add('bg-gray-50', 'hover:bg-red-50', 'hover:border-red-300'); cell.querySelector('div').innerText = "Rest"; cell.querySelector('div').classList.add('text-transparent'); }
    updateRestCount();
};

function updateRestCount() { document.getElementById('restCountDisplay').innerText = document.querySelectorAll('.rest-slot.selected').length; }

window.submitTeacherConstraints = async function() {
    window.dynamicRules = window.dynamicRules.filter(r => !(r.targetName === currentUserName && r.constraintType === 'Block Slot'));
    document.querySelectorAll('.rest-slot.selected').forEach(slot => { window.dynamicRules.push({ ruleId: 'T_' + currentUserName + '_' + Date.now(), targetType: 'Teacher', targetName: currentUserName, constraintType: 'Block Slot', parameter: slot.dataset.val, action: 'Hard' }); });
    try { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "saveRules", data: window.dynamicRules }) }); alert("Your preferences have been locked and submitted to the Master Engine!"); } catch(err) { alert("Submission failed."); }
};

window.exportPDF = function(mode) {
    const { jsPDF } = window.jspdf;
    if (mode === 'exam') {
        const selectedDate = document.getElementById('examDate').value ? new Date(document.getElementById('examDate').value).toLocaleDateString('en-GB') : "N/A";
        const doc = new jsPDF('l', 'mm', 'a4'); doc.setFontSize(14); doc.text(`${APP_CONFIG.shortName} Exam Invigilation Schedule`, 14, 15); doc.setFontSize(11); doc.text(`Date: ${selectedDate} | Session: ${document.getElementById('examSession').value}`, 14, 25); doc.save(`Exam_Schedule.pdf`);
        return;
    } 
    if (mode === 'sub') {
        const day = document.getElementById('subDay').value; const selectedDate = document.getElementById('subDate').value ? new Date(document.getElementById('subDate').value).toLocaleDateString('en-GB') : "N/A";
        const doc = new jsPDF('l', 'mm', 'a4'); doc.setFontSize(14); doc.text(`${APP_CONFIG.shortName} Substitution Duty - ${selectedDate} (${day})`, 14, 15); doc.save(`Sub_Schedule.pdf`);
        return;
    }

    const viewType = document.getElementById('viewType')?.value || 'all'; const filterVal = document.getElementById('viewFilter')?.value || '';
    if (viewType === 'all' || !filterVal) {
        const doc = new jsPDF('p', 'mm', 'a4'); let allTeachers = [...new Set(SCHOOL_CONFIG.assignments.map(a => a.teacherName))].sort(); const cW = 90, cH = 52, marginX = 12, marginY = 12, gapX = 6, gapY = 4; let cardsOnPage = 0; const teachingPeriods = SCHOOL_CONFIG.regularTimings.filter(p => p.type === 'class'); const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; 

        allTeachers.forEach((teacher) => {
            if (cardsOnPage === 10) { doc.addPage(); cardsOnPage = 0; }
            let col = cardsOnPage % 2, row = Math.floor(cardsOnPage / 2); let x = marginX + col * (cW + gapX), y = marginY + row * (cH + gapY);

            doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3); doc.rect(x, y, cW, cH); doc.setFontSize(9); doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.text(`${APP_CONFIG.shortName} - ${teacher.length > 20 ? teacher.substring(0, 18) + "..." : teacher}`, x + 2, y + 5);

            let body = [];
            daysOfWeek.forEach((day, dIdx) => {
                let rowData = [dayLabels[dIdx]];
                teachingPeriods.forEach(period => { let slot = generatedWeeklyTimetable.find(d => d.day === day && d.period === period.label && d.teacherName === teacher); rowData.push(slot ? `${slot.className.replace(/\s+/g, '')}\n${abbreviateSubject(slot.subjectName)}` : '-'); }); body.push(rowData);
            });
            doc.autoTable({ head: [['Day', ...teachingPeriods.map((_, i) => i + 1)]], body: body, startY: y + 7, margin: { left: x + 2, bottom: 0 }, tableWidth: cW - 4, theme: 'grid', styles: { fontSize: 5.5, cellPadding: 0.8, halign: 'center', valign: 'middle', lineColor: [150, 150, 150], lineWidth: 0.1, overflow: 'linebreak' }, headStyles: { fillColor: [220, 220, 220], textColor: 20 } });
            cardsOnPage++;
        });
        doc.save(`${APP_CONFIG.shortName}_All_Teacher_Cards.pdf`);
    } else {
        const doc = new jsPDF('l', 'mm', 'a4'); doc.setFontSize(16); doc.text(`${APP_CONFIG.shortName} Timetable - ${filterVal}`, 14, 18); doc.autoTable({ html: '#scheduleTable', startY: 25, theme: 'grid', styles: { fontSize: 10, cellPadding: 4, halign: 'center', valign: 'middle' }, headStyles: { fillColor: [41, 128, 185], textColor: 255 }}); doc.save(`${APP_CONFIG.shortName}_Schedule_${filterVal.replace(' ', '_')}.pdf`);
    }
};
