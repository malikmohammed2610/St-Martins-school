
/* ============================================================
   ST. MARTIN'S HIGH SCHOOL, BALANAGAR
   Express + EJS + SQLite
   Teacher Portal + Principal Portal
   Gmail SMTP + Teacher Instructions
   EMAIL OTP VERIFICATION REMOVED
   ============================================================ */

require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const multer = require("multer");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true, limit: "2mb" }));
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   UPLOAD CONFIGURATION
   ============================================================ */

const uploadsDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const instructionUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, uploadsDir);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const name =
                `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

            cb(null, name);
        }
    }),
    limits: {
        fileSize: 8 * 1024 * 1024,
        files: 5
    },
    fileFilter: (_req, file, cb) => {
        const allowed = new Set([
            ".pdf",
            ".png",
            ".jpg",
            ".jpeg",
            ".webp"
        ]);

        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowed.has(ext)) {
            return cb(
                new Error("Only PDF and image attachments are allowed.")
            );
        }

        cb(null, true);
    }
});

/* ============================================================
   EMAIL / GMAIL SMTP CONFIGURATION
   OTP VERIFICATION HAS BEEN REMOVED
   EMAIL IS RETAINED FOR PRINCIPAL INSTRUCTIONS
   ============================================================ */

let mailTransporter = null;

function getMailTransporter() {
    const emailUser = (process.env.EMAIL_USER || "").trim();
    const emailPass = (process.env.EMAIL_PASS || "").replace(/\s/g, "");
    const host = (process.env.EMAIL_HOST || "smtp.gmail.com").trim();
    const port = Number(process.env.EMAIL_PORT || 465);

    if (!emailUser || !emailPass) {
        console.error(
            "[EMAIL] EMAIL_USER or EMAIL_PASS is missing."
        );
        return null;
    }

    if (![465, 587].includes(port)) {
        console.error(
            "[EMAIL] Configure Gmail SMTP port 465 or 587."
        );
        return null;
    }

    if (!mailTransporter) {
        mailTransporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: emailUser,
                pass: emailPass
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 30000
        });
    }

    return mailTransporter;
}

async function sendSchoolEmail(options) {
    const transporter = getMailTransporter();

    if (!transporter) {
        throw new Error(
            "Email is not configured. Check EMAIL_USER and EMAIL_PASS."
        );
    }

    return transporter.sendMail({
        from: `"St. Martin's High School" <${(
            process.env.EMAIL_USER || ""
        ).trim()}>`,
        ...options
    });
}

/* ============================================================
   DATABASE INITIALIZATION
   ============================================================ */

const db = new Database(path.join(__dirname, "school.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        phone TEXT DEFAULT '',
        department TEXT NOT NULL DEFAULT 'General',
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        phone_verified INTEGER NOT NULL DEFAULT 0
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
        status TEXT NOT NULL DEFAULT 'approved',
        created_by INTEGER,
        created_by_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        page_key TEXT DEFAULT 'news',
        color TEXT DEFAULT '#C5A45A',
        FOREIGN KEY (created_by)
            REFERENCES teachers(id) ON DELETE SET NULL
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
        status TEXT NOT NULL DEFAULT 'approved',
        created_by INTEGER,
        created_by_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        color TEXT DEFAULT '#C5A45A',
        image_url TEXT,
        FOREIGN KEY (created_by)
            REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teacher_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        department TEXT NOT NULL DEFAULT 'All',
        attachment_path TEXT,
        created_by INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by)
            REFERENCES principals(id) ON DELETE SET NULL
    );
`);

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();

    if (!columns.some((item) => item.name === column)) {
        db.exec(
            `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
        );
    }
}

ensureColumn("teachers", "phone", "TEXT DEFAULT ''");
ensureColumn(
    "teachers",
    "phone_verified",
    "INTEGER NOT NULL DEFAULT 0"
);
ensureColumn(
    "teachers",
    "department",
    "TEXT NOT NULL DEFAULT 'General'"
);
ensureColumn(
    "teacher_notifications",
    "department",
    "TEXT NOT NULL DEFAULT 'All'"
);
ensureColumn("teacher_notifications", "attachment_path", "TEXT");
ensureColumn("school_content", "page_key", "TEXT DEFAULT 'news'");
ensureColumn("school_content", "color", "TEXT DEFAULT '#C5A45A'");
ensureColumn("calendar_events", "color", "TEXT DEFAULT '#C5A45A'");
ensureColumn("calendar_events", "image_url", "TEXT");

/* ============================================================
   PRINCIPAL ACCOUNT INITIALIZATION
   Set PRINCIPAL_USERNAME and PRINCIPAL_PASSWORD in .env
   ============================================================ */

async function syncPrincipalCredentials() {
    const username = (
        process.env.PRINCIPAL_USERNAME || "principal"
    ).trim();

    const password = process.env.PRINCIPAL_PASSWORD;

    if (!password || password.length < 12) {
        throw new Error(
            "Set a strong PRINCIPAL_PASSWORD (at least 12 characters) in .env."
        );
    }

    const existing = db.prepare(
        "SELECT id FROM principals WHERE username = ?"
    ).get(username);

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
        db.prepare(
            "UPDATE principals SET password_hash = ? WHERE id = ?"
        ).run(passwordHash, existing.id);
    } else {
        db.prepare(
            "INSERT INTO principals (username, password_hash) VALUES (?, ?)"
        ).run(username, passwordHash);
    }
}

/* ============================================================
   SESSION CONFIGURATION
   ============================================================ */

if (
    process.env.NODE_ENV === "production" &&
    (
        !process.env.SESSION_SECRET ||
        process.env.SESSION_SECRET.length < 32
    )
) {
    throw new Error(
        "Set a strong SESSION_SECRET environment variable."
    );
}

app.use(session({
    name: "smhs.sid",
    secret:
        process.env.SESSION_SECRET ||
        "local-development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 4 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.teacher = req.session.teacher || null;
    res.locals.principal = req.session.principal || null;
    res.locals.isTeacherLoggedIn = Boolean(req.session.teacher);
    res.locals.isPrincipalLoggedIn = Boolean(req.session.principal);
    next();
});

/* ============================================================
   AUTHENTICATION HELPERS
   ============================================================ */

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
    return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function getApprovedUpdates(pageKey = null) {
    const query = `
        SELECT id, title, description, category, image_url, page_key,
               color, created_by_name, created_at
        FROM school_content
        WHERE status = 'approved'
    `;

    if (pageKey) {
        return db.prepare(`
            ${query}
            AND COALESCE(NULLIF(page_key, ''), 'news') = ?
            ORDER BY created_at DESC, id DESC
        `).all(pageKey);
    }

    return db.prepare(
        `${query} ORDER BY created_at DESC, id DESC`
    ).all();
}

function getApprovedEvents() {
    return db.prepare(`
        SELECT id, title, description, category, event_date,
               start_time, end_time, location, image_url, color,
               created_by_name, created_at
        FROM calendar_events
        WHERE status = 'approved'
        ORDER BY event_date ASC, start_time ASC, id ASC
    `).all();
}

function getTeacherUpdates(teacherId) {
    return db.prepare(`
        SELECT * FROM school_content
        WHERE created_by = ?
        ORDER BY created_at DESC, id DESC
    `).all(teacherId);
}

function getTeacherEvents(teacherId) {
    return db.prepare(`
        SELECT * FROM calendar_events
        WHERE created_by = ?
        ORDER BY event_date ASC, id ASC
    `).all(teacherId);
}

/* ============================================================
   PUBLIC WEBSITE ROUTES
   ============================================================ */

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
    res.render("disclosure", { title: "Mandatory Disclosure" });
});

app.get("/facilities", (req, res) => {
    res.render("facilities", { title: "School Facilities" });
});

app.get("/academics", (req, res) => {
    res.render("academics", { title: "Academics" });
});

app.get("/academics/:level", (req, res) => {
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

    const page = pages[req.params.level.toLowerCase()];

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

app.get("/student-life", (req, res) => {
    res.render("student-life", {
        title: "Student Life",
        updates: getApprovedUpdates(),
        events: getApprovedEvents()
    });
});

app.get("/gallery", (req, res) => {
    const galleryImages = db.prepare(`
        SELECT id, title, description, image_url, color, created_at
        FROM school_content
        WHERE status = 'approved'
          AND page_key = 'gallery'
          AND image_url IS NOT NULL
        ORDER BY created_at DESC, id DESC
    `).all();

    res.render("gallery", {
        title: "School Gallery",
        galleryImages
    });
});

app.get("/calendar", (req, res) => {
    res.render("calendar", {
        title: "Academic Calendar",
        events: getApprovedEvents()
    });
});

app.get("/news", (req, res) => {
    res.render("news", {
        title: "News & Updates",
        updates: getApprovedUpdates("news"),
        events: getApprovedEvents()
    });
});

app.get("/resources", (req, res) => {
    res.render("resources", {
        title: "Student & Parent Resources | St. Martin's High School",
        updates: getApprovedUpdates("resources"),
        events: getApprovedEvents()
    });
});

app.get("/contact", (req, res) => {
    res.render("contact", { title: "Contact Us" });
});

/* ============================================================
   TEACHER REGISTRATION
   Public registrations remain pending until principal approval.
   NO EMAIL OTP IS REQUIRED.
   ============================================================ */

app.get(["/teacher-signup", "/teacher/signup"], (req, res) => {
    res.render("teacher-signup", {
        title: "Teacher Registration",
        error: null
    });
});

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

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const duplicate = db.prepare(`
            SELECT id FROM teachers
            WHERE username = ? OR email = ? OR employee_id = ?
        `).get(username, email, employeeId);

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message:
                    "Username, email, or employee ID already exists."
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
            ) VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(
            fullName,
            employeeId,
            username,
            email,
            passwordHash
        );

        res.status(201).json({
            success: true,
            message:
                "Registration submitted. Please wait for principal approval."
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message:
                    "Username, email, or employee ID already exists."
            });
        }

        next(error);
    }
});

/* ============================================================
   TEACHER LOGIN
   ============================================================ */

app.get(["/teacher-login", "/teacher/login"], (req, res) => {
    res.render("teacher-login", {
        title: "Teacher Login",
        error: null
    });
});

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
            SELECT * FROM teachers
            WHERE username = ? OR email = ? OR employee_id = ?
        `).get(
            username,
            username.toLowerCase(),
            username
        );

        if (
            !teacher ||
            !(await bcrypt.compare(password, teacher.password_hash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid login credentials."
            });
        }

        if (teacher.status !== "approved") {
            return res.status(403).json({
                success: false,
                message: teacher.status === "disabled"
                    ? "Your account has been disabled. Contact the principal."
                    : "Your account is awaiting principal approval."
            });
        }

        req.session.teacher = {
            id: teacher.id,
            full_name: teacher.full_name,
            employee_id: teacher.employee_id,
            username: teacher.username,
            email: teacher.email,
            department: teacher.department || "General",
            role: "Teacher"
        };

        req.session.save((error) => {
            if (error) {
                return next(error);
            }

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

/* ============================================================
   TEACHER DASHBOARD
   ============================================================ */

app.get("/teacher-dashboard", requireTeacher, (req, res) => {
    const teacher = req.session.teacher;

    res.render("teacher-dashboard", {
        title: "Teacher Dashboard",
        teacher,
        updates: getTeacherUpdates(teacher.id),
        events: getTeacherEvents(teacher.id)
    });
});

app.get("/teacher/dashboard", requireTeacher, (req, res) => {
    const teacher = req.session.teacher;

    res.render("teacher-dashboard", {
        title: "Teacher Dashboard",
        teacher,
        updates: getTeacherUpdates(teacher.id),
        events: getTeacherEvents(teacher.id)
    });
});

/* ============================================================
   TEACHER CONTENT MANAGEMENT
   ============================================================ */

app.post("/api/teacher/updates", requireTeacher, (req, res) => {
    const title = cleanString(req.body.title);
    const description = cleanString(
        req.body.description || req.body.content
    );
    const category =
        cleanString(req.body.category) || "Announcement";
    const imageUrl = cleanString(req.body.image_url);
    const requestedPage = cleanString(req.body.page_key);

    const pageKey = ["news", "resources"].includes(requestedPage)
        ? requestedPage
        : "news";

    if (!title || !description) {
        return res.status(400).json({
            success: false,
            message: "Title and description are required."
        });
    }

    const result = db.prepare(`
        INSERT INTO school_content (
            title, description, category, image_url, page_key, color,
            status, created_by, created_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
    `).run(
        title,
        description,
        category,
        imageUrl || null,
        pageKey,
        /^#[0-9A-Fa-f]{6}$/.test(req.body.color || "")
            ? req.body.color
            : "#C5A45A",
        req.session.teacher.id,
        req.session.teacher.full_name
    );

    res.status(201).json({
        success: true,
        message: "Announcement published successfully to the website!",
        id: result.lastInsertRowid
    });
});

app.get("/api/teacher/updates", requireTeacher, (req, res) => {
    res.json({
        success: true,
        updates: getTeacherUpdates(req.session.teacher.id)
    });
});

app.patch("/api/teacher/updates/:id", requireTeacher, (req, res) => {
    const id = Number(req.params.id);
    const title = cleanString(req.body.title);
    const description = cleanString(req.body.description);
    const category =
        cleanString(req.body.category) || "Announcement";
    const requestedPage = cleanString(req.body.page_key);

    const pageKey = ["news", "resources"].includes(requestedPage)
        ? requestedPage
        : "news";

    if (!id || !title || !description) {
        return res.status(400).json({
            success: false,
            message: "Title and description are required."
        });
    }

    const result = db.prepare(`
        UPDATE school_content
        SET title = ?, description = ?, category = ?, page_key = ?
        WHERE id = ? AND created_by = ?
    `).run(
        title,
        description,
        category,
        pageKey,
        id,
        req.session.teacher.id
    );

    res.json({
        success: result.changes > 0,
        message: result.changes
            ? "Announcement updated successfully!"
            : "Announcement not found."
    });
});

app.delete("/api/teacher/updates/:id", requireTeacher, (req, res) => {
    const result = db.prepare(`
        DELETE FROM school_content
        WHERE id = ? AND created_by = ?
    `).run(
        Number(req.params.id),
        req.session.teacher.id
    );

    res.json({
        success: result.changes > 0,
        message: result.changes
            ? "Announcement deleted."
            : "Not found."
    });
});

/* ============================================================
   TEACHER CALENDAR EVENTS
   ============================================================ */

app.post("/api/teacher/events", requireTeacher, (req, res) => {
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

    if (
        !title ||
        !validDate(eventDate) ||
        !validTime(startTime) ||
        !validTime(endTime)
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a title, valid date and valid times."
        });
    }

    const result = db.prepare(`
        INSERT INTO calendar_events (
            title, description, category, event_date, start_time,
            end_time, location, color, image_url, status,
            created_by, created_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '#C5A45A', NULL, 'approved', ?, ?)
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
        message: "Calendar event published successfully!",
        id: result.lastInsertRowid
    });
});

app.get("/api/teacher/events", requireTeacher, (req, res) => {
    res.json({
        success: true,
        events: getTeacherEvents(req.session.teacher.id)
    });
});

app.patch("/api/teacher/events/:id", requireTeacher, (req, res) => {
    const id = Number(req.params.id);
    const title = cleanString(req.body.title);
    const description = cleanString(req.body.description);
    const category =
        cleanString(req.body.category) || "School Event";
    const eventDate = cleanString(req.body.event_date);
    const location = cleanString(req.body.location);

    if (!id || !title || !validDate(eventDate)) {
        return res.status(400).json({
            success: false,
            message: "Valid title and date required."
        });
    }

    const result = db.prepare(`
        UPDATE calendar_events
        SET title = ?, description = ?, category = ?,
            event_date = ?, location = ?
        WHERE id = ? AND created_by = ?
    `).run(
        title,
        description,
        category,
        eventDate,
        location,
        id,
        req.session.teacher.id
    );

    res.json({
        success: result.changes > 0,
        message: result.changes
            ? "Event updated successfully!"
            : "Event not found."
    });
});

app.delete("/api/teacher/events/:id", requireTeacher, (req, res) => {
    const result = db.prepare(`
        DELETE FROM calendar_events
        WHERE id = ? AND created_by = ?
    `).run(
        Number(req.params.id),
        req.session.teacher.id
    );

    res.json({
        success: result.changes > 0,
        message: result.changes ? "Event deleted." : "Not found."
    });
});

/* ============================================================
   TEACHER GALLERY UPLOADS
   ============================================================ */

app.post(
    "/api/teacher/gallery",
    requireTeacher,
    instructionUpload.single("image"),
    (req, res) => {
        if (
            !req.file ||
            !/^image\/(png|jpe?g|webp)$/i.test(req.file.mimetype)
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose a PNG, JPG or WebP image."
            });
        }

        const requestedPage = cleanString(req.body.page_key);

        const pageKey = ["news", "gallery"].includes(requestedPage)
            ? requestedPage
            : "gallery";

        const title =
            cleanString(req.body.title) || req.file.originalname;

        const description =
            cleanString(req.body.description) || "School photo";

        const category =
            pageKey === "gallery" ? "Gallery" : "School Update";

        const result = db.prepare(`
            INSERT INTO school_content (
                title, description, category, image_url, page_key,
                color, status, created_by, created_by_name
            ) VALUES (?, ?, ?, ?, ?, '#C5A45A', 'approved', ?, ?)
        `).run(
            title,
            description,
            category,
            "/uploads/" + req.file.filename,
            pageKey,
            req.session.teacher.id,
            req.session.teacher.full_name
        );

        res.status(201).json({
            success: true,
            message: "Photo published successfully to the website!",
            id: result.lastInsertRowid
        });
    }
);

/* ============================================================
   TEACHER NOTIFICATIONS
   ============================================================ */

app.get(
    "/api/teacher/notifications",
    requireTeacher,
    (req, res) => {
        try {
            const notifications = db.prepare(`
                SELECT id, title, message, department,
                       attachment_path, created_at
                FROM teacher_notifications
                WHERE department = 'All' OR department = ?
                ORDER BY created_at DESC, id DESC
            `).all(req.session.teacher.department || "General");

            res.json({
                success: true,
                notifications
            });
        } catch (error) {
            console.error(
                "[TEACHER NOTIFICATIONS]",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Unable to load instructions."
            });
        }
    }
);

/* ============================================================
   PRINCIPAL LOGIN AND DASHBOARD
   ============================================================ */

app.get("/principal-login", (req, res) => {
    res.render("principal-login", {
        title: "Principal Login",
        error: null
    });
});

app.post(
    ["/api/principal/login", "/api/principal-login"],
    async (req, res, next) => {
        try {
            const username = cleanString(req.body.username);
            const password = req.body.password || "";

            const principal = db.prepare(
                "SELECT * FROM principals WHERE username = ?"
            ).get(username);

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
                if (error) {
                    return next(error);
                }

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

app.get(
    "/principal-dashboard",
    requirePrincipal,
    (req, res) => {
        res.render("principal-dashboard", {
            title: "Principal Dashboard",
            principal: req.session.principal
        });
    }
);

/* ============================================================
   PRINCIPAL TEACHER MANAGEMENT
   NO OTP REQUIRED WHEN CREATING TEACHERS
   ============================================================ */

app.get(
    "/api/principal/teachers",
    requirePrincipal,
    (req, res) => {
        try {
            const teachers = db.prepare(`
                SELECT id, full_name, employee_id, username, email, phone,
                       phone_verified, department, status,
                       created_at, approved_at
                FROM teachers
                ORDER BY created_at DESC
            `).all();

            res.json({
                success: true,
                teachers
            });
        } catch (error) {
            console.error("[TEACHER LIST]", error.message);

            res.status(500).json({
                success: false,
                message: "Unable to load teachers."
            });
        }
    }
);

/* Create a teacher account directly, without email OTP. */

app.post(
    "/api/principal/teachers/create",
    requirePrincipal,
    async (req, res, next) => {
        try {
            const fullName = cleanString(req.body.full_name);
            const employeeId = cleanString(req.body.employee_id);
            const username = cleanString(req.body.username);
            const email = cleanString(req.body.email).toLowerCase();
            const phone = cleanString(req.body.phone);

            const department =
                cleanString(req.body.department) || "General";

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

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid email address."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Password must contain at least 8 characters."
                });
            }

            const duplicate = db.prepare(`
                SELECT id FROM teachers
                WHERE username = ? OR email = ? OR employee_id = ?
            `).get(username, email, employeeId);

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Username, email, or employee ID already exists."
                });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const result = db.prepare(`
                INSERT INTO teachers (
                    full_name,
                    employee_id,
                    username,
                    email,
                    phone,
                    phone_verified,
                    department,
                    password_hash,
                    status,
                    approved_at
                ) VALUES (
                    ?, ?, ?, ?, ?, 0, ?, ?, 'approved',
                    CURRENT_TIMESTAMP
                )
            `).run(
                fullName,
                employeeId,
                username,
                email,
                phone,
                department,
                passwordHash
            );

            res.status(201).json({
                success: true,
                message:
                    "Teacher account created and approved successfully!",
                id: result.lastInsertRowid
            });
        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    success: false,
                    message:
                        "Username, email, or employee ID already exists."
                });
            }

            next(error);
        }
    }
);

/* Approve a pending teacher. */

app.post(
    "/api/principal/teachers/:id/approve",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE teachers
            SET status = 'approved',
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Teacher approved."
                : "Teacher not found."
        });
    }
);

/* Reject and delete a teacher account. */

app.post(
    "/api/principal/teachers/:id/reject",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(
            "DELETE FROM teachers WHERE id = ?"
        ).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Teacher rejected."
                : "Teacher not found."
        });
    }
);

/* Disable a teacher account. */

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
            success: result.changes > 0,
            message: result.changes
                ? "Teacher disabled."
                : "Teacher not found."
        });
    }
);

/* Reactivate a disabled teacher account. */

app.post(
    "/api/principal/teachers/:id/reactivate",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE teachers
            SET status = 'approved'
            WHERE id = ?
        `).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Teacher reactivated."
                : "Teacher not found."
        });
    }
);

/* Assign a teacher to a department. */

app.patch(
    "/api/principal/teachers/:id/department",
    requirePrincipal,
    (req, res) => {
        const id = Number(req.params.id);
        const department = cleanString(req.body.department);

        if (!department) {
            return res.status(400).json({
                success: false,
                message: "Department is required."
            });
        }

        const result = db.prepare(`
            UPDATE teachers
            SET department = ?
            WHERE id = ?
        `).run(department, id);

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Department updated."
                : "Teacher not found."
        });
    }
);

/* Reset a teacher's password. */

app.post(
    [
        "/api/principal/teachers/:id/password",
        "/api/principal/teachers/:id/reset-password"
    ],
    requirePrincipal,
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            const password = req.body.password || "";

            if (!id || password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Provide a valid teacher ID and a password of at least 8 characters."
                });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const result = db.prepare(`
                UPDATE teachers
                SET password_hash = ?
                WHERE id = ?
            `).run(passwordHash, id);

            res.json({
                success: result.changes > 0,
                message: result.changes
                    ? "Password reset successfully."
                    : "Teacher not found."
            });
        } catch (error) {
            next(error);
        }
    }
);

/* ============================================================
   PRINCIPAL INSTRUCTIONS
   Supports All departments, attachments, and email notifications.
   ============================================================ */

app.get(
    "/api/principal/notifications",
    requirePrincipal,
    (req, res) => {
        try {
            const notifications = db.prepare(`
                SELECT id, title, message, department,
                       attachment_path, created_at
                FROM teacher_notifications
                ORDER BY created_at DESC, id DESC
            `).all();

            res.json({
                success: true,
                notifications
            });
        } catch (error) {
            console.error(
                "[PRINCIPAL NOTIFICATIONS]",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Unable to load instructions."
            });
        }
    }
);

app.post(
    "/api/principal/notifications",
    requirePrincipal,
    instructionUpload.array("attachments", 5),
    async (req, res) => {
        try {
            const title = cleanString(req.body.title);
            const message = cleanString(req.body.message);
            const department =
                cleanString(req.body.department) || "All";

            if (!title || !message) {
                return res.status(400).json({
                    success: false,
                    error: "Title and message are required."
                });
            }

            if (message.length > 5000) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Instructions cannot exceed 5000 characters."
                });
            }

            const attachmentPath = (req.files || [])
                .map((file) => "/uploads/" + file.filename)
                .join(",");

            const result = db.prepare(`
                INSERT INTO teacher_notifications (
                    title,
                    message,
                    department,
                    attachment_path,
                    created_by
                ) VALUES (?, ?, ?, ?, ?)
            `).run(
                title,
                message,
                department,
                attachmentPath,
                req.session.principal.id
            );

            const targetTeachers = department === "All"
                ? db.prepare(`
                    SELECT email FROM teachers
                    WHERE status = 'approved' AND email != ''
                `).all()
                : db.prepare(`
                    SELECT email FROM teachers
                    WHERE status = 'approved'
                      AND department = ?
                      AND email != ''
                `).all(department);

            let emailsSent = 0;

            const recipients = targetTeachers
                .map((teacher) => teacher.email)
                .filter(Boolean);

            if (recipients.length > 0) {
                try {
                    const emailUser = (
                        process.env.EMAIL_USER || ""
                    ).trim();

                    if (!emailUser) {
                        throw new Error(
                            "EMAIL_USER is not configured."
                        );
                    }

                    await sendSchoolEmail({
                        to: emailUser,
                        bcc: recipients,
                        subject:
                            `[Principal Instruction] ${title} (${department})`,
                        text:
                            `Dear Teachers,\n\n` +
                            `The Principal has posted an instruction for ${department}.\n\n` +
                            `Title: ${title}\n\n` +
                            `${message}\n\n` +
                            "Please check your Teacher Dashboard for details.",
                        attachments: (req.files || []).map((file) => ({
                            filename: file.originalname,
                            path: file.path
                        }))
                    });

                    emailsSent = recipients.length;
                } catch (mailError) {
                    console.error("[INSTRUCTION EMAIL]", {
                        code: mailError.code || "UNKNOWN",
                        message: mailError.message
                    });
                }
            }

            res.status(201).json({
                success: true,
                message:
                    `Instruction posted for department: ${department}.` +
                    (
                        emailsSent
                            ? ` Email dispatched to ${emailsSent} teacher(s).`
                            : " Dashboard instruction saved; email delivery was not confirmed."
                    ),
                id: result.lastInsertRowid
            });
        } catch (error) {
            console.error("[INSTRUCTION ERROR]", error);

            res.status(500).json({
                success: false,
                error: "Unable to post instruction."
            });
        }
    }
);

/* Delete a principal instruction. */

app.delete(
    "/api/principal/notifications/:id",
    requirePrincipal,
    (req, res) => {
        try {
            const result = db.prepare(`
                DELETE FROM teacher_notifications
                WHERE id = ?
            `).run(Number(req.params.id));

            res.json({
                success: result.changes > 0,
                message: result.changes
                    ? "Instruction deleted."
                    : "Instruction not found."
            });
        } catch (error) {
            console.error("[DELETE INSTRUCTION]", error.message);

            res.status(500).json({
                success: false,
                error: "Unable to delete instruction."
            });
        }
    }
);

/* ============================================================
   PRINCIPAL CONTENT REVIEW
   ============================================================ */

app.get(
    "/api/principal/pending-content",
    requirePrincipal,
    (req, res) => {
        try {
            const updates = db.prepare(`
                SELECT * FROM school_content
                WHERE status = 'pending'
                ORDER BY created_at DESC
            `).all();

            const events = db.prepare(`
                SELECT * FROM calendar_events
                WHERE status = 'pending'
                ORDER BY event_date ASC
            `).all();

            res.json({
                success: true,
                updates,
                events
            });
        } catch (error) {
            console.error("[PENDING CONTENT]", error.message);

            res.status(500).json({
                success: false,
                error: "Unable to load pending content."
            });
        }
    }
);

app.post(
    "/api/principal/updates/:id/approve",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE school_content
            SET status = 'approved'
            WHERE id = ?
        `).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Announcement approved and published to website."
                : "Announcement not found."
        });
    }
);

app.post(
    "/api/principal/updates/:id/reject",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(
            "DELETE FROM school_content WHERE id = ?"
        ).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Announcement rejected."
                : "Announcement not found."
        });
    }
);

app.post(
    "/api/principal/events/:id/approve",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(`
            UPDATE calendar_events
            SET status = 'approved'
            WHERE id = ?
        `).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Event approved and published to Academic Calendar."
                : "Event not found."
        });
    }
);

app.post(
    "/api/principal/events/:id/reject",
    requirePrincipal,
    (req, res) => {
        const result = db.prepare(
            "DELETE FROM calendar_events WHERE id = ?"
        ).run(Number(req.params.id));

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Event rejected."
                : "Event not found."
        });
    }
);

app.get(
    "/api/principal/all-content",
    requirePrincipal,
    (req, res) => {
        try {
            const updates = db.prepare(`
                SELECT id, title, category, page_key, status,
                       created_by_name, created_at
                FROM school_content
                ORDER BY created_at DESC
            `).all();

            const events = db.prepare(`
                SELECT id, title, category, event_date, location,
                       status, created_by_name, created_at
                FROM calendar_events
                ORDER BY event_date DESC
            `).all();

            res.json({
                success: true,
                updates,
                events
            });
        } catch (error) {
            console.error("[ALL CONTENT]", error.message);

            res.status(500).json({
                success: false,
                error: "Unable to load website content."
            });
        }
    }
);

app.delete(
    "/api/principal/updates/:id",
    requirePrincipal,
    (req, res) => {
        try {
            const result = db.prepare(
                "DELETE FROM school_content WHERE id = ?"
            ).run(Number(req.params.id));

            res.json({
                success: result.changes > 0,
                message: result.changes
                    ? "Announcement removed."
                    : "Announcement not found."
            });
        } catch (error) {
            console.error("[DELETE UPDATE]", error.message);

            res.status(500).json({
                success: false,
                error: "Unable to delete announcement."
            });
        }
    }
);

app.delete(
    "/api/principal/events/:id",
    requirePrincipal,
    (req, res) => {
        try {
            const result = db.prepare(
                "DELETE FROM calendar_events WHERE id = ?"
            ).run(Number(req.params.id));

            res.json({
                success: result.changes > 0,
                message: result.changes
                    ? "Event removed."
                    : "Event not found."
            });
        } catch (error) {
            console.error("[DELETE EVENT]", error.message);

            res.status(500).json({
                success: false,
                error: "Unable to delete event."
            });
        }
    }
);

/* ============================================================
   LOGOUT
   ============================================================ */

function logoutHandler(req, res, next) {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie("smhs.sid");
        res.redirect("/");
    });
}

app.get(["/teacher-logout", "/teacher/logout"], logoutHandler);
app.get("/principal-logout", logoutHandler);

/* ============================================================
   PUBLIC REVIEWS
   ============================================================ */

app.post("/api/reviews", (req, res) => {
    const name = cleanString(req.body.name);
    const email = cleanString(req.body.email);
    const message = cleanString(
        req.body.message || req.body.review
    );

    if (!name || !message) {
        return res.status(400).json({
            success: false,
            message: "Required fields missing."
        });
    }

    db.prepare(`
        INSERT INTO reviews (name, email, message, status)
        VALUES (?, ?, ?, 'approved')
    `).run(name, email, message);

    res.status(201).json({
        success: true,
        message: "Review submitted."
    });
});

/* ============================================================
   404 HANDLER
   ============================================================ */

app.use((req, res) => {
    res.status(404).render("404", {
        title: "Page Not Found"
    });
});

/* ============================================================
   ERROR HANDLER
   ============================================================ */

app.use((error, req, res, next) => {
    console.error("[SERVER ERROR]", error);

    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Each attachment must be 8 MB or smaller."
            : error.code === "LIMIT_FILE_COUNT"
                ? "You can upload a maximum of 5 attachments."
                : "The uploaded files could not be processed.";

        return res.status(400).json({
            success: false,
            message
        });
    }

    if (
        error.message ===
        "Only PDF and image attachments are allowed."
    ) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    res.status(500).send(
        "Something went wrong. Please try again later."
    );
});

/* ============================================================
   START SERVER
   ============================================================ */

async function startServer() {
    try {
        await syncPrincipalCredentials();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                `St. Martin's High School server running on port ${PORT}`
            );
        });
    } catch (error) {
        console.error("[STARTUP ERROR]", error.message);
        process.exit(1);
    }
}

startServer();
