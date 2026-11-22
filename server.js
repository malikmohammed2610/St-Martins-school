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
