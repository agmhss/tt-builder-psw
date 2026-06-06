/**
 * config.js - Master Configuration File
 * Smart Timetable CMS
 */

const SCHOOL_CONFIG = {
    // 🌟 1. பள்ளியின் வேலை நேரம் மற்றும் பீரியட் அமைப்புகள்
    regularTimings: [
        { label: '1', start: '09:30 AM', end: '10:10 AM', type: 'class' },
        { label: '2', start: '10:10 AM', end: '10:50 AM', type: 'class' },
        { label: 'Break', start: '10:50 AM', end: '11:00 AM', type: 'break' },
        { label: '3', start: '11:00 AM', end: '11:40 AM', type: 'class' },
        { label: '4', start: '11:40 AM', end: '12:20 PM', type: 'class' },
        { label: 'Lunch', start: '12:20 PM', end: '01:20 PM', type: 'break' },
        { label: '5', start: '01:20 PM', end: '02:00 PM', type: 'class' },
        { label: '6', start: '02:00 PM', end: '02:40 PM', type: 'class' },
        { label: 'Break', start: '02:40 PM', end: '02:50 PM', type: 'break' },
        { label: '7', start: '02:50 PM', end: '03:30 PM', type: 'class' },
        { label: '8', start: '03:30 PM', end: '04:10 PM', type: 'class' }
    ],

    // 🌟 2. தேர்வுக்கான நேர அமைப்புகள் (Exam Timings)
    examSettings: {
        FN: {
            writingStart: '10:00 AM',
            juniorEnd: '12:30 PM', // 6 to 8 Std (2.5 Hrs)
            seniorEnd: '01:00 PM'  // 9 to 12 Std (3 Hrs)
        },
        AN: {
            writingStart: '02:00 PM',
            juniorEnd: '04:30 PM', // 6 to 8 Std (2.5 Hrs)
            seniorEnd: '05:00 PM'  // 9 to 12 Std (3 Hrs)
        }
    },

    // 🌟 3. தேர்வுப் பேட்டர்ன்கள் (Exam Patterns - எந்த செஷனில் எந்த வகுப்புகளுக்குத் தேர்வு)
    examPatterns: {
        "Full School (1 to 12)": {
            FN: ['10-A', '10-B', '10-C', '10-D', '10-E', '11', '12'], // காலையில் தேர்வு எழுதும் வகுப்புகள்
            AN: ['6-A', '6-B', '6-C', '7-A', '7-B', '7-C', '8-A', '8-B', '8-C', '9-A', '9-B', '9-C', '9-D', '9-E'] // மாலையில் தேர்வு எழுதும் வகுப்புகள்
        },
        "High & Hr.Sec Only (6 to 12)": {
            FN: ['10-A', '10-B', '10-C', '10-D', '10-E', '11', '12'],
            AN: ['6-A', '6-B', '6-C', '7-A', '7-B', '7-C', '8-A', '8-B', '8-C', '9-A', '9-B', '9-C', '9-D', '9-E']
        }
    },

    // 🌟 4. Cloud Data-விற்கான தற்காலிக நினைவகம் (Do not edit this)
    assignments: []
};
