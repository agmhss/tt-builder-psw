/**
 * config.js - Global Configuration
 * Refined for Two-Pass Smart Distribution & Part-Time Priority
 */

const SCHOOL_CONFIG = {
    // 1. Regular Timings
    regularTimings: [
        { label: '1', start: '09:30 AM', end: '10:10 AM', type: 'class' },
        { label: '2', start: '10:10 AM', end: '10:50 AM', type: 'class' },
        { label: 'Break', start: '10:50 AM', end: '11:00 AM', type: 'break' },
        { label: '3', start: '11:00 AM', end: '11:40 AM', type: 'class' },
        { label: '4', start: '11:40 AM', end: '12:20 PM', type: 'class' },
        { label: 'Lunch', start: '12:20 PM', end: '01:00 PM', type: 'break' },
        { label: '5', start: '01:00 PM', end: '01:40 PM', type: 'class' },
        { label: '6', start: '01:40 PM', end: '02:20 PM', type: 'class' },
        { label: 'Break', start: '02:20 PM', end: '02:30 PM', type: 'break' },
        { label: '7', start: '02:30 PM', end: '03:10 PM', type: 'class' },
        { label: '8', start: '03:10 PM', end: '03:50 PM', type: 'class' }
    ],

    // 2. AUTO-CALCULATION RULES
    getPeriodsForActivity: function(activity, grade) {
        if (!activity || isNaN(grade)) return 0;
        
        grade = parseInt(grade);
        const act = activity.trim().toLowerCase();

        // பகுதி நேர ஆசிரியர்கள் (Part-time Teachers) கவனத்திற்கு:
        // Drawing மற்றும் Computer ஆகியவற்றுக்குத் தனித்தனி பீரியட் விதிகள்
        if (act.includes('drawing')) return 2; 
        if (act.includes('computer')) return 2;
        if (act.includes('pet') || act.includes('games')) return 2;

        // Primary (0-5)
        if (grade >= 0 && grade <= 5) {
            const primaryRules = { 'tamil': 6, 'english': 5, 'maths': 5, 'science': 5, 'social': 5, 'library': 2 };
            return primaryRules[act] || 0;
        }
        
        // High School (6-10)
        if (grade >= 6 && grade <= 10) {
            const hsRules = { 'tamil': 6, 'english': 6, 'maths': 6, 'science': 6, 'social': 6, 'library': 2 };
            return hsRules[act] || 0;
        }
        
        // Higher Secondary (11-12)
        if (grade >= 11) {
            if (act.startsWith('core-')) return 7; 
            return 6; // பொதுவான பாடங்கள்
        }
        
        return 0;
    },

    // 3. Exam Duty Settings
    examSettings: {
        'FN': { writingStart: '10:00 AM', juniorEnd: '12:30 PM', seniorEnd: '01:00 PM' },
        'AN': { writingStart: '01:30 PM', juniorEnd: '04:00 PM', seniorEnd: '04:30 PM' }
    },

    // 4. Exam Patterns
    examPatterns: {
        'Full School (1 to 12)': {
            'FN': ['12', '10', '8', '6', '4', '2', 'LKG'],
            'AN': ['11', '9', '7', '5', '3', '1', 'UKG']
        },
        'High & Hr.Sec Only (6 to 12)': {
            'FN': ['12', '10', '8', '6'],
            'AN': ['11', '9', '7']
        }
    },

    assignments: [] 
};
