import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Scripts talk to Supabase with the secret key from the environment (or .env.local). The app's
// own client (src/lib/supabase/server.ts) is server-only and cannot be imported from Node scripts.

export function loadEnv(root = process.cwd()) {
  const file = join(root, ".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

export function scriptSupabase(): SupabaseClient<Database> {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (in .env.local or the environment).");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
