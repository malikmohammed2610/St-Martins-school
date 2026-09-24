// ============================================================
// ST. MARTIN'S HIGH SCHOOL — BALANAGAR, HYDERABAD
// COMPLETE EXPRESS SERVER
// Teacher + Principal Authentication
// SQLite Database + bcrypt Password Hashing
// ============================================================

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MYSQL DATABASE
// ============================================================

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: "utf8mb4"
});

async function dbGet(sql, params = []) {
    const [rows] = await db.execute(sql, params);
    return rows[0] || null;
}

async function dbAll(sql, params = []) {
    const [rows] = await db.execute(sql, params);
    return rows;
}

async function dbRun(sql, params = []) {
    const [result] = await db.execute(sql, params);
    return result;
}

async function initializeDatabase() {
    if (!process.env.DB_USER || !process.env.DB_NAME) {
        throw new Error(
            "Missing MySQL configuration. Set DB_USER, DB_PASSWORD, DB_NAME and optionally DB_HOST/DB_PORT."
        );
    }

    await dbRun(`
        CREATE TABLE IF NOT EXISTS teachers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(150) NOT NULL,
            employee_id VARCHAR(100) NOT NULL UNIQUE,
            username VARCHAR(100) NOT NULL UNIQUE,
            email VARCHAR(150) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            approved_at TIMESTAMP NULL DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS principals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
}

// ============================================================
// CREATE INITIAL PRINCIPAL
// ============================================================

async function createInitialPrincipal() {
    const existingPrincipal = await dbGet(
        "SELECT id FROM principals LIMIT 1"
    );

    if (existingPrincipal) {
        return;
    }

    const username =
        String(process.env.PRINCIPAL_USERNAME || "principal")
            .trim()
            .toLowerCase();

    const password =
        process.env.PRINCIPAL_PASSWORD ||
        "ChangeThisToYourOwnStrongPassword123!";

    const passwordHash = await bcrypt.hash(password, 12);

    await dbRun(`
        INSERT INTO principals
        (
            username,
            password_hash
        )
        VALUES (?, ?)
    `, [username, passwordHash]);

    console.log("");
    console.log("==================================================");
    console.log(" INITIAL PRINCIPAL ACCOUNT CREATED");
    console.log(" Username:", username);
    console.log(" Password: Use the value from your .env file");
    console.log("==================================================");
    console.log("");
}

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));


// ============================================================
// SESSION
// ============================================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "st-martins-balanagar-super-secret-key",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 4
        }
    })
);

// ============================================================
// GLOBAL VIEW VARIABLES
// ============================================================

app.use((req, res, next) => {

    res.locals.currentPath = req.path;

    res.locals.teacher =
        req.session.teacher || null;

    res.locals.principal =
        req.session.principal || null;

    res.locals.isTeacherLoggedIn =
        !!req.session.teacher;

    res.locals.isPrincipalLoggedIn =
        !!req.session.principal;

    next();
});

// ============================================================
// PUBLIC SCHOOL PAGES
// ============================================================

app.get("/", (req, res) => {

    res.render("index", {
        title:
            "St. Martin's High School | Balanagar, Hyderabad"
    });

});

app.get("/about", (req, res) => {

    res.render("about", {
        title:
            "School Overview | St. Martin's High School"
    });

});

app.get("/principal", (req, res) => {

    res.render("principal", {
        title:
            "Principal & Management | St. Martin's High School"
    });

});

app.get("/management", (req, res) => {

    res.render("management", {
        title:
            "Management | St. Martin's High School"
    });

});

app.get("/educational-society", (req, res) => {

    res.render("educational-society", {
        title:
            "Educational Society | St. Martin's High School"
    });

});

app.get("/disclosure", (req, res) => {

    res.render("disclosure", {
        title:
            "Mandatory Disclosure | St. Martin's High School"
    });

});

app.get("/facilities", (req, res) => {

    res.render("facilities", {
        title:
            "Our Facilities | St. Martin's High School"
    });

});
// ============================================================
// ACADEMICS
// ============================================================

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
        return res.status(404).render("404", {
            title: "Page Not Found | St. Martin's High School"
        });
    }

    res.render(page.view, {
        title: page.title
    });
});

// ============================================================
// DIRECT CURRICULUM ROUTE
// ============================================================

app.get("/curriculum", (req, res) => {

    res.render("curriculum", {
        title: "Curriculum & Academic Programme | St. Martin's High School"
    });

});
// ============================================================
// OTHER SCHOOL PAGES
// ============================================================

app.get("/admissions", (req, res) => {

    res.render("admissions", {
        title:
            "Admissions | St. Martin's High School"
    });

});

app.get("/fee-structure", (req, res) => {

    res.render("fee-structure", {
        title:
            "Fee Structure | St. Martin's High School"
    });

});

app.get("/student-life", (req, res) => {

    res.render("student-life", {
        title:
            "Student Life | St. Martin's High School"
    });

});

app.get("/gallery", (req, res) => {

    res.render("gallery", {
        title:
            "Gallery | St. Martin's High School"
    });

});

app.get("/calendar", (req, res) => {

    res.render("calendar", {
        title:
            "School Calendar | St. Martin's High School"
    });

});

app.get("/news", (req, res) => {

    res.render("news", {
        title:
            "News & Updates | St. Martin's High School"
    });

});

app.get("/resources", (req, res) => {

    res.render("resources", {
        title:
            "Resources | St. Martin's High School"
    });

});

app.get("/contact", (req, res) => {

    res.render("contact", {
        title:
            "Contact Us | St. Martin's High School"
    });

});

// ============================================================
// TEACHER AUTHENTICATION
// ============================================================

// ============================================================
// TEACHER LOGIN PAGE
// ============================================================

app.get("/teacher-login", (req, res) => {

    if (req.session.teacher) {

        return res.redirect(
            "/teacher-dashboard"
        );

    }

    res.render("teacher-login", {

        title:
            "Teacher Login | St. Martin's High School",

        error: null

    });

});

// ============================================================
// TEACHER SIGNUP PAGE
// ============================================================

app.get("/teacher-signup", (req, res) => {

    if (req.session.teacher) {

        return res.redirect(
            "/teacher-dashboard"
        );

    }

    res.render("teacher-signup", {

        title:
            "Teacher Registration | St. Martin's High School",

        error: null

    });

});

// ============================================================
// TEACHER SIGNUP API
// ============================================================

app.post(
    "/api/teacher/signup",
    async (req, res) => {

        try {

            const {
                full_name,
                employee_id,
                username,
                email,
                password,
                confirm_password
            } = req.body;

            if (
                !full_name ||
                !employee_id ||
                !username ||
                !email ||
                !password ||
                !confirm_password
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "All fields are required."
                });

            }

            const cleanName =
                String(full_name).trim();

            const cleanEmployeeId =
                String(employee_id).trim();

            const cleanUsername =
                String(username)
                    .trim()
                    .toLowerCase();

            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();

            if (password !== confirm_password) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Passwords do not match."
                });

            }

            if (cleanName.length < 2) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Please enter your full name."
                });

            }

            if (cleanEmployeeId.length < 2) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Please enter a valid Employee ID."
                });

            }

            if (cleanUsername.length < 4) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Username must contain at least 4 characters."
                });

            }

            if (password.length < 8) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Password must contain at least 8 characters."
                });

            }

            // FIXED EMAIL REGEX
            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(cleanEmail)) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Please enter a valid email address."
                });

            }

            // =================================================
            // CHECK USERNAME
            // =================================================

            const usernameExists =
                await dbGet(`
                    SELECT id
                    FROM teachers
                    WHERE username = ?
                `, [cleanUsername]);

            if (usernameExists) {

                return res.status(409).json({
                    success: false,
                    error:
                        "That username is already registered."
                });

            }

            // =================================================
            // CHECK EMPLOYEE ID
            // =================================================

            const employeeExists =
                await dbGet(`
                    SELECT id
                    FROM teachers
                    WHERE employee_id = ?
                `, [cleanEmployeeId]);

            if (employeeExists) {

                return res.status(409).json({
                    success: false,
                    error:
                        "That Employee ID is already registered."
                });

            }

            // =================================================
            // CHECK EMAIL
            // =================================================

            const emailExists =
                await dbGet(`
                    SELECT id
                    FROM teachers
                    WHERE email = ?
                `, [cleanEmail]);

            if (emailExists) {

                return res.status(409).json({
                    success: false,
                    error:
                        "That email address is already registered."
                });

            }

            // =================================================
            // HASH PASSWORD
            // =================================================

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            // =================================================
            // CREATE PENDING TEACHER
            // =================================================

            await dbRun(`
                INSERT INTO teachers
                (
                    full_name,
                    employee_id,
                    username,
                    email,
                    password_hash,
                    status
                )
                VALUES (?, ?, ?, ?, ?, 'pending')
            `, [
                cleanName,
                cleanEmployeeId,
                cleanUsername,
                cleanEmail,
                passwordHash
            ]);

            return res.status(201).json({

                success: true,

                message:
                    "Registration submitted successfully. Please wait for Principal approval."

            });

        } catch (error) {

            console.error(
                "Teacher signup error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to complete registration."

            });

        }

    }
);

// ============================================================
// TEACHER LOGIN API
// ============================================================

app.post(
    "/api/teacher/login",
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;

            if (!username || !password) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Username and password are required."

                });

            }

            const cleanUsername =
                String(username)
                    .trim()
                    .toLowerCase();

            const teacher =
                await dbGet(`
                    SELECT *
                    FROM teachers
                    WHERE username = ?
                `, [cleanUsername]);

            if (!teacher) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Invalid username or password."

                });

            }

            const passwordMatches =
                await bcrypt.compare(
                    password,
                    teacher.password_hash
                );

            if (!passwordMatches) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Invalid username or password."

                });

            }

            if (teacher.status === "pending") {

                return res.status(403).json({

                    success: false,

                    error:
                        "Your account is waiting for Principal approval."

                });

            }

            if (teacher.status === "rejected") {

                return res.status(403).json({

                    success: false,

                    error:
                        "Your teacher registration has been rejected."

                });

            }

            if (teacher.status === "disabled") {

                return res.status(403).json({

                    success: false,

                    error:
                        "Your teacher account has been disabled. Please contact the Principal."

                });

            }

            // =================================================
            // SUCCESSFUL LOGIN
            // =================================================

            req.session.teacher = {

                id:
                    teacher.id,

                full_name:
                    teacher.full_name,

                employee_id:
                    teacher.employee_id,

                username:
                    teacher.username,

                email:
                    teacher.email,

                role:
                    "Teacher"

            };

            return res.json({

                success: true,

                message:
                    "Login successful.",

                redirect:
                    "/teacher-dashboard"

            });

        } catch (error) {

            console.error(
                "Teacher login error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to process login."

            });

        }

    }
);

// ============================================================
// TEACHER PROTECTION
// ============================================================

function requireTeacher(req, res, next) {

    if (!req.session.teacher) {

        return res.redirect(
            "/teacher-login"
        );

    }

    next();

}

// ============================================================
// TEACHER DASHBOARD
// ============================================================

app.get(
    "/teacher-dashboard",
    requireTeacher,
    (req, res) => {

        res.render(
            "teacher-dashboard",
            {

                title:
                    "Teacher Dashboard | St. Martin's High School",

                teacher:
                    req.session.teacher

            }
        );

    }
);

// ============================================================
// PRINCIPAL AUTHENTICATION
// ============================================================

// ============================================================
// PRINCIPAL LOGIN PAGE
// ============================================================

app.get("/principal-login", (req, res) => {

    if (req.session.principal) {

        return res.redirect(
            "/principal-dashboard"
        );

    }

    res.render("principal-login", {

        title:
            "Principal Login | St. Martin's High School",

        error: null

    });

});

// ============================================================
// PRINCIPAL LOGIN API
// ============================================================

app.post(
    "/api/principal/login",
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;

            if (!username || !password) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Username and password are required."

                });

            }

            const cleanUsername =
                String(username)
                    .trim()
                    .toLowerCase();

            const principal =
                await dbGet(`
                    SELECT *
                    FROM principals
                    WHERE username = ?
                `, [cleanUsername]);

            if (!principal) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Invalid Principal credentials."

                });

            }

            const passwordMatches =
                await bcrypt.compare(
                    password,
                    principal.password_hash
                );

            if (!passwordMatches) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Invalid Principal credentials."

                });

            }

            req.session.principal = {

                id:
                    principal.id,

                username:
                    principal.username,

                role:
                    "Principal"

            };

            return res.json({

                success: true,

                message:
                    "Principal login successful.",

                redirect:
                    "/principal-dashboard"

            });

        } catch (error) {

            console.error(
                "Principal login error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to process Principal login."

            });

        }

    }
);

// ============================================================
// PRINCIPAL PROTECTION
// ============================================================

function requirePrincipal(req, res, next) {

    if (!req.session.principal) {

        return res.redirect(
            "/principal-login"
        );

    }

    next();

}

// ============================================================
// PRINCIPAL DASHBOARD
// ============================================================

app.get(
    "/principal-dashboard",
    requirePrincipal,
    (req, res) => {

        res.render(
            "principal-dashboard",
            {

                title:
                    "Principal Dashboard | St. Martin's High School",

                principal:
                    req.session.principal

            }
        );

    }
);

// ============================================================
// GET ALL TEACHERS
// ============================================================

app.get(
    "/api/principal/teachers",
    requirePrincipal,
    async (req, res) => {

        try {

            const teachers =
                await dbAll(`
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
                `);

            return res.json({

                success: true,

                teachers

            });

        } catch (error) {

            console.error(
                "Teacher list error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to load teacher accounts."

            });

        }

    }
);

// ============================================================
// PRINCIPAL CREATES TEACHER DIRECTLY
// ============================================================

app.post(
    "/api/principal/teachers/create",
    requirePrincipal,
    async (req, res) => {

        try {

            const {
                full_name,
                employee_id,
                username,
                email,
                password,
                confirm_password
            } = req.body;

            if (
                !full_name ||
                !employee_id ||
                !username ||
                !email ||
                !password ||
                !confirm_password
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "All fields are required."

                });

            }

            const cleanName =
                String(full_name).trim();

            const cleanEmployeeId =
                String(employee_id).trim();

            const cleanUsername =
                String(username)
                    .trim()
                    .toLowerCase();

            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();

            if (password !== confirm_password) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Passwords do not match."

                });

            }

            if (cleanName.length < 2) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please enter a valid teacher name."

                });

            }

            if (cleanEmployeeId.length < 2) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please enter a valid Employee ID."

                });

            }

            if (cleanUsername.length < 4) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Username must contain at least 4 characters."

                });

            }

            if (password.length < 8) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Password must contain at least 8 characters."

                });

            }

            // FIXED EMAIL REGEX
            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(cleanEmail)) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please enter a valid email address."

                });

            }

            // =================================================
            // CHECK USERNAME
            // =================================================

            const usernameExists =
                await dbGet(`
                    SELECT id
                    FROM teachers
                    WHERE username = ?
                `, [cleanUsername]);

            if (usernameExists) {

                return res.status(409).json({

                    success: false,

                    error:
                        "That username is already in use."

                });

            }

            // =================================================
            // CHECK EMPLOYEE ID
            // =================================================

            const employeeExists =
                await dbGet(`
                    SELECT id
                    FROM teachers
                    WHERE employee_id = ?
                `, [cleanEmployeeId]);

            if (employeeExists) {

                return res.status(409).json({

                    success: false,

                    error:
                        "That Employee ID is already registered."

                });

            }

            // =================================================
            // CHECK EMAIL
            // =================================================

            const emailExists =
                await dbGet(`
                    SELECT id
                    FROM teachers
                    WHERE email = ?
                `, [cleanEmail]);

            if (emailExists) {

                return res.status(409).json({

                    success: false,

                    error:
                        "That email address is already registered."

                });

            }

            // =================================================
            // HASH PASSWORD
            // =================================================

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            // =================================================
            // CREATE APPROVED TEACHER
            // =================================================

            await dbRun(`
                INSERT INTO teachers
                (
                    full_name,
                    employee_id,
                    username,
                    email,
                    password_hash,
                    status,
                    approved_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'approved',
                    CURRENT_TIMESTAMP
                )
            `, [
                cleanName,
                cleanEmployeeId,
                cleanUsername,
                cleanEmail,
                passwordHash
            ]);

            return res.status(201).json({

                success: true,

                message:
                    "Teacher profile created successfully. The teacher can now log in."

            });

        } catch (error) {

            console.error(
                "Principal teacher creation error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to create teacher profile."

            });

        }

    }
);

// ============================================================
// APPROVE TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/:id/approve",
    requirePrincipal,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid teacher ID."

                });

            }

            const result =
                await dbRun(`
                    UPDATE teachers
                    SET
                        status = 'approved',
                        approved_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [id]);

            if (result.affectedRows === 0) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Teacher account not found."

                });

            }

            return res.json({

                success: true,

                message:
                    "Teacher account approved."

            });

        } catch (error) {

            console.error(
                "Teacher approval error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to approve teacher."

            });

        }

    }
);

// ============================================================
// REJECT TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/:id/reject",
    requirePrincipal,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid teacher ID."

                });

            }

            const result =
                await dbRun(`
                    UPDATE teachers
                    SET
                        status = 'rejected',
                        approved_at = NULL
                    WHERE id = ?
                `, [id]);

            if (result.affectedRows === 0) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Teacher account not found."

                });

            }

            return res.json({

                success: true,

                message:
                    "Teacher account rejected."

            });

        } catch (error) {

            console.error(
                "Teacher rejection error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to reject teacher."

            });

        }

    }
);

// ============================================================
// DISABLE TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/:id/disable",
    requirePrincipal,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid teacher ID."

                });

            }

            const result =
                await dbRun(`
                    UPDATE teachers
                    SET status = 'disabled'
                    WHERE id = ?
                `, [id]);

            if (result.affectedRows === 0) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Teacher account not found."

                });

            }

            return res.json({

                success: true,

                message:
                    "Teacher account disabled."

            });

        } catch (error) {

            console.error(
                "Teacher disable error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to disable teacher."

            });

        }

    }
);

// ============================================================
// REACTIVATE TEACHER
// ============================================================

app.post(
    "/api/principal/teachers/:id/reactivate",
    requirePrincipal,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid teacher ID."

                });

            }

            const result =
                await dbRun(`
                    UPDATE teachers
                    SET
                        status = 'approved',
                        approved_at =
                            COALESCE(
                                approved_at,
                                CURRENT_TIMESTAMP
                            )
                    WHERE id = ?
                `, [id]);

            if (result.affectedRows === 0) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Teacher account not found."

                });

            }

            return res.json({

                success: true,

                message:
                    "Teacher account reactivated."

            });

        } catch (error) {

            console.error(
                "Teacher reactivation error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to reactivate teacher."

            });

        }

    }
);

// ============================================================
// LOGOUT
// ============================================================

app.get("/teacher-logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Teacher logout error:",
                error
            );

        }

        res.clearCookie("connect.sid");

        res.redirect(
            "/teacher-login"
        );

    });

});

app.get("/principal-logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Principal logout error:",
                error
            );

        }

        res.clearCookie("connect.sid");

        res.redirect(
            "/principal-login"
        );

    });

});

app.get("/api/logout", (req, res) => {

    req.session.destroy(() => {

        res.clearCookie(
            "connect.sid"
        );

        res.json({

            success: true,

            redirect:
                "/"

        });

    });

});

// ============================================================
// REVIEWS API
// ============================================================

app.post(
    "/api/reviews",
    async (req, res) => {

        try {

            const {
                parent_name,
                email,
                rating,
                review
            } = req.body;

            if (
                !parent_name ||
                !email ||
                !rating ||
                !review
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "All fields are required."

                });

            }

            const numericRating =
                Number(rating);

            if (
                numericRating < 1 ||
                numericRating > 5
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Rating must be between 1 and 5."

                });

            }

            console.log(
                "New parent review:",
                {
                    parent_name,
                    email,
                    rating: numericRating,
                    review
                }
            );

            return res.status(200).json({

                success: true,

                message:
                    "Thank you for sharing your experience with St. Martin's High School. Your review has been submitted for approval."

            });

        } catch (error) {

            console.error(
                "Review submission error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Internal server error. Please try again later."

            });

        }

    }
);

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {

    res.status(404).render("404", {

        title:
            "Page Not Found | St. Martin's High School"

    });

});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {

    console.error(
        "SERVER ERROR:",
        err
    );

    res.status(500).send(`
        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >

            <title>
                Server Error
            </title>

            <style>

                body {
                    margin: 0;
                    padding: 40px;
                    background: #071827;
                    color: #ff6b6b;
                    font-family: monospace;
                }

                pre {
                    background: #030c14;
                    padding: 20px;
                    border-radius: 10px;
                    overflow-x: auto;
                    color: #f8f9fa;
                    font-size: 14px;
                }

                h1 {
                    font-family: sans-serif;
                }

                p {
                    color: #b9c4d0;
                    font-family: sans-serif;
                }

            </style>

        </head>

        <body>

            <h1>
                🚨 Express Server Error
            </h1>

            <pre>${err.stack || err.message}</pre>

            <p>
                Check the error above to identify
                the view, route, or variable causing
                the problem.
            </p>

        </body>

        </html>
    `);

});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {

    try {

        await initializeDatabase();
        await createInitialPrincipal();

        app.listen(
            PORT,
            () => {

                console.log("");

                console.log(
                    "=================================================="
                );

                console.log(
                    " ST. MARTIN'S HIGH SCHOOL"
                );

                console.log(
                    " BALANAGAR, HYDERABAD"
                );

                console.log(
                    "=================================================="
                );

                console.log(
                    ` Server running at: http://localhost:${PORT}`
                );

                console.log(
                    " Database: MySQL"
                );

                console.log(
                    "=================================================="
                );

                console.log("");

            }
        );

    } catch (error) {

        console.error(
            "Failed to start server:",
            error
        );

        process.exit(1);

    }

}

startServer();