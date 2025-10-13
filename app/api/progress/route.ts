// app/api/progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requirePrivyUser } from "@/lib/privy";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePrivyUser(req);
    const body = await req.json();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("progress").insert({
      user_id: user.id,
      goal_id: body?.goal_id ?? null,
      amount: body?.amount ?? 0,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    const status = /Unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
