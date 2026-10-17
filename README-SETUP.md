# St. Martin's High School website — updated build

## Run locally
1. Install Node.js 18 or newer.
2. Open the `st-skl-web` folder in VS Code (the folder containing `package.json`).
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET` and a strong principal password.
5. Run `npm start` and open `http://localhost:3000`.

## Important: database and deployment
- The application uses SQLite and creates/migrates its schema on startup. Back up `school.db` before deploying.
- Do not commit `.env`, `school.db`, uploads, or `node_modules`.
- On Render, the filesystem is ephemeral unless a persistent disk is mounted. Mount a persistent disk for `school.db` and `public/uploads`, or move those to a managed database/object store before relying on uploaded content.
- Ensure the production instance is HTTPS-only and use a persistent session store before public production use.

## SMS OTP and instruction alerts
Configure Twilio environment variables:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID` (Twilio Verify service for phone OTP)
- `TWILIO_PHONE_NUMBER` (an SMS-capable Twilio number used for instruction SMS)

Phone numbers must be in international E.164 format, such as `+919876543210`. SMS delivery requires a valid Twilio account, verified/approved sender where applicable, sufficient balance, and applicable recipient consent. If Twilio is not configured, OTP verification fails safely and teacher creation remains blocked.

## Principal and teacher workflows
- Principal can create teacher accounts after phone OTP verification, assign departments, send department-specific/all-department instructions, and attach PDF/image files.
- Teachers see instructions with timestamps and attachments in their dashboard. The dashboard checks for new instructions periodically and shows an in-page popup. SMS alerts are sent to teachers in the selected department if the SMS sender is configured.
- Teachers can submit news/calendar items for principal review, select a display color, add image URLs, and submit gallery photos for approval. Public news/calendar/gallery/resources pages can show approved content.
- Teachers can edit/delete their own pending submissions. Once approved, changes should be handled by the principal to preserve the approval workflow.
- The principal can reset a teacher password, but cannot see the original password. Passwords are stored as bcrypt hashes and are intentionally not reversible; never store plaintext passwords.
- A principal content-edit API is available for submitted website content; a complete page-by-page visual CMS still needs a dedicated editing screen for static page copy and page-specific image slots.

## Before going live
- Change all default credentials.
- Add rate limiting to login and OTP endpoints, CSRF protection for cookie-authenticated state-changing routes, and a durable session store.
- Configure persistent storage and test uploads/SMS in staging.
- Review privacy/consent requirements for staff phone numbers and messaging.
