const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "school.db");

const db = new Database(dbPath);

const username = "st.martins@principal";
const password = "St.Martins@Principal";

async function resetPrincipal() {
    console.log("==========================================");
    console.log("RESETTING PRINCIPAL LOGIN");
    console.log("==========================================");

    console.log("Database:");
    console.log(dbPath);

    const passwordHash = await bcrypt.hash(password, 12);

    const existing = db.prepare(`
        SELECT id
        FROM principals
        LIMIT 1
    `).get();

    if (existing) {
        db.prepare(`
            UPDATE principals
            SET username = ?,
                password_hash = ?
            WHERE id = ?
        `).run(
            username,
            passwordHash,
            existing.id
        );

        console.log("Existing principal account updated.");
    } else {
        db.prepare(`
            INSERT INTO principals (
                username,
                password_hash
            )
            VALUES (?, ?)
        `).run(
            username,
            passwordHash
        );

        console.log("New principal account created.");
    }

    const principal = db.prepare(`
        SELECT id, username
        FROM principals
        LIMIT 1
    `).get();

    console.log("");
    console.log("Principal account:");
    console.log(principal);

    console.log("");
    console.log("LOGIN CREDENTIALS");
    console.log("------------------------------------------");
    console.log("Username: St.Martins@Principal");
    console.log("Password: St.Martins@Principal");
    console.log("------------------------------------------");
    console.log("Principal password reset successfully.");
    console.log("==========================================");

    db.close();
}

resetPrincipal().catch((error) => {
    console.error("RESET FAILED:");
    console.error(error);
    db.close();
});
