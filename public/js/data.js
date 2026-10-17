/* ==========================================================================
   ST. MARTIN'S HIGH SCHOOL — FRONTEND DATA REPOSITORY
   ========================================================================== */

const InstitutionalData = {
    schoolName: "St. Martin's High School",
    location: "Balanagar, Hyderabad, Telangana",
    
    announcements: [
        {
            id: 1,
            date: "2026-04-01",
            category: "Admissions",
            title: "Admissions Open for Academic Year 2026-2027",
            description: "Applications are now being accepted across pre-primary and secondary grade levels at our Balanagar campus."
        },
        {
            id: 2,
            date: "2026-05-15",
            category: "Academic",
            title: "Summer Scholastic Term Commencement",
            description: "Notice regarding structured academic schedules and extracurricular orientation sessions."
        }
    ],

    calendarEvents: [
        { date: "June 12, 2026", event: "School Reopens for New Academic Session", category: "Administrative" },
        { date: "August 15, 2026", event: "Independence Day Commemoration & Cultural Showcase", category: "Celebration" },
        { date: "October 10, 2026", event: "Half-Yearly Examinations Begin", category: "Academic" }
    ],

    galleryCategories: [
        "Campus Architecture",
        "Science Laboratories",
        "Sports & Athletics",
        "Cultural Events",
        "Student Life"
    ]
};

// Make globally accessible for browser script bindings
window.InstitutionalData = InstitutionalData;