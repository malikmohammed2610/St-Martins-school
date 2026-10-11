# St. Martin's High School website

## Run locally
1. Install Node.js 18 or newer.
2. Extract this project and open its folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and replace `SESSION_SECRET`, `PRINCIPAL_USERNAME`, and `PRINCIPAL_PASSWORD` with private values.
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Teacher portal
The header's Teacher Login button and Resources > Teacher Login both open `/teacher-login`. Teachers register at `/teacher-signup`; registrations remain pending until approved by the Principal.

## Notes
- The app uses SQLite (`school.db`) and creates its tables when the server starts.
- Do not upload `.env`, `school.db`, or `node_modules` to a public repository.
- Public pages are rendered by Express/EJS. Keep route names and EJS filenames in sync.
