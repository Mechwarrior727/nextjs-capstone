import { NextRequest, NextResponse } from "next/server";
import { getPrimaryEmail, requirePrivySession } from "@/lib/privy";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePrivySession(req);

    const supabase = getSupabaseAdmin();
    const payload: Record<string, any> = {
      id: user.id,
      email: getPrimaryEmail(user),
    };

    const { error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("upsert-user error:", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to verify Privy session";
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
