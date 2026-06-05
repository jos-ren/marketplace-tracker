import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Single-user personal tool: RLS is intentionally disabled and the dashboard
// talks to Supabase directly with the public anon key (NEXT_PUBLIC_*).
// Returns null when env vars are missing so the UI can show a config message
// instead of crashing at import time.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  client = createClient(url, anon, { auth: { persistSession: false } });
  return client;
}
