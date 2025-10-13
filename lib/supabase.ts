// lib/supabase.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a server-only Supabase Admin client on-demand.
 * We do NOT validate env at module scope to avoid build-time failures.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceKey) {
    // Throw only when the route actually tries to use Supabase at runtime.
    throw new Error(
      "Missing Supabase env. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE are set."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function withAdmin<T>(
  cb: (client: ReturnType<typeof getSupabaseAdmin>) => Promise<T>
): Promise<T> {
  const client = getSupabaseAdmin();
  return cb(client);
}
