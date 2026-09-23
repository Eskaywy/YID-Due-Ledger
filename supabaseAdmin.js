// Supabase admin client (replaces the old Firebase Admin SDK).
// Server-side only: uses the service role key, which bypasses Row Level
// Security. NEVER expose SUPABASE_SERVICE_ROLE_KEY to the frontend.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
    "in your environment (.env locally, Vercel Environment Variables in production)."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    // Server-to-server: the service role key is long-lived, no session refresh.
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = { supabase };
