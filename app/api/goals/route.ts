// app/api/goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requirePrivyUser } from "@/lib/privy";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePrivyUser(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase select error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    const status = /Unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePrivyUser(req);
    const payload = await req.json();

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: payload?.title ?? "Untitled",
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
