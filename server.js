
// ============================================================
// ST. MARTIN'S HIGH SCHOOL, BALANAGAR
// COMPLETE SERVER.JS
// Express + EJS + SQLite + Teacher Portal + Principal Portal
// ============================================================

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// APP CONFIGURATION
// ============================================================

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true, limit: "2mb" }));
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// DATABASE
// ============================================================

const db = new Database(path.join(__dirname, "school.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// IMPORTANT:
// Keep all SQL inside the backticks passed to db.exec().
// This prevents the "Unexpected identifier 'TABLE'" error.

db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS principals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS school_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Announcement',
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_by INTEGER,
        created_by_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES teachers(id)
            ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT NOT NULL DEFAULT 'School Event',
        event_date TEXT NOT NULL,
        start_time TEXT DEFAULT '',
        end_time TEXT DEFAULT '',
        location TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created_by INTEGER,
        created_by_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES teachers(id)
            ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teacher_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_by INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES principals(id) ON DELETE SET NULL
    );
`);

// ============================================================
// PRINCIPAL ACCOUNT INITIALIZATION
// ============================================================

async function syncPrincipalCredentials() {
    const username = (
        process.env.PRINCIPAL_USERNAME || "principal"
    ).trim();

    const password =
        process.env.PRINCIPAL_PASSWORD ||
        "ChangeThisToYourOwnStrongPassword123!";

    const existing = db.prepare(
        "SELECT id FROM principals WHERE username = ?"
    ).get(username);

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
        db.prepare(`
            UPDATE principals
            SET password_hash = ?
            WHERE id = ?
        `).run(passwordHash, existing.id);
    } else {
        db.prepare(`
            INSERT INTO principals (username, password_hash)
            VALUES (?, ?)
        `).run(username, passwordHash);
    }

    console.log("Principal account initialized.");
}

// ============================================================
// SESSION CONFIGURATION
// ============================================================

app.use(
    session({
        name: "smhs.sid",
        secret:
            process.env.SESSION_SECRET ||
            "replace-this-with-a-long-random-session-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 4 * 60 * 60 * 1000
        }
    })
);

// ============================================================
// GLOBAL EJS VARIABLES
// ============================================================

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.teacher = req.session.teacher || null;
    res.locals.principal = req.session.principal || null;

    res.locals.isTeacherLoggedIn = Boolean(req.session.teacher);
    res.locals.isPrincipalLoggedIn = Boolean(req.session.principal);

    next();
});

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

function requireTeacher(req, res, next) {
    if (!req.session.teacher) {
        if (req.originalUrl.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                message: "Please log in as a teacher."
            });
        }

        return res.redirect("/teacher-login");
    }

    next();
}

function requirePrincipal(req, res, next) {
    if (!req.session.principal) {
        if (req.originalUrl.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                message: "Please log in as the principal."
            });
        }

        return res.redirect("/principal-login");
    }

    next();
}

// ============================================================
// DATABASE HELPERS
// ============================================================

function getApprovedUpdates() {
    return db.prepare(`
        SELECT
            id,
            title,
            description,
            category,
            image_url,
            created_by_name,
            created_at
        FROM school_content
        WHERE status = 'approved'
        ORDER BY created_at DESC, id DESC
    `).all();
}

function getApprovedEvents() {
    return db.prepare(`
        SELECT
            id,
            title,
            description,
            category,
            event_date,
            start_time,
            end_time,
            location,
            created_by_name,
            created_at
        FROM calendar_events
        WHERE status = 'approved'
        ORDER BY event_date ASC, start_time ASC, id ASC
    `).all();
}

function getTeacherUpdates(teacherId) {
    return db.prepare(`
        SELECT *
        FROM school_content
        WHERE created_by = ?
        ORDER BY created_at DESC, id DESC
    `).all(teacherId);
}

function getTeacherEvents(teacherId) {
    return db.prepare(`
        SELECT *
        FROM calendar_events
        WHERE created_by = ?
        ORDER BY event_date ASC, id ASC
    `).all(teacherId);
}

function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function validTime(value) {
    if (!value) return true;

    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// ============================================================
// PUBLIC WEBSITE ROUTES
// ============================================================

app.get("/", (req, res) => {
    res.render("index", {
        title: "St. Martin's High School | Balanagar, Hyderabad"
    });
});

app.get("/about", (req, res) => {
    res.render("about", { title: "About Us" });
});

app.get("/principal", (req, res) => {
    res.render("principal", { title: "Principal's Message" });
});

app.get("/management", (req, res) => {
    res.render("management", { title: "Management" });
});

app.get("/educational-society", (req, res) => {
    res.render("educational-society", {
        title: "St. Martin's Educational Society"
    });
});

app.get("/disclosure", (req, res) => {
    res.render("disclosure", {
        title: "Mandatory Disclosure"
    });
});

app.get("/facilities", (req, res) => {
    res.render("facilities", { title: "School Facilities" });
});

app.get("/academics", (req, res) => {
    res.render("academics", { title: "Academics" });
});

app.get("/academics/:level", (req, res) => {
    const level = req.params.level.toLowerCase();

    const pages = {
        primary: {
            view: "primary",
            title: "Primary Education"
        },
        middle: {
            view: "middle",
            title: "Middle School"
        },
        secondary: {
            view: "secondary",
            title: "Secondary Education"
        },
        curriculum: {
            view: "curriculum",
            title: "Curriculum"
        },
        approach: {
            view: "approach",
            title: "Our Teaching Approach"
        }
    };

    const page = pages[level];

    if (!page) {
        return res.status(404).render("404", {
            title: "Page Not Found"
        });
    }

    res.render(page.view, { title: page.title });
});

app.get("/curriculum", (req, res) => {
    res.render("curriculum", { title: "Curriculum" });
});

app.get("/admissions", (req, res) => {
    res.render("admissions", { title: "Admissions" });
});

app.get("/fee-structure", (req, res) => {
    res.render("fee-structure", { title: "Fee Structure" });
});

// ============================================================
// STUDENT LIFE
// Teacher announcements approved by the principal are displayed
// on this page when the EJS template uses the "updates" variable.
// ============================================================

app.get("/student-life", (req, res) => {
    res.render("student-life", {
        title: "Student Life",
        updates: getApprovedUpdates(),
        events: getApprovedEvents()
    });
});

// ============================================================
// GALLERY
// ============================================================

app.get("/gallery", (req, res) => {
    res.render("gallery", { title: "School Gallery" });
});

// ============================================================
// ACADEMIC CALENDAR
// Uses the same field names expected by a dynamic calendar:
// event_date, title, category, description, start_time, end_time,
// and location.
// ============================================================

app.get("/calendar", (req, res) => {
    res.render("calendar", {
        title: "Academic Calendar",
        events: getApprovedEvents()
    });
});

// ============================================================
// NEWS & UPDATES
// ============================================================

app.get("/news", (req, res) => {
    res.render("news", {
        title: "News & Updates",
        updates: getApprovedUpdates(),
        events: getApprovedEvents()
    });
});

// ============================================================
// RESOURCES AND CONTACT
// ============================================================

app.get("/resources", (req, res) => {
    res.render("resources", { title: "Resources" });
});

app.get("/contact", (req, res) => {
    res.render("contact", { title: "Contact Us" });
});

// ============================================================
// TEACHER SIGNUP PAGE
// ============================================================

app.get(["/teacher-signup", "/teacher/signup"], (req, res) => {
    res.render("teacher-signup", {
        title: "Teacher Registration",
        error: null
    });
});

// ============================================================
// TEACHER SIGNUP API
// New accounts require principal approval.
// ============================================================

app.post("/api/teacher/signup", async (req, res, next) => {
    try {
        const fullName = cleanString(req.body.full_name);
        const employeeId = cleanString(req.body.employee_id);
        const username = cleanString(req.body.username);
        const email = cleanString(req.body.email).toLowerCase();
        const password = req.body.password || "";

        if (
            !fullName ||
            !employeeId ||
            !username ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const duplicate = db.prepare(`
            SELECT id
            FROM teachers
            WHERE username = ?
               OR email = ?
               OR employee_id = ?
        `).get(username, email, employeeId);

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Username, email, or employee ID already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        db.prepare(`
            INSERT INTO teachers (
                full_name,
                employee_id,
                username,
                email,
                password_hash,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(
            fullName,
            employeeId,
            username,
            email,
            passwordHash
        );

        return res.status(201).json({
            success: true,
            message:
                "Registration submitted. Please wait for principal approval."
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// TEACHER LOGIN PAGE
// ============================================================

app.get(["/teacher-login", "/teacher/login"], (req, res) => {
    res.render("teacher-login", {
        title: "Teacher Login",
        error: null
    });
});

// ============================================================
// TEACHER LOGIN API
// ============================================================

async function teacherLoginHandler(req, res, next) {
    try {
        const username = cleanString(req.body.username);
        const password = req.body.password || "";

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Enter your username and password."
            });
        }

        const teacher = db.prepare(`
            SELECT *
            FROM teachers
            WHERE username = ? OR email = ? OR employee_id = ?
        `).get(username, username.toLowerCase(), username);

        if (!teacher) {
            return res.status(401).json({
                success: false,
                message: "Invalid login credentials."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            teacher.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid login credentials."
            });
        }

        if (teacher.status !== "approved") {
            const message =
                teacher.status === "disabled"
                    ? "Your account has been disabled. Contact the principal."
                    : "Your account is awaiting principal approval.";

            return res.status(403).json({
                success: false,
                message
            });
        }

        req.session.teacher = {
            id: teacher.id,
            full_name: teacher.full_name,
            employee_id: teacher.employee_id,
            username: teacher.username,
            email: teacher.email,
            role: "Teacher"
        };

        req.session.save((error) => {
            if (error) return next(error);

            res.json({
                success: true,
                message: "Login successful.",
                redirect: "/teacher-dashboard"
            });
        });
    } catch (error) {
        next(error);
    }
}

app.post("/api/teacher-login", teacherLoginHandler);
app.post("/api/teacher/login", teacherLoginHandler);

// ============================================================
// TEACHER DASHBOARD
// ============================================================

app.get(
    ["/teacher-dashboard", "/teacher/dashboard"],
    requireTeacher,
    (req, res) => {
        const teacher = req.session.teacher;

        res.render("teacher-dashboard", {
            title: "Teacher Dashboard",
            teacher,
            updates: getTeacherUpdates(teacher.id),
            events: getTeacherEvents(teacher.id)
        });
    }
);

// ============================================================
// TEACHER: CREATE NEWS / ANNOUNCEMENT
//
// POST /api/teacher/updates
//
// Body fields:
// title, description, category, image_url
//
// Posts are pending until the principal approves them.
// ============================================================

app.post(
    "/api/teacher/updates",
    requireTeacher,
    (req, res) => {
        const title = cleanString(req.body.title);
        const description = cleanString(
            req.body.description || req.body.content
        );
        const category =
            cleanString(req.body.category) || "Announcement";
        const imageUrl = cleanString(req.body.image_url);

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: "Title and description are required."
            });
        }

        if (title.length > 200 || description.length > 10000) {
            return res.status(400).json({
                success: false,
                message: "The title or description is too long."
            });
        }

        if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) {
            return res.status(400).json({
                success: false,
                message: "Image URL must be a valid HTTP or HTTPS URL."
            });
        }

        const result = db.prepare(`
            INSERT INTO school_content (
                title,
                description,
                category,
                image_url,
                status,
                created_by,
                created_by_name
            )
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).run(
            title,
            description,
            category,
            imageUrl || null,
            req.session.teacher.id,
            req.session.teacher.full_name
        );

        res.status(201).json({
            success: true,
            message: "Announcement submitted for principal approval.",
            id: result.lastInsertRowid
        });
    }
);

// ============================================================
// TEACHER: LIST OWN ANNOUNCEMENTS
// ============================================================

app.get(
    "/api/teacher/updates",
    requireTeacher,
    (req, res) => {
        res.json({
            success: true,
            updates: getTeacherUpdates(req.session.teacher.id)
        });
    }
);

// ============================================================
// TEACHER: DELETE OWN ANNOUNCEMENT
// ============================================================

app.delete(
    "/api/teacher/updates/:id",
    requireTeacher,
    (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement ID."
            });
        }

        const result = db.prepare(`
            DELETE FROM school_content
            WHERE id = ?
              AND created_by = ?
              AND status = 'pending'
        `).run(id, req.session.teacher.id);

        if (!result.changes) {
            return res.status(404).json({
                success: false,
                message:
                    "Announcement not found, or it has already been reviewed."
            });
        }

        res.json({
            success: true,
            message: "Announcement deleted."
        });
    }
);

// ============================================================
// TEACHER: CREATE CALENDAR EVENT
//
// POST /api/teacher/events
//
// Required: title, event_date
// Optional: description, category, start_time, end_time, location
// ============================================================

app.post(
    "/api/teacher/events",
    requireTeacher,
    (req, res) => {
        const title = cleanString(req.body.title);
        const description = cleanString(req.body.description);
        const category =
            cleanString(req.body.category) || "School Event";
        const eventDate = cleanString(
            req.body.event_date || req.body.date
        );
        const startTime = cleanString(req.body.start_time);
        const endTime = cleanString(req.body.end_time);
        const location = cleanString(req.body.location);

        if (!title || !validDate(eventDate)) {
            return res.status(400).json({
                success: false,
                message: "Enter a title and a valid event date (YYYY-MM-DD)."
            });
        }

        if (
            !validTime(startTime) ||
            !validTime(endTime)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter times in 24-hour HH:MM format."
            });
        }

        if (
            title.length > 200 ||
            description.length > 10000 ||
            location.length > 300
        ) {
            return res.status(400).json({
                success: false,
                message: "One or more fields exceed the allowed length."
            });
        }

        const result = db.prepare(`
            INSERT INTO calendar_events (
                title,
                description,
                category,
                event_date,
                start_time,
                end_time,
                location,
                status,
                created_by,
                created_by_name
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
            title,
            description,
            category,
            eventDate,
            startTime,
            endTime,
            location,
            req.session.teacher.id,
            req.session.teacher.full_name
        );

        res.status(201).json({
            success: true,
            message: "Calendar event submitted for principal approval.",
            id: result.lastInsertRowid
        });
    }
);

// ============================================================
// TEACHER: LIST OWN EVENTS
// ============================================================

app.get(
    "/api/teacher/events",
    requireTeacher,
    (req, res) => {
        res.json({
            success: true,
            events: getTeacherEvents(req.session.teacher.id)
        });
    }
);

// ============================================================
// TEACHER: DELETE OWN PENDING EVENT
// ============================================================

app.delete(
    "/api/teacher/events/:id",
    requireTeacher,
    (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID."
            });
        }

        const result = db.prepare(`
            DELETE FROM calendar_events
            WHERE id = ?
              AND created_by = ?
              AND status = 'pending'
        `).run(id, req.session.teacher.id);

        if (!result.changes) {
            return res.status(404).json({
                success: false,
                message:
                    "Event not found, or it has already been reviewed."
            });
        }

        res.json({
            success: true,
            message: "Event deleted."
        });
    }
);

// ============================================================
// PRINCIPAL LOGIN PAGE
// ============================================================

app.get("/principal-login", (req, res) => {
    res.render("principal-login", {
        title: "Principal Login",
        error: null
    });
});

// ============================================================
// PRINCIPAL LOGIN API
// ============================================================

app.post(
    ["/api/principal/login", "/api/principal-login"],
    async (req, res, next) => {
        try {
            const username = cleanString(req.body.username);
            const password = req.body.password || "";

            const principal = db.prepare(`
                SELECT *
                FROM principals
                WHERE username = ?
            `).get(username);

            if (
                !principal ||
                !(await bcrypt.compare(
                    password,
                    principal.password_hash
                ))
            ) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid principal login credentials."
                });
            }

            req.session.principal = {
                id: principal.id,
                username: principal.username,
                role: "Principal"
            };

            req.session.save((error) => {
                if (error) return next(error);

                res.json({
                    success: true,
                    message: "Login successful.",
                    redirect: "/principal-dashboard"
                });
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================
// PRINCIPAL DASHBOARD
// ============================================================

app.get(
    "/principal-dashboard",
    requirePrincipal,
    (req, res) => {
        const pendingTeachers = db.prepare(`
            SELECT id, full_name, employee_id, username, email,
                   status, created_at
            FROM teachers
            WHERE status = 'pending'
            ORDER BY created_at DESC
        `).all();

        const pendingUpdates = db.prepare(`
            SELECT *
            FROM school_content
            WHERE status = 'pending'
            ORDER BY created_at DESC
        `).all();

        const pendingEvents = db.prepare(`
            SELECT *
            FROM calendar_events
            WHERE status = 'pending'
            ORDER BY event_date ASC
        `).all();

        res.render("principal-dashboard", {
            title: "Principal Dashboard",
            principal: req.session.principal,
            teachers: pendingTeachers,
            pendingTeachers,
            pendingUpdates,
            pendingEvents
        });
    }
);

// ============================================================
// PRINCIPAL: LIST TEACHERS
// ============================================================

app.get(
    "/api/principal/teachers",
    requirePrincipal,
    (req, res) => {
        const teachers = db.prepare(`
            SELECT
                id,
                full_name,
                employee_id,
                username,
                email,
                status,
                created_at,
                approved_at
            FROM teachers
            ORDER BY created_at DESC
        `).all();

        res.json({ success: true, teachers });
    }
);

// ============================================================
// PRINCIPAL: CREATE AN APPROVED TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/create",
    requirePrincipal,
    async (req, res, next) => {
        try {
            const fullName = cleanString(req.body.full_name);
            const employeeId = cleanString(req.body.employee_id);
            const username = cleanString(req.body.username);
            const email = cleanString(req.body.email).toLowerCase();
            const password = req.body.password || "";

            if (
                !fullName ||
                !employeeId ||
                !username ||
                !email ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Complete all required fields."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "Password must contain at least 8 characters."
                });
            }

            const duplicate = db.prepare(`
                SELECT id
                FROM teachers
                WHERE username = ?
                   OR email = ?
                   OR employee_id = ?
            `).get(username, email, employeeId);

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Username, email, or employee ID already exists."
                });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const result = db.prepare(`
                INSERT INTO teachers (
                    full_name,
                    employee_id,
                    username,
                    email,
                    password_hash,
                    status,
                    approved_at
                )
                VALUES (?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP)
            `).run(
                fullName,
                employeeId,
                username,
                email,
                passwordHash
            );

            res.status(201).json({
                success: true,
                message: "Teacher account created and approved.",
                id: result.lastInsertRowid
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================
// PRINCIPAL: APPROVE OR REJECT TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/:id/approve",
    requirePrincipal,
    (req, res) => {
        const id = Number(req.params.id);

        const result = db.prepare(`
            UPDATE teachers
            SET status = 'approved',
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'pending'
        `).run(id);

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Teacher approved."
                : "Pending teacher not found."
        });
    }
);

app.post(
    "/api/principal/teachers/:id/reject",
    requirePrincipal,
    (req, res) => {
        const id = Number(req.params.id);

        const result = db.prepare(`
            DELETE FROM teachers
            WHERE id = ?
              AND status = 'pending'
        `).run(id);

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Teacher registration rejected."
                : "Pending teacher not found."
        });
    }
);

// ============================================================
// PRINCIPAL: DISABLE OR REACTIVATE TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/:id/disable",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE teachers
            SET status = 'disabled'
            WHERE id = ?
        `).run(Number(req.params.id));

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Teacher account disabled."
                : "Teacher not found."
        });
    }
);

app.post(
    "/api/principal/teachers/:id/reactivate",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE teachers
            SET status = 'approved',
                approved_at = COALESCE(
                    approved_at,
                    CURRENT_TIMESTAMP
                )
            WHERE id = ?
              AND status = 'disabled'
        `).run(Number(req.params.id));

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Teacher account reactivated."
                : "Disabled teacher not found."
        });
    }
);

// ============================================================
// PRINCIPAL: VIEW SCHOOL ANNOUNCEMENTS
// ============================================================

app.get(
    "/api/principal/updates",
    requirePrincipal,
    (req, res) => {
        const updates = db.prepare(`
            SELECT *
            FROM school_content
            ORDER BY created_at DESC
        `).all();

        res.json({ success: true, updates });
    }
);

// ============================================================
// PRINCIPAL: APPROVE / REJECT ANNOUNCEMENTS
// ============================================================

app.post(
    "/api/principal/updates/:id/approve",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE school_content
            SET status = 'approved'
            WHERE id = ?
              AND status = 'pending'
        `).run(Number(req.params.id));

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Announcement approved and published."
                : "Pending announcement not found."
        });
    }
);

app.post(
    "/api/principal/updates/:id/reject",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            DELETE FROM school_content
            WHERE id = ?
              AND status = 'pending'
        `).run(Number(req.params.id));

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Announcement rejected."
                : "Pending announcement not found."
        });
    }
);

// ============================================================
// PRINCIPAL: VIEW CALENDAR EVENTS
// ============================================================

app.get(
    "/api/principal/events",
    requirePrincipal,
    (req, res) => {
        const events = db.prepare(`
            SELECT *
            FROM calendar_events
            ORDER BY event_date ASC
        `).all();

        res.json({ success: true, events });
    }
);

// ============================================================
// PRINCIPAL: APPROVE / REJECT CALENDAR EVENTS
// ============================================================

app.post(
    "/api/principal/events/:id/approve",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE calendar_events
            SET status = 'approved'
            WHERE id = ?
              AND status = 'pending'
        `).run(Number(req.params.id));

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Event approved and published."
                : "Pending event not found."
        });
    }
);

app.post(
    "/api/principal/events/:id/reject",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            DELETE FROM calendar_events
            WHERE id = ?
              AND status = 'pending'
        `).run(Number(req.params.id));

        res.json({
            success: Boolean(result.changes),
            message: result.changes
                ? "Event rejected."
                : "Pending event not found."
        });
    }
);

// ============================================================
// LOGOUT
// ============================================================

function logoutHandler(req, res, next) {
    req.session.destroy((error) => {
        if (error) return next(error);

        res.clearCookie("smhs.sid");
        res.redirect("/");
    });
}

app.get(
    ["/teacher-logout", "/teacher/logout"],
    logoutHandler
);

app.get("/principal-logout", logoutHandler);

app.post("/api/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);

        res.clearCookie("smhs.sid");

        res.json({
            success: true,
            redirect: "/"
        });
    });
});

// ============================================================
// REVIEWS API
// ============================================================

app.post("/api/reviews", (req, res) => {
    const name = cleanString(req.body.name);
    const email = cleanString(req.body.email);
    const message = cleanString(
        req.body.message || req.body.review
    );

    if (!name || !message) {
        return res.status(400).json({
            success: false,
            message: "Name and review are required."
        });
    }

    if (name.length > 150 || message.length > 5000) {
        return res.status(400).json({
            success: false,
            message: "Your review exceeds the allowed length."
        });
    }

    db.prepare(`
        INSERT INTO reviews (name, email, message, status)
        VALUES (?, ?, ?, 'pending')
    `).run(name, email, message);

    res.status(201).json({
        success: true,
        message: "Thank you! Your review has been submitted for approval."
    });
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
    res.status(404).render("404", {
        title: "Page Not Found"
    });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    if (res.headersSent) {
        return next(error);
    }

    if (req.originalUrl.startsWith("/api/")) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred."
        });
    }

    res.status(500).send(
        "Something went wrong. Please try again later."
    );
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
    try {
        await syncPrincipalCredentials();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                `St. Martin's High School server running on port ${PORT}`
            );
        });
    } catch (error) {
        console.error("Failed to initialize the server:", error);
        process.exit(1);
    }
}

startServer();
