# St. Martin's High School — MySQL version

This copy has been converted from SQLite (`better-sqlite3`) to MySQL (`mysql2`).

## What changed

- Removed `better-sqlite3` from the application.
- Replaced SQLite `school.db` access with a MySQL connection pool.
- Added MySQL initialization for `teachers` and `principals`.
- Converted teacher/principal queries and approval actions to MySQL.
- Added `database/mysql_schema.sql` and updated `database/schema.sql`.
- Converted `reset-principal.js` to use MySQL.
- Added `.env.example`.
- Removed the uploaded `.env` so database/password secrets are not packaged.
- `node_modules` is intentionally not included; install dependencies on the server with `npm install`.

## cPanel setup

1. In cPanel, open **MySQL Database Wizard**.
2. Create a database, for example `st_martins_db`.
3. Create a database user and a strong password.
4. Add the user to the database and grant **ALL PRIVILEGES**.
5. Open **phpMyAdmin**, select the new database, choose **Import**, and import `database/mysql_schema.sql`.
6. In the Node.js application's environment variables, add:
   - `DB_HOST=localhost`
   - `DB_PORT=3306`
   - `DB_USER=...`
   - `DB_PASSWORD=...`
   - `DB_NAME=...`
   - `SESSION_SECRET=...`
   - `PRINCIPAL_USERNAME=st.martins@principal`
   - `PRINCIPAL_PASSWORD=...`
7. Make sure Node.js 18+ is used.
8. Run `npm install` in the application environment, then restart/redeploy the application.

## Important

The MySQL database name and username on cPanel are often prefixed by the cPanel account name. Use the exact names shown by cPanel.

The application creates the `teachers` and `principals` tables automatically at startup, but importing the schema first is recommended.

Do not upload a real `.env` file containing passwords into a public repository.

If an old SQLite `school.db` contains teacher/principal records that must be preserved, those records need a one-time migration into MySQL; this project copy does not guess or invent that data.
