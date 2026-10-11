const path = require("path");
const Database = require("better-sqlite3");
require("dotenv").config();

const dbPath = path.join(__dirname, "school.db");
const db = new Database(dbPath);

console.log("==========================================");
console.log("PRINCIPAL DIAGNOSTIC");
console.log("==========================================");

console.log("Database being used:");
console.log(dbPath);

console.log("");

console.log(".env username:");
console.log(process.env.PRINCIPAL_USERNAME);

console.log("");

console.log("Database principals:");

const principals = db.prepare(`
    SELECT id, username, created_at
    FROM principals
`).all();

console.table(principals);

console.log("");
console.log("==========================================");

db.close();