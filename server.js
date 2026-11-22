/* ============================================================
   ST. MARTIN'S HIGH SCHOOL, BALANAGAR
   Express + EJS + MySQL
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
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

// Forward rejected async route handlers to Express error middleware.
for (const method of ["get", "post", "patch", "delete", "put"]) {
    const registerRoute = app[method].bind(app);
    app[method] = (route, ...handlers) => registerRoute(
        route,
        ...handlers.map((handler) => {
            if (typeof handler !== "function") return handler;
            return (req, res, next) =>
                Promise.resolve(handler(req, res, next)).catch(next);
        })
    );
}

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
        console.error("[EMAIL] EMAIL_USER or EMAIL_PASS is missing.");
        return null;
    }

    if (![465, 587].includes(port)) {
        console.error("[EMAIL] Configure Gmail SMTP port 465 or 587.");
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
   MYSQL DATABASE INITIALIZATION
   Configure DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in .env
   ============================================================ */

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "+00:00",
    dateStrings: true
});

// Parameterized query helpers.
async function dbAll(sql, params = []) {
    const [rows] = await db.execute(sql, params);
    return rows;
}

async function dbGet(sql, params = []) {
    const [rows] = await db.execute(sql, params);
    return rows[0] || undefined;
}

async function dbRun(sql, params = []) {
    const [result] = await db.execute(sql, params);
    return {
        changes: result.affectedRows,
        lastInsertRowid: result.insertId
    };
}

async function initializeDatabase() {
    const statements = [
        `CREATE TABLE IF NOT EXISTS teachers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            employee_id VARCHAR(100) NOT NULL UNIQUE,
            username VARCHAR(100) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            phone VARCHAR(50) DEFAULT '',
            department VARCHAR(100) NOT NULL DEFAULT 'General',
            password_hash VARCHAR(255) NOT NULL,
            status ENUM('pending','approved','disabled') NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            approved_at DATETIME NULL,
            phone_verified TINYINT(1) NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS principals (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS school_content (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL DEFAULT 'Announcement',
            image_url TEXT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'approved',
            created_by BIGINT UNSIGNED NULL,
            created_by_name VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            page_key VARCHAR(50) DEFAULT 'news',
            color VARCHAR(7) DEFAULT '#C5A45A',
            CONSTRAINT fk_school_content_teacher FOREIGN KEY (created_by)
                REFERENCES teachers(id) ON DELETE SET NULL,
            INDEX idx_school_content_status_created (status, created_at),
            INDEX idx_school_content_page (page_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS calendar_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            category VARCHAR(100) NOT NULL DEFAULT 'School Event',
            event_date DATE NOT NULL,
            start_time VARCHAR(5) DEFAULT '',
            end_time VARCHAR(5) DEFAULT '',
            location VARCHAR(255) DEFAULT '',
            status VARCHAR(30) NOT NULL DEFAULT 'approved',
            created_by BIGINT UNSIGNED NULL,
            created_by_name VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            color VARCHAR(7) DEFAULT '#C5A45A',
            image_url TEXT NULL,
            CONSTRAINT fk_calendar_teacher FOREIGN KEY (created_by)
                REFERENCES teachers(id) ON DELETE SET NULL,
            INDEX idx_calendar_date (event_date, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS reviews (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) DEFAULT '',
            message TEXT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'approved',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS teacher_notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            department VARCHAR(100) NOT NULL DEFAULT 'All',
            attachment_path TEXT NULL,
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_notifications_principal FOREIGN KEY (created_by)
                REFERENCES principals(id) ON DELETE SET NULL,
            INDEX idx_notifications_department_created (department, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (const statement of statements) {
        await db.query(statement);
    }

   }

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

    const existing = await dbGet(
        "SELECT id FROM principals WHERE username = ?",
        [username]
    );

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
        await dbRun(
            "UPDATE principals SET password_hash = ? WHERE id = ?",
            [passwordHash, existing.id]
        );
    } else {
        await dbRun(
            "INSERT INTO principals (username, password_hash) VALUES (?, ?)",
            [username, passwordHash]
        );
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

async function getApprovedUpdates(pageKey = null) {
    const query = `
        SELECT id, title, description, category, image_url, page_key,
               color, created_by_name, created_at
        FROM school_content
        WHERE status = 'approved'
    `;

    if (pageKey) {
        return await dbAll(`
            ${query}
            AND COALESCE(NULLIF(page_key, ''), 'news') = ?
            ORDER BY created_at DESC, id DESC
        `, [pageKey]);
    }

    return await dbAll(
        `${query} ORDER BY created_at DESC, id DESC`,
        []
    );
}

async function getApprovedEvents() {
    return await dbAll(`
        SELECT id, title, description, category, event_date,
               start_time, end_time, location, image_url, color,
               created_by_name, created_at
        FROM calendar_events
        WHERE status = 'approved'
        ORDER BY event_date ASC, start_time ASC, id ASC
    `, []);
}

async function getTeacherUpdates(teacherId) {
    return await dbAll(`
        SELECT * FROM school_content
        WHERE created_by = ?
        ORDER BY created_at DESC, id DESC
    `, [teacherId]);
}

async function getTeacherEvents(teacherId) {
    return await dbAll(`
        SELECT * FROM calendar_events
        WHERE created_by = ?
        ORDER BY event_date ASC, id ASC
    `, [teacherId]);
}

/* ============================================================
   PUBLIC WEBSITE ROUTES
   ============================================================ */

app.get("/", async (req, res) => {
    res.render("index", {
        title: "St. Martin's High School | Balanagar, Hyderabad"
    });
});

app.get("/about", async (req, res) => {
    res.render("about", { title: "About Us" });
});

app.get("/principal", async (req, res) => {
    res.render("principal", { title: "Principal's Message" });
});

app.get("/management", async (req, res) => {
    res.render("management", { title: "Management" });
});

app.get("/educational-society", async (req, res) => {
    res.render("educational-society", {
        title: "St. Martin's Educational Society"
    });
});

app.get("/disclosure", async (req, res) => {
    res.render("disclosure", { title: "Mandatory Disclosure" });
});

app.get("/facilities", async (req, res) => {
    res.render("facilities", { title: "School Facilities" });
});

app.get("/academics", async (req, res) => {
    res.render("academics", { title: "Academics" });
});

app.get("/academics/:level", async (req, res) => {
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

app.get("/curriculum", async (req, res) => {
    res.render("curriculum", { title: "Curriculum" });
});

app.get("/admissions", async (req, res) => {
    res.render("admissions", { title: "Admissions" });
});

app.get("/fee-structure", async (req, res) => {
    res.render("fee-structure", { title: "Fee Structure" });
});

app.get("/student-life", async (req, res) => {
    res.render("student-life", {
        title: "Student Life",
        updates: await getApprovedUpdates(),
        events: await getApprovedEvents()
    });
});

app.get("/gallery", async (req, res) => {
    const galleryImages = await dbAll(`
        SELECT id, title, description, image_url, color, created_at
        FROM school_content
        WHERE status = 'approved'
          AND page_key = 'gallery'
          AND image_url IS NOT NULL
        ORDER BY created_at DESC, id DESC
    `, []);

    res.render("gallery", {
        title: "School Gallery",
        galleryImages
    });
});

app.get("/calendar", async (req, res) => {
    res.render("calendar", {
        title: "Academic Calendar",
        events: await getApprovedEvents()
    });
});

app.get("/news", async (req, res) => {
    res.render("news", {
        title: "News & Updates",
        updates: await getApprovedUpdates("news"),
        events: await getApprovedEvents()
    });
});

app.get("/resources", async (req, res) => {
    res.render("resources", {
        title: "Student & Parent Resources | St. Martin's High School",
        updates: await getApprovedUpdates("resources"),
        events: await getApprovedEvents()
    });
});

app.get("/contact", async (req, res) => {
    res.render("contact", { title: "Contact Us" });
});

/* ============================================================
   TEACHER REGISTRATION
   Public registrations remain pending until principal approval.
   NO EMAIL OTP IS REQUIRED.
   ============================================================ */

app.get(["/teacher-signup", "/teacher/signup"], async (req, res) => {
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

        const duplicate = await dbGet(`
            SELECT id FROM teachers
            WHERE username = ? OR email = ? OR employee_id = ?
        `, [username, email, employeeId]);

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message:
                    "Username, email, or employee ID already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await dbRun(`
            INSERT INTO teachers (
                full_name,
                employee_id,
                username,
                email,
                password_hash,
                status
            ) VALUES (?, ?, ?, ?, ?, 'pending')
        `, [
            fullName,
            employeeId,
            username,
            email,
            passwordHash
        ]);

        res.status(201).json({
            success: true,
            message:
                "Registration submitted. Please wait for principal approval."
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
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

app.get(["/teacher-login", "/teacher/login"], async (req, res) => {
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

        const teacher = await dbGet(`
            SELECT * FROM teachers
            WHERE username = ? OR email = ? OR employee_id = ?
        `, [
            username,
            username.toLowerCase(),
            username
        ]);

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

app.get("/teacher-dashboard", requireTeacher, async (req, res) => {
    const teacher = req.session.teacher;

    res.render("teacher-dashboard", {
        title: "Teacher Dashboard",
        teacher,
        updates: await getTeacherUpdates(teacher.id),
        events: await getTeacherEvents(teacher.id)
    });
});

app.get("/teacher/dashboard", requireTeacher, async (req, res) => {
    const teacher = req.session.teacher;

    res.render("teacher-dashboard", {
        title: "Teacher Dashboard",
        teacher,
        updates: await getTeacherUpdates(teacher.id),
        events: await getTeacherEvents(teacher.id)
    });
});

/* ============================================================
   TEACHER CONTENT MANAGEMENT
   ============================================================ */

app.post("/api/teacher/updates", requireTeacher, async (req, res) => {
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

    const result = await dbRun(`
        INSERT INTO school_content (
            title, description, category, image_url, page_key, color,
            status, created_by, created_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
    `, [
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
    ]);

    res.status(201).json({
        success: true,
        message: "Announcement published successfully to the website!",
        id: result.lastInsertRowid
    });
});

app.get("/api/teacher/updates", requireTeacher, async (req, res) => {
    res.json({
        success: true,
        updates: await getTeacherUpdates(req.session.teacher.id)
    });
});

app.patch("/api/teacher/updates/:id", requireTeacher, async (req, res) => {
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

    const result = await dbRun(`
        UPDATE school_content
        SET title = ?, description = ?, category = ?, page_key = ?
        WHERE id = ? AND created_by = ?
    `, [title,
        description,
        category,
        pageKey,
        id,
        req.session.teacher.id]);

    res.json({
        success: result.changes > 0,
        message: result.changes
            ? "Announcement updated successfully!"
            : "Announcement not found."
    });
});

app.delete("/api/teacher/updates/:id", requireTeacher, async (req, res) => {
    const result = await dbRun(`
        DELETE FROM school_content
        WHERE id = ? AND created_by = ?
    `, [Number(req.params.id),
        req.session.teacher.id]);

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

app.post("/api/teacher/events", requireTeacher, async (req, res) => {
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

    const result = await dbRun(`
        INSERT INTO calendar_events (
            title, description, category, event_date, start_time,
            end_time, location, color, image_url, status,
            created_by, created_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '#C5A45A', NULL, 'approved', ?, ?)
    `, [title,
        description,
        category,
        eventDate,
        startTime,
        endTime,
        location,
        req.session.teacher.id,
        req.session.teacher.full_name]);

    res.status(201).json({
        success: true,
        message: "Calendar event published successfully!",
        id: result.lastInsertRowid
    });
});

app.get("/api/teacher/events", requireTeacher, async (req, res) => {
    res.json({
        success: true,
        events: await getTeacherEvents(req.session.teacher.id)
    });
});

app.patch("/api/teacher/events/:id", requireTeacher, async (req, res) => {
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

    const result = await dbRun(`
        UPDATE calendar_events
        SET title = ?, description = ?, category = ?,
            event_date = ?, location = ?
        WHERE id = ? AND created_by = ?
    `, [title,
        description,
        category,
        eventDate,
        location,
        id,
        req.session.teacher.id]);

    res.json({
        success: result.changes > 0,
        message: result.changes
            ? "Event updated successfully!"
            : "Event not found."
    });
});

app.delete("/api/teacher/events/:id", requireTeacher, async (req, res) => {
    const result = await dbRun(`
        DELETE FROM calendar_events
        WHERE id = ? AND created_by = ?
    `, [Number(req.params.id),
        req.session.teacher.id]);

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
    async (req, res) => {
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

        const result = await dbRun(`
            INSERT INTO school_content (
                title, description, category, image_url, page_key,
                color, status, created_by, created_by_name
            ) VALUES (?, ?, ?, ?, ?, '#C5A45A', 'approved', ?, ?)
        `, [title,
            description,
            category,
            "/uploads/" + req.file.filename,
            pageKey,
            req.session.teacher.id,
            req.session.teacher.full_name]);

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
    async (req, res) => {
        try {
            const notifications = await dbAll(`
                SELECT id, title, message, department,
                       attachment_path, created_at
                FROM teacher_notifications
                WHERE department = 'All' OR department = ?
                ORDER BY created_at DESC, id DESC
            `, [req.session.teacher.department || "General"]);

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

app.get("/principal-login", async (req, res) => {
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

            const principal = await dbGet(
                "SELECT * FROM principals WHERE username = ?",
                [username]
            );

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
    async (req, res) => {
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
    async (req, res) => {
        try {
            const teachers = await dbAll(`
                SELECT id, full_name, employee_id, username, email, phone,
                       phone_verified, department, status,
                       created_at, approved_at
                FROM teachers
                ORDER BY created_at DESC
            `, []);

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

            const duplicate = await dbGet(`
                SELECT id FROM teachers
                WHERE username = ? OR email = ? OR employee_id = ?
            `, [username, email, employeeId]);

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Username, email, or employee ID already exists."
                });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const result = await dbRun(`
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
            `, [fullName,
                employeeId,
                username,
                email,
                phone,
                department,
                passwordHash]);

            res.status(201).json({
                success: true,
                message:
                    "Teacher account created and approved successfully!",
                id: result.lastInsertRowid
            });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
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
    async (req, res) => {
        const result = await dbRun(`
            UPDATE teachers
            SET status = 'approved',
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [Number(req.params.id)]);

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
    async (req, res) => {
        const result = await dbRun(
            "DELETE FROM teachers WHERE id = ?",
            [Number(req.params.id)]
        );

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
    async (req, res) => {
        const result = await dbRun(`
            UPDATE teachers
            SET status = 'disabled'
            WHERE id = ?
        `, [Number(req.params.id)]);

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
    async (req, res) => {
        const result = await dbRun(`
            UPDATE teachers
            SET status = 'approved'
            WHERE id = ?
        `, [Number(req.params.id)]);

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
    async (req, res) => {
        const id = Number(req.params.id);
        const department = cleanString(req.body.department);

        if (!department) {
            return res.status(400).json({
                success: false,
                message: "Department is required."
            });
        }

        const result = await dbRun(`
            UPDATE teachers
            SET department = ?
            WHERE id = ?
        `, [department, id]);

        res.json({
            success: result.changes > 0,
            message: result.changes
                ? "Teacher department updated."
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

            const result = await dbRun(`
                UPDATE teachers
                SET password_hash = ?
                WHERE id = ?
            `, [passwordHash, id]);

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
    async (req, res) => {
        try {
            const notifications = await dbAll(`
                SELECT id, title, message, department,
                       attachment_path, created_at
                FROM teacher_notifications
                ORDER BY created_at DESC, id DESC
            `, []);

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

            const result = await dbRun(`
                INSERT INTO teacher_notifications (
                    title,
                    message,
                    department,
                    attachment_path,
                    created_by
                ) VALUES (?, ?, ?, ?, ?)
            `, [title,
                message,
                department,
                attachmentPath,
                req.session.principal.id]);

            const targetTeachers = department === "All"
                ? await dbAll(`
                    SELECT email FROM teachers
                    WHERE status = 'approved' AND email != ''
                `, [])
                : await dbAll(`
                    SELECT email FROM teachers
                    WHERE status = 'approved'
                      AND department = ?
                      AND email != ''
                `, [department]);

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
    async (req, res) => {
        try {
            const result = await dbRun(`
                DELETE FROM teacher_notifications
                WHERE id = ?
            `, [Number(req.params.id)]);

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
    async (req, res) => {
        try {
            const updates = await dbAll(`
                SELECT * FROM school_content
                WHERE status = 'pending'
                ORDER BY created_at DESC
            `, []);

            const events = await dbAll(`
                SELECT * FROM calendar_events
                WHERE status = 'pending'
                ORDER BY event_date ASC
            `, []);

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

       async (req, res) => {
        const result = await dbRun(`
            UPDATE school_content
            SET status = 'approved'
            WHERE id = ?
        `, [Number(req.params.id)]);

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
    async (req, res) => {
        const result = await dbRun(
            "DELETE FROM school_content WHERE id = ?",
            [Number(req.params.id)]
        );

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
    async (req, res) => {
        const result = await dbRun(`
            UPDATE calendar_events
            SET status = 'approved'
            WHERE id = ?
        `, [Number(req.params.id)]);

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
    async (req, res) => {
        const result = await dbRun(
            "DELETE FROM calendar_events WHERE id = ?",
            [Number(req.params.id)]
        );

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
    async (req, res) => {
        try {
            const updates = await dbAll(`
                SELECT id, title, category, page_key, status,
                       created_by_name, created_at
                FROM school_content
                ORDER BY created_at DESC
            `, []);

            const events = await dbAll(`
                SELECT id, title, category, event_date, location,
                       status, created_by_name, created_at
                FROM calendar_events
                ORDER BY event_date DESC
            `, []);

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
    async (req, res) => {
        try {
            const result = await dbRun(
                "DELETE FROM school_content WHERE id = ?",
                [Number(req.params.id)]
            );

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
    async (req, res) => {
        try {
            const result = await dbRun(
                "DELETE FROM calendar_events WHERE id = ?",
                [Number(req.params.id)]
            );

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

app.post("/api/reviews", async (req, res) => {
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

    await dbRun(`
        INSERT INTO reviews (name, email, message, status)
        VALUES (?, ?, ?, 'approved')
    `, [name, email, message]);

    res.status(201).json({
        success: true,
        message: "Review submitted."
    });
});

/* ============================================================
   404 HANDLER
   ============================================================ */

app.use(async (req, res) => {
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
        await initializeDatabase();
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

       
    }
