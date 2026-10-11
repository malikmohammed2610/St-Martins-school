```js
// ============================================================
// ST. MARTIN'S HIGH SCHOOL — BALANAGAR, HYDERABAD
// COMPLETE EXPRESS SERVER
// Teacher + Principal Authentication
// SQLite + bcrypt + Content Management + Academic Calendar
// ============================================================

const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// PRODUCTION SETTINGS
// ============================================================

app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// ============================================================
// DATABASE
// ============================================================

const dbPath = path.join(__dirname, "school.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// TEACHERS TABLE
// ============================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT
    )
`).run();

// ============================================================
// PRINCIPALS TABLE
// ============================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS principals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// ============================================================
// SCHOOL CONTENT TABLE
// Student Life and News submissions
// ============================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS school_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        content_type TEXT NOT NULL
            CHECK (content_type IN ('student-life', 'news')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        image_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    )
`).run();

// ============================================================
// ACADEMIC CALENDAR EVENTS TABLE
// ============================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        event_date TEXT NOT NULL,
        start_time TEXT NOT NULL DEFAULT '',
        end_time TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'School Event',
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    )
`).run();

// ============================================================
// REVIEWS TABLE
// Reviews are saved as pending until approved
// ============================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS school_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_name TEXT NOT NULL,
        email TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT
    )
`).run();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));

app.use(express.json({
    limit: "1mb"
}));

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(session({
    name: "stmartins.sid",

    secret:
        process.env.SESSION_SECRET ||
        "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_BEFORE_DEPLOYMENT",

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 4
    }
}));

// ============================================================
// GLOBAL EJS VARIABLES
// ============================================================

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.teacher = req.session.teacher || null;
    res.locals.principal = req.session.principal || null;

    res.locals.isTeacherLoggedIn =
        Boolean(req.session.teacher);

    res.locals.isPrincipalLoggedIn =
        Boolean(req.session.principal);

    next();
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function requireTeacher(req, res, next) {
    if (!req.session.teacher) {
        if (req.path.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                error: "Please log in as a teacher first."
            });
        }

        return res.redirect("/teacher-login");
    }

    next();
}

function requirePrincipal(req, res, next) {
    if (!req.session.principal) {
        if (req.path.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                error: "Please log in as Principal first."
            });
        }

        return res.redirect("/principal-login");
    }

    next();
}

function render404(req, res) {
    return res.status(404).render("404", {
        title: "Page Not Found | St. Martin's High School"
    });
}

function databaseError(res, message, error) {
    console.error(message, error);

    if (res.headersSent) {
        return;
    }

    return res.status(500).json({
        success: false,
        error: "A server error occurred. Please try again."
    });
}

// ============================================================
// PRINCIPAL CREDENTIAL SYNCHRONIZATION
// Configure PRINCIPAL_USERNAME and PRINCIPAL_PASSWORD in .env
// ============================================================

async function syncPrincipalCredentials() {
    const username = String(
        process.env.PRINCIPAL_USERNAME || "principal"
    ).trim().toLowerCase();

    const password =
        process.env.PRINCIPAL_PASSWORD ||
        "ChangeThisToYourOwnStrongPassword123!";

    if (!username || !password) {
        throw new Error(
            "Principal username and password must not be empty."
        );
    }

    if (password.length < 12) {
        throw new Error(
            "Set PRINCIPAL_PASSWORD to at least 12 characters."
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const existingPrincipal = db.prepare(`
        SELECT id
        FROM principals
        ORDER BY id ASC
        LIMIT 1
    `).get();

    if (existingPrincipal) {
        db.prepare(`
            UPDATE principals
            SET username = ?, password_hash = ?
            WHERE id = ?
        `).run(
            username,
            passwordHash,
            existingPrincipal.id
        );
    } else {
        db.prepare(`
            INSERT INTO principals (username, password_hash)
            VALUES (?, ?)
        `).run(username, passwordHash);
    }

    console.log("Principal credentials synchronized from .env.");
}

// ============================================================
// PUBLIC SCHOOL PAGES
// ============================================================

app.get("/", (req, res) => {
    res.render("index", {
        title: "St. Martin's High School | Balanagar, Hyderabad"
    });
});

app.get("/about", (req, res) => {
    res.render("about", {
        title: "School Overview | St. Martin's High School"
    });
});

app.get("/principal", (req, res) => {
    res.render("principal", {
        title: "Principal & Management | St. Martin's High School"
    });
});

app.get("/management", (req, res) => {
    res.render("management", {
        title: "Management | St. Martin's High School"
    });
});

app.get("/educational-society", (req, res) => {
    res.render("educational-society", {
        title: "Educational Society | St. Martin's High School"
    });
});

app.get("/disclosure", (req, res) => {
    res.render("disclosure", {
        title: "Mandatory Disclosure | St. Martin's High School"
    });
});

app.get("/facilities", (req, res) => {
    res.render("facilities", {
        title: "Our Facilities | St. Martin's High School"
    });
});

app.get("/academics", (req, res) => {
    res.render("academics", {
        title: "Academics | St. Martin's High School"
    });
});

// ============================================================
// ACADEMIC SUB-PAGES
// ============================================================

app.get("/academics/:level", (req, res) => {
    const level = String(req.params.level)
        .toLowerCase()
        .trim();

    const academicPages = {
        primary: {
            view: "academics-primary",
            title: "Primary School | St. Martin's High School"
        },

        middle: {
            view: "academics-middle",
            title: "Middle School | St. Martin's High School"
        },

        secondary: {
            view: "academics-secondary",
            title: "Secondary School | St. Martin's High School"
        },

        curriculum: {
            view: "curriculum",
            title: "Curriculum & Academic Programme | St. Martin's High School"
        },

        approach: {
            view: "academics-approach",
            title: "Academic Approach | St. Martin's High School"
        }
    };

    const page = academicPages[level];

    if (!page) {
        return render404(req, res);
    }

    res.render(page.view, {
        title: page.title
    });
});

app.get("/curriculum", (req, res) => {
    res.render("curriculum", {
        title: "Curriculum & Academic Programme | St. Martin's High School"
    });
});

app.get("/admissions", (req, res) => {
    res.render("admissions", {
        title: "Admissions | St. Martin's High School"
    });
});

app.get("/fee-structure", (req, res) => {
    res.render("fee-structure", {
        title: "Fee Structure | St. Martin's High School"
    });
});

// ============================================================
// STUDENT LIFE
// Only Principal-approved updates appear publicly
// ============================================================

app.get("/student-life", (req, res) => {
    try {
        const updates = db.prepare(`
            SELECT
                id,
                title,
                summary,
                content,
                image_url,
                created_at
            FROM school_content
            WHERE content_type = 'student-life'
              AND status = 'approved'
            ORDER BY created_at DESC
        `).all();

        res.render("student-life", {
            title: "Student Life | St. Martin's High School",
            updates
        });
    } catch (error) {
        console.error("Student Life route error:", error);
        res.status(500).send(
            "Unable to load Student Life updates. Check the server terminal."
        );
    }
});

// ============================================================
// GALLERY
// ============================================================

app.get("/gallery", (req, res) => {
    res.render("gallery", {
        title: "Gallery | St. Martin's High School"
    });
});

// ============================================================
// ACADEMIC CALENDAR
// Only approved events appear publicly
// ============================================================

app.get("/calendar", (req, res) => {
    try {
        const events = db.prepare(`
            SELECT
                id,
                title,
                description,
                event_date,
                start_time,
                end_time,
                location,
                category,
                created_at
            FROM calendar_events
            WHERE status = 'approved'
            ORDER BY event_date ASC, start_time ASC
        `).all();

        res.render("calendar", {
            title: "School Calendar | St. Martin's High School",
            events
        });
    } catch (error) {
        console.error("Calendar route error:", error);
        res.status(500).send(
            "Unable to load the Academic Calendar. Check the server terminal."
        );
    }
});

// ============================================================
// NEWS & UPDATES
// Approved news and approved school events
// ============================================================

app.get("/news", (req, res) => {
    try {
        const updates = db.prepare(`
            SELECT
                id,
                title,
                summary,
                content,
                image_url,
                created_at
            FROM school_content
            WHERE content_type = 'news'
              AND status = 'approved'
            ORDER BY created_at DESC
        `).all();

        const events = db.prepare(`
            SELECT
                id,
                title,
                description,
                event_date,
                start_time,
                end_time,
                location,
                category
            FROM calendar_events
            WHERE status = 'approved'
            ORDER BY event_date ASC, start_time ASC
        `).all();

        res.render("news", {
            title: "News & Updates | St. Martin's High School",
            updates,
            events
        });
    } catch (error) {
        console.error("News route error:", error);
        res.status(500).send(
            "Unable to load News & Updates. Check the server terminal."
        );
    }
});

app.get("/resources", (req, res) => {
    res.render("resources", {
        title: "Resources | St. Martin's High School"
    });
});

app.get("/contact", (req, res) => {
    res.render("contact", {
        title: "Contact Us | St. Martin's High School"
    });
});

// ============================================================
// TEACHER LOGIN + SIGNUP PAGES
// Supports both /teacher-login and /teacher/login
// ============================================================

function renderTeacherLogin(req, res) {
    if (req.session.teacher) {
        return res.redirect("/teacher-dashboard");
    }

    res.render("teacher-login", {
        title: "Teacher Login | St. Martin's High School",
        error: null
    });
}

app.get("/teacher-login", renderTeacherLogin);
app.get("/teacher/login", renderTeacherLogin);

app.get("/teacher-signup", (req, res) => {
    if (req.session.teacher) {
        return res.redirect("/teacher-dashboard");
    }

    res.render("teacher-signup", {
        title: "Teacher Registration | St. Martin's High School",
        error: null
    });
});

// ============================================================
// TEACHER REGISTRATION API
// ============================================================

app.post("/api/teacher/signup", async (req, res, next) => {
    try {
        const fullName = cleanString(req.body.full_name);
        const employeeId = cleanString(req.body.employee_id);
        const username = cleanString(req.body.username).toLowerCase();
        const email = cleanString(req.body.email).toLowerCase();

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";

        const confirmPassword =
            typeof req.body.confirm_password === "string"
                ? req.body.confirm_password
                : "";

        if (
            !fullName ||
            !employeeId ||
            !username ||
            !email ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                error: "All fields are required."
            });
        }

        if (fullName.length < 2 || employeeId.length < 2) {
            return res.status(400).json({
                success: false,
                error: "Enter a valid name and Employee ID."
            });
        }

        if (username.length < 4) {
            return res.status(400).json({
                success: false,
                error: "Username must contain at least 4 characters."
            });
        }

        if (!validEmail(email)) {
            return res.status(400).json({
                success: false,
                error: "Enter a valid email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: "Password must contain at least 8 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: "Passwords do not match."
            });
        }

        const existing = db.prepare(`
            SELECT username, employee_id, email
            FROM teachers
            WHERE username = ?
               OR employee_id = ?
               OR email = ?
            LIMIT 1
        `).get(username, employeeId, email);

        if (existing) {
            let message = "Teacher details are already registered.";

            if (existing.username === username) {
                message = "That username is already registered.";
            } else if (existing.employee_id === employeeId) {
                message = "That Employee ID is already registered.";
            } else if (existing.email === email) {
                message = "That email address is already registered.";
            }

            return res.status(409).json({
                success: false,
                error: message
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

        res.status(201).json({
            success: true,
            message: "Registration submitted. Please wait for Principal approval."
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// TEACHER LOGIN API
// ============================================================

app.post("/api/teacher-login", async (req, res, next) => {
    try {
        const username = cleanString(req.body.username).toLowerCase();

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: "Username and password are required."
            });
        }

        const teacher = db.prepare(`
            SELECT *
            FROM teachers
            WHERE username = ?
        `).get(username);

        if (
            !teacher ||
            !(await bcrypt.compare(password, teacher.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                error: "Invalid username or password."
            });
        }

        if (teacher.status === "pending") {
            return res.status(403).json({
                success: false,
                error: "Your account is waiting for Principal approval."
            });
        }

        if (teacher.status === "rejected") {
            return res.status(403).json({
                success: false,
                error: "Your teacher registration has been rejected."
            });
        }

        if (teacher.status === "disabled") {
            return res.status(403).json({
                success: false,
                error: "Your account has been disabled. Contact the Principal."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return next(error);
            }

            req.session.teacher = {
                id: teacher.id,
                full_name: teacher.full_name,
                employee_id: teacher.employee_id,
                username: teacher.username,
                email: teacher.email,
                role: "Teacher"
            };

            req.session.save((saveError) => {
                if (saveError) {
                    return next(saveError);
                }

                res.json({
                    success: true,
                    message: "Login successful.",
                    redirect: "/teacher-dashboard"
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// TEACHER DASHBOARD
// Includes the logged-in teacher's own submissions
// ============================================================

app.get("/teacher-dashboard", requireTeacher, (req, res) => {
    try {
        const teacherId = req.session.teacher.id;

        const content = db.prepare(`
            SELECT *
            FROM school_content
            WHERE teacher_id = ?
            ORDER BY created_at DESC
        `).all(teacherId);

        const events = db.prepare(`
            SELECT *
            FROM calendar_events
            WHERE teacher_id = ?
            ORDER BY event_date ASC, start_time ASC
        `).all(teacherId);

        res.render("teacher-dashboard", {
            title: "Teacher Dashboard | St. Martin's High School",
            teacher: req.session.teacher,
            content,
            events
        });
    } catch (error) {
        console.error("Teacher dashboard error:", error);
        res.status(500).send(
            "Unable to load Teacher Dashboard. Check the server terminal."
        );
    }
});

// ============================================================
// TEACHER CONTENT API
// GET: own submissions
// POST: submit Student Life or News
// ============================================================

app.get("/api/teacher/content", requireTeacher, (req, res) => {
    try {
        const items = db.prepare(`
            SELECT *
            FROM school_content
            WHERE teacher_id = ?
            ORDER BY created_at DESC
        `).all(req.session.teacher.id);

        res.json({
            success: true,
            items
        });
    } catch (error) {
        databaseError(res, "Teacher content list error:", error);
    }
});

app.post("/api/teacher/content", requireTeacher, (req, res) => {
    try {
        const contentType = cleanString(req.body.content_type);
        const title = cleanString(req.body.title);
        const summary = cleanString(req.body.summary);
        const content = cleanString(req.body.content);
        const imageUrl = cleanString(req.body.image_url);

        if (!["student-life", "news"].includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: "Choose Student Life or News."
            });
        }

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: "Title and content are required."
            });
        }

        if (
            title.length > 180 ||
            summary.length > 500 ||
            content.length > 10000
        ) {
            return res.status(400).json({
                success: false,
                error: "One or more fields exceed the allowed length."
            });
        }

        if (
            imageUrl &&
            !/^https?:\/\/[^\s]+$/i.test(imageUrl) &&
            !/^\/[A-Za-z0-9/_\-.%]+$/.test(imageUrl)
        ) {
            return res.status(400).json({
                success: false,
                error: "Use an HTTP(S) image URL or a local path beginning with /."
            });
        }

        const result = db.prepare(`
            INSERT INTO school_content (
                teacher_id,
                content_type,
                title,
                summary,
                content,
                image_url,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).run(
            req.session.teacher.id,
            contentType,
            title,
            summary,
            content,
            imageUrl
        );

        res.status(201).json({
            success: true,
            id: result.lastInsertRowid,
            message: "Submitted successfully. The Principal must approve it before publication."
        });
    } catch (error) {
        databaseError(res, "Teacher content submission error:", error);
    }
});

// ============================================================
// TEACHER CALENDAR API
// GET: own event submissions
// POST: submit event for approval
// ============================================================

app.get("/api/teacher/events", requireTeacher, (req, res) => {
    try {
        const events = db.prepare(`
            SELECT *
            FROM calendar_events
            WHERE teacher_id = ?
            ORDER BY event_date ASC, start_time ASC
        `).all(req.session.teacher.id);

        res.json({
            success: true,
            events
        });
    } catch (error) {
        databaseError(res, "Teacher event list error:", error);
    }
});

app.post("/api/teacher/events", requireTeacher, (req, res) => {
    try {
        const title = cleanString(req.body.title);
        const description = cleanString(req.body.description);
        const eventDate = cleanString(req.body.event_date);
        const startTime = cleanString(req.body.start_time);
        const endTime = cleanString(req.body.end_time);
        const location = cleanString(req.body.location);
        const category = cleanString(req.body.category) || "School Event";

        if (!title || !eventDate) {
            return res.status(400).json({
                success: false,
                error: "Event title and date are required."
            });
        }

        if (!validISODate(eventDate)) {
            return res.status(400).json({
                success: false,
                error: "Enter a valid date in YYYY-MM-DD format."
            });
        }

        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

        if (
            (startTime && !timePattern.test(startTime)) ||
            (endTime && !timePattern.test(endTime))
        ) {
            return res.status(400).json({
                success: false,
                error: "Enter times in 24-hour HH:MM format."
            });
        }

        if (
            title.length > 180 ||
            description.length > 5000 ||
            location.length > 250 ||
            category.length > 80
        ) {
            return res.status(400).json({
                success: false,
                error: "One or more event fields are too long."
            });
        }

        db.prepare(`
            INSERT INTO calendar_events (
                teacher_id,
                title,
                description,
                event_date,
                start_time,
                end_time,
                location,
                category,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(
            req.session.teacher.id,
            title,
            description,
            eventDate,
            startTime,
            endTime,
            location,
            category
        );

        res.status(201).json({
            success: true,
            message: "Event submitted. It will appear after Principal approval."
        });
    } catch (error) {
        databaseError(res, "Teacher event submission error:", error);
    }
});

// ============================================================
// PRINCIPAL LOGIN PAGE
// ============================================================

app.get("/principal-login", (req, res) => {
    if (req.session.principal) {
        return res.redirect("/principal-dashboard");
    }

    res.render("principal-login", {
        title: "Principal Login | St. Martin's High School",
        error: null
    });
});

// ============================================================
// PRINCIPAL LOGIN API
// ============================================================

app.post("/api/principal/login", async (req, res, next) => {
    try {
        const username = cleanString(req.body.username).toLowerCase();

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: "Username and password are required."
            });
        }

        const principal = db.prepare(`
            SELECT *
            FROM principals
            WHERE username = ?
        `).get(username);

        if (
            !principal ||
            !(await bcrypt.compare(password, principal.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                error: "Invalid Principal credentials."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return next(error);
            }

            req.session.principal = {
                id: principal.id,
                username: principal.username,
                role: "Principal"
            };

            req.session.save((saveError) => {
                if (saveError) {
                    return next(saveError);
                }

                res.json({
                    success: true,
                    message: "Principal login successful.",
                    redirect: "/principal-dashboard"
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// PRINCIPAL DASHBOARD
// Supplies teachers, content and events for the dashboard
// ============================================================

app.get("/principal-dashboard", requirePrincipal, (req, res) => {
    try {
        const pendingTeachers = db.prepare(`
            SELECT id, full_name, employee_id, username, email,
                   status, created_at, approved_at
            FROM teachers
            WHERE status = 'pending'
            ORDER BY created_at ASC
        `).all();

        const teachers = db.prepare(`
            SELECT id, full_name, employee_id, username, email,
                   status, created_at, approved_at
            FROM teachers
            ORDER BY created_at DESC
        `).all();

        const content = db.prepare(`
            SELECT c.*, t.full_name AS teacher_name
            FROM school_content c
            JOIN teachers t ON t.id = c.teacher_id
            ORDER BY
                CASE c.status WHEN 'pending' THEN 0 ELSE 1 END,
                c.created_at DESC
        `).all();

        const events = db.prepare(`
            SELECT e.*, t.full_name AS teacher_name
            FROM calendar_events e
            JOIN teachers t ON t.id = e.teacher_id
            ORDER BY
                CASE e.status WHEN 'pending' THEN 0 ELSE 1 END,
                e.event_date ASC
        `).all();

        const reviews = db.prepare(`
            SELECT *
            FROM school_reviews
            ORDER BY
                CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                created_at DESC
        `).all();

        res.render("principal-dashboard", {
            title: "Principal Dashboard | St. Martin's High School",
            principal: req.session.principal,
            pendingTeachers,
            teachers,
            content,
            events,
            reviews
        });
    } catch (error) {
        console.error("Principal dashboard error:", error);
        res.status(500).send(
            "Unable to load Principal Dashboard. Check the server terminal."
        );
    }
});

// ============================================================
// PRINCIPAL: LIST TEACHERS
// ============================================================

app.get("/api/principal/teachers", requirePrincipal, (req, res) => {
    try {
        const teachers = db.prepare(`
            SELECT id, full_name, employee_id, username, email,
                   status, created_at, approved_at
            FROM teachers
            ORDER BY created_at DESC
        `).all();

        res.json({
            success: true,
            teachers
        });
    } catch (error) {
        databaseError(res, "Teacher list error:", error);
    }
});

// ============================================================
// PRINCIPAL: CREATE APPROVED TEACHER ACCOUNT
// ============================================================

app.post("/api/principal/teachers/create", requirePrincipal, async (req, res, next) => {
    try {
        const fullName = cleanString(req.body.full_name);
        const employeeId = cleanString(req.body.employee_id);
        const username = cleanString(req.body.username).toLowerCase();
        const email = cleanString(req.body.email).toLowerCase();

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";

        const confirmPassword =
            typeof req.body.confirm_password === "string"
                ? req.body.confirm_password
                : "";

        if (
            !fullName ||
            !employeeId ||
            !username ||
            !email ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                error: "All fields are required."
            });
        }

        if (
            fullName.length < 2 ||
            employeeId.length < 2 ||
            username.length < 4
        ) {
            return res.status(400).json({
                success: false,
                error: "Enter a valid name, Employee ID and username."
            });
        }

        if (!validEmail(email)) {
            return res.status(400).json({
                success: false,
                error: "Enter a valid email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: "Password must contain at least 8 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: "Passwords do not match."
            });
        }

        const existing = db.prepare(`
            SELECT username, employee_id, email
            FROM teachers
            WHERE username = ?
               OR employee_id = ?
               OR email = ?
            LIMIT 1
        `).get(username, employeeId, email);

        if (existing) {
            let message = "Teacher details already exist.";

            if (existing.username === username) {
                message = "That username is already in use.";
            } else if (existing.employee_id === employeeId) {
                message = "That Employee ID is already registered.";
            } else if (existing.email === email) {
                message = "That email address is already registered.";
            }

            return res.status(409).json({
                success: false,
                error: message
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
            message: "Teacher created successfully. They can now log in."
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// PRINCIPAL: APPROVE, REJECT, DISABLE OR REACTIVATE TEACHERS
// ============================================================

function updateTeacherStatus(req, res, status) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                error: "Invalid teacher ID."
            });
        }

        let result;

        if (status === "approved") {
            result = db.prepare(`
                UPDATE teachers
                SET status = 'approved',
                    approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP)
                WHERE id = ?
            `).run(id);
        } else {
            result = db.prepare(`
                UPDATE teachers
                SET status = ?,
                    approved_at = NULL
                WHERE id = ?
            `).run(status, id);
        }

        if (!result.changes) {
            return res.status(404).json({
                success: false,
                error: "Teacher account not found."
            });
        }

        res.json({
            success: true,
            message: `Teacher account ${status}.`
        });
    } catch (error) {
        databaseError(res, "Teacher status update error:", error);
    }
}

app.post("/api/principal/teachers/:id/approve", requirePrincipal, (req, res) => {
    updateTeacherStatus(req, res, "approved");
});

app.post("/api/principal/teachers/:id/reject", requirePrincipal, (req, res) => {
    updateTeacherStatus(req, res, "rejected");
});

app.post("/api/principal/teachers/:id/disable", requirePrincipal, (req, res) => {
    updateTeacherStatus(req, res, "disabled");
});

app.post("/api/principal/teachers/:id/reactivate", requirePrincipal, (req, res) => {
    updateTeacherStatus(req, res, "approved");
});

// ============================================================
// PRINCIPAL: VIEW ALL CONTENT SUBMISSIONS
// ============================================================

app.get("/api/principal/content", requirePrincipal, (req, res) => {
    try {
        const items = db.prepare(`
            SELECT c.*, t.full_name AS teacher_name
            FROM school_content c
            JOIN teachers t ON t.id = c.teacher_id
            ORDER BY
                CASE c.status WHEN 'pending' THEN 0 ELSE 1 END,
                c.created_at DESC
        `).all();

        res.json({
            success: true,
            items
        });
    } catch (error) {
        databaseError(res, "Principal content list error:", error);
    }
});

// ============================================================
// PRINCIPAL: VIEW ALL EVENT SUBMISSIONS
// ============================================================

app.get("/api/principal/events", requirePrincipal, (req, res) => {
    try {
        const events = db.prepare(`
            SELECT e.*, t.full_name AS teacher_name
            FROM calendar_events e
            JOIN teachers t ON t.id = e.teacher_id
            ORDER BY
                CASE e.status WHEN 'pending' THEN 0 ELSE 1 END,
                e.event_date ASC
        `).all();

        res.json({
            success: true,
            events
        });
    } catch (error) {
        databaseError(res, "Principal event list error:", error);
    }
});

// ============================================================
// PRINCIPAL: APPROVE OR REJECT CONTENT
// ============================================================

app.post(
    "/api/principal/content/:id/:action",
    requirePrincipal,
    (req, res) => {
        try {
            const id = Number(req.params.id);
            const action = req.params.action;

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid content ID."
                });
            }

            if (!["approve", "reject"].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: "Action must be approve or reject."
                });
            }

            const status =
                action === "approve" ? "approved" : "rejected";

            const result = db.prepare(`
                UPDATE school_content
                SET status = ?, approved_at = ?
                WHERE id = ?
            `).run(
                status,
                status === "approved" ? new Date().toISOString() : null,
                id
            );

            if (!result.changes) {
                return res.status(404).json({
                    success: false,
                    error: "Content submission not found."
                });
            }

            res.json({
                success: true,
                message: `Content ${status}.`
            });
        } catch (error) {
            databaseError(res, "Content moderation error:", error);
        }
    }
);

// ============================================================
// PRINCIPAL: APPROVE OR REJECT CALENDAR EVENTS
// ============================================================

app.post(
    "/api/principal/events/:id/:action",
    requirePrincipal,
    (req, res) => {
        try {
            const id = Number(req.params.id);
            const action = req.params.action;

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid event ID."
                });
            }

            if (!["approve", "reject"].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: "Action must be approve or reject."
                });
            }

            const status =
                action === "approve" ? "approved" : "rejected";

            const result = db.prepare(`
                UPDATE calendar_events
                SET status = ?, approved_at = ?
                WHERE id = ?
            `).run(
                status,
                status === "approved" ? new Date().toISOString() : null,
                id
            );

            if (!result.changes) {
                return res.status(404).json({
                    success: false,
                    error: "Calendar event not found."
                });
            }

            res.json({
                success: true,
                message: `Event ${status}.`
            });
        } catch (error) {
            databaseError(res, "Event moderation error:", error);
        }
    }
);

// ============================================================
// REVIEWS API
// Save reviews as pending; do not publish automatically
// ============================================================

app.post("/api/reviews", (req, res) => {
    try {
        const parentName = cleanString(req.body.parent_name);
        const email = cleanString(req.body.email).toLowerCase();
        const rating = Number(req.body.rating);
        const review = cleanString(req.body.review);

        if (!parentName || !email || !req.body.rating || !review) {
            return res.status(400).json({
                success: false,
                error: "All fields are required."
            });
        }

        if (!validEmail(email)) {
            return res.status(400).json({
                success: false,
                error: "Enter a valid email address."
            });
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: "Rating must be between 1 and 5."
            });
        }

        if (review.length < 5 || review.length > 3000) {
            return res.status(400).json({
                success: false,
                error: "Review must be between 5 and 3000 characters."
            });
        }

        db.prepare(`
            INSERT INTO school_reviews (
                parent_name, email, rating, review, status
            )
            VALUES (?, ?, ?, ?, 'pending')
        `).run(parentName, email, rating, review);

        res.status(201).json({
            success: true,
            message: "Thank you. Your review has been submitted for approval."
        });
    } catch (error) {
        databaseError(res, "Review submission error:", error);
    }
});

// ============================================================
// PRINCIPAL: LIST AND MODERATE REVIEWS
// ============================================================

app.get("/api/principal/reviews", requirePrincipal, (req, res) => {
    try {
        const reviews = db.prepare(`
            SELECT *
            FROM school_reviews
            ORDER BY
                CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                created_at DESC
        `).all();

        res.json({
            success: true,
            reviews
        });
    } catch (error) {
        databaseError(res, "Review list error:", error);
    }
});

app.post(
    "/api/principal/reviews/:id/:action",
    requirePrincipal,
    (req, res) => {
        try {
            const id = Number(req.params.id);
            const action = req.params.action;

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid review ID."
                });
            }

            if (!["approve", "reject"].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: "Action must be approve or reject."
                });
            }

            const status =
                action === "approve" ? "approved" : "rejected";

            const result = db.prepare(`
                UPDATE school_reviews
                SET status = ?, approved_at = ?
                WHERE id = ?
            `).run(
                status,
                status === "approved" ? new Date().toISOString() : null,
                id
            );

            if (!result.changes) {
                return res.status(404).json({
                    success: false,
                    error: "Review not found."
                });
            }

            res.json({
                success: true,
                message: `Review ${status}.`
            });
        } catch (error) {
            databaseError(res, "Review moderation error:", error);
        }
    }
);

// ============================================================
// PUBLICLY APPROVED REVIEWS API
// ============================================================

app.get("/api/reviews", (req, res) => {
    try {
        const reviews = db.prepare(`
            SELECT id, parent_name, rating, review, created_at
            FROM school_reviews
            WHERE status = 'approved'
            ORDER BY created_at DESC
        `).all();

        res.json({
            success: true,
            reviews
        });
    } catch (error) {
        databaseError(res, "Public review list error:", error);
    }
});

// ============================================================
// LOGOUT
// ============================================================

function destroySession(req, res, redirectTo) {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);
        }

        res.clearCookie("stmartins.sid");
        res.redirect(redirectTo);
    });
}

app.get("/teacher-logout", (req, res) => {
    destroySession(req, res, "/teacher-login");
});

app.get("/principal-logout", (req, res) => {
    destroySession(req, res, "/principal-login");
});

app.get("/api/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                success: false,
                error: "Unable to log out."
            });
        }

        res.clearCookie("stmartins.sid");

        res.json({
            success: true,
            redirect: "/"
        });
    });
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
    render404(req, res);
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err);

    if (res.headersSent) {
        return next(err);
    }

    if (req.path.startsWith("/api/")) {
        return res.status(500).json({
            success: false,
            error: "An unexpected server error occurred."
        });
    }

    res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Server Error | St. Martin's High School</title>
            <style>
                body {
                    margin: 0;
                    padding: 32px;
                    background: #071A2B;
                    color: #F6F1E7;
                    font-family: Arial, sans-serif;
                }
                main {
                    max-width: 720px;
                    margin: 8vh auto;
                    padding: 32px;
                    border: 1px solid #C5A45A;
                    border-radius: 16px;
                }
                h1 { color: #C5A45A; }
                p { line-height: 1.7; }
                a { color: #C5A45A; }
            </style>
        </head>
        <body>
            <main>
                <h1>Something went wrong</h1>
                <p>The page could not be loaded.</p>
                <p>Check the terminal running your server for the error details.</p>
                <p><a href="/">Return to the school website</a></p>
            </main>
        </body>
        </html>
    `);
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
    try {
        await syncPrincipalCredentials();

        app.listen(PORT, () => {
            console.log("");
            console.log("==================================================");
            console.log(" ST. MARTIN'S HIGH SCHOOL");
            console.log(" BALANAGAR, HYDERABAD");
            console.log(` Server: http://localhost:${PORT}`);
            console.log(` Database: ${dbPath}`);
            console.log(" Teacher authentication: enabled");
            console.log(" Principal authentication: enabled");
            console.log(" Student Life submissions: enabled");
            console.log(" News & Updates submissions: enabled");
            console.log(" Academic Calendar submissions: enabled");
            console.log(" Principal content approval: enabled");
            console.log("==================================================");
            console.log("");
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
```
