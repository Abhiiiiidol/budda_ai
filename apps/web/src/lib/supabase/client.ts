import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Browser/anon Supabase client. Used for client-side storage reads and
 * any operation that should run with the publishable key.
 *
 * NOT used for: auth (Better Auth handles that) or CRUD (Drizzle handles that).
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
