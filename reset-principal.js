const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5
});

async function resetPrincipal() {
    const username = String(
        process.env.PRINCIPAL_USERNAME || "st.martins@principal"
    ).trim().toLowerCase();

    const password = process.env.PRINCIPAL_PASSWORD;

    if (!password) {
        throw new Error("Set PRINCIPAL_PASSWORD in .env before running reset-principal.js");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [existingRows] = await db.execute(
        "SELECT id FROM principals LIMIT 1"
    );

    if (existingRows.length) {
        await db.execute(
            `UPDATE principals
             SET username = ?, password_hash = ?
             WHERE id = ?`,
            [username, passwordHash, existingRows[0].id]
        );
        console.log("Principal account updated.");
    } else {
        await db.execute(
            `INSERT INTO principals (username, password_hash)
             VALUES (?, ?)`,
            [username, passwordHash]
        );
        console.log("Principal account created.");
    }

    await db.end();
}

resetPrincipal().catch(async error => {
    console.error("ERROR:", error.message);
    await db.end().catch(() => {});
    process.exit(1);
});
