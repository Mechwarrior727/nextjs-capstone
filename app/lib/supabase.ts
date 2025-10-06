// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE!;

// Server-only client (service role): use ONLY in API routes
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// Helper: run a callback with app.user_id set for RLS-ready code paths.
export async function withAppUser<T>(
  privyUserId: string,
  cb: (client: typeof supabaseAdmin) => Promise<T>
): Promise<T> {
  // We can't SET a GUC via supabase-js directly. Use a one-off RPC wrapper when needed.
  // For now we enforce authorization in code (BFF pattern).
  return cb(supabaseAdmin);
}
