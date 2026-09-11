import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// The Supabase client expects only the base project URL
// (e.g. https://xxxx.supabase.co). If the env var accidentally includes a
// path such as /rest/v1/ or a trailing slash, every request is built as
// .../rest/v1/auth/v1/token and the API gateway rejects it with
// "Invalid path specified in request URL". Normalize to the origin.
function normalizeSupabaseUrl(url: string) {
  if (!url) return url;
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

const supabaseUrl = normalizeSupabaseUrl(rawUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
