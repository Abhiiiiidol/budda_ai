import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export const STORAGE_BUCKETS = {
  documents: "documents",
  images: "images",
} as const;

/**
 * Server-side Supabase admin client. Uses the secret key — bypasses RLS.
 * Use only for: storage uploads/downloads and pgvector RPC (match_entries).
 *
 * Never import this into client components.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in apps/web/.env",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
