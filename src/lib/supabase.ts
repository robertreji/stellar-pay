import 'server-only';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceRoleKey || supabaseServiceRoleKey.includes("your-supabase")) {
  supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[stellar-pay-supabase] WARNING: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY is not defined!"
  );
}

// Service-role client for backend updates (Next.js server-side API routes & indexer)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
