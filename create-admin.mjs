// Creates the chapter admin (creator) directly: no sign-up, no QR number, no email verification.
// Run locally:  npm run create-admin -- admin@example.com "a-long-password" "Chapter Admin" admin
import { createClient } from "@supabase/supabase-js";
const [email, password, name = "Chapter Admin", username = "admin"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !password || !url || !key) { console.error("Usage: npm run create-admin -- <email> <password> [name] [username]\nNeeds NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
if (password.length < 12) { console.error("Use a password of at least 12 characters."); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { bootstrap_admin: true }, user_metadata: { name, username } });
if (error) { console.error(error.message); process.exit(1); }
console.log("Admin created:", data.user.email, "\nSign in on the website. No sign-up or QR number is needed.");
