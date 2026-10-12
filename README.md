# JMRSP-PnCSC Portal — Next.js + Supabase on Vercel
Frontend and backend: Next.js. Database, login, 2-step verification, file storage: Supabase. Use a NEW Supabase project (the schema changed).

## Deploy
1. Supabase -> SQL Editor. FIRST create the encryption key (once):
   `select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'pii_key');`
   Then paste and run `supabase/schema.sql`. Back up the key: without it, student numbers and birthdays cannot be decrypted.
2. Authentication -> Providers -> Email: keep "Confirm email" ON (members verify their email). URL Configuration: Site URL = your https Vercel address.
3. Bot protection: create a free Cloudflare Turnstile widget, then Supabase -> Authentication -> Attack Protection -> enable Captcha (Turnstile) with the secret key. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
4. Push to GitHub -> import in Vercel -> add the env vars from `.env.example` (only the NEXT_PUBLIC ones) -> Deploy. `next.config.js` forces HTTPS (HSTS) and sends security headers.
5. Create the admin (no sign-up, no QR number, no email step). On your computer, copy `.env.example` to `.env.local`, fill in the Supabase URL and the service role key, then run:
   `npm install` then `npm run create-admin -- admin@example.com "a-long-password-12+" "Chapter Admin" admin`
   Sign in on the website with that email and password. Never put the service role key in Vercel or GitHub.

## Members data, QR numbers and IDs
- Admins (creator or editor) open "Members data" and upload a sheet (XLSX, CSV, TSV or TXT, up to 200 MB) or paste rows: Student ID number, Full name, Nickname, and an optional Position. Big files are saved in batches of 500 rows. The browser reads XLSX in memory, so for very large files a fast computer or CSV works best.
- The database generates a unique QR number for every row. QR numbers and student numbers can NEVER be changed or regenerated (a database trigger blocks it, and there is no delete). Names, nicknames and positions can be corrected until the member signs up.
- Give each member their QR number privately (use "Download QR list (CSV)").
- To sign up, a member needs the QR number AND their student number. Their name and nickname come from the sheet. Each QR number works once.
- After signing in, only that member sees their ID under Profile -> My ID (front with photo, nickname, position; back with the QR code) and can download both sides as PNG. Not even admins see member IDs.
- The front and back designs are in `public/id/` (front.jpg, back.jpg). The back is the Verdant Logic Core design; admins can upload a different back for each team in "Members data". The member's position follows the Legacies page when their name matches a current officer; otherwise it comes from the sheet, or "Member".

## Admin roles
- Creator: full control; adds creators, editors and content checkers. A creator is never removed directly: another creator files a removal request and the target creator must approve it (or steps down). At least one creator always remains.
- Editor: posts events, changes About/Events photos, team covers, and manages the Members data sheet.
- Content checker: removes posts and comments that break the rules.
- Admin actions are written to `audit_log`.
- Officers edit the legacies: the current and previous term are editable; adding a new term locks all earlier terms.

## Security summary
Encrypted at rest: birthday and student numbers (pgcrypto, key in Supabase Vault). Row level security on every table; anonymous visitors only read public data. Uploads: JPG/PNG/WEBP/GIF (max 5 MB) and MP4/WEBM (max 25 MB), checked in the app and on the server bucket. Bot protection on sign-up and login, honeypot field, HTTPS only, security headers. Chat messages are protected by access rules and HTTPS but are not end-to-end encrypted.

## Other notes
- Hero video: put your file at `public/hero.mp4` (under ~20 MB). Social links: edit `SOC` in `lib/content.js`.
- Privacy Policy and Terms are drafts in `lib/legal.js`: have your adviser review them.
- 2-step verification uses an authenticator app (Profile -> Settings).
- Local test: `npm install`, copy `.env.example` to `.env.local`, `npm run dev`.
