import { NextRequest, NextResponse } from "next/server";
import { requirePrivyUser } from "@/lib/privy";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePrivyUser(req);
    const supabase = getSupabaseAdmin();

    const { data: membership, error: membershipError } = await supabase
      .from("user_goals")
      .select("goal_id")
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Supabase membership error", membershipError);
      return NextResponse.json(
        { ok: false, error: membershipError.message },
        { status: 500 }
      );
    }

    if (!membership?.length) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const goalIds = membership.map((row) => row.goal_id);

    const { data: goals, error: goalsError } = await supabase
      .from("goals")
      .select(
        `id,title,group_id,starts_on,ends_on,creator_id,groups!goals_group_id_fkey(id,name)`
      )
      .in("id", goalIds)
      .order("created_at", { ascending: false })
      .limit(25);

    if (goalsError) {
      console.error("Supabase goals error", goalsError);
      return NextResponse.json(
        { ok: false, error: goalsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data: goals ?? [] });
  } catch (error: any) {
    console.error("Finance goals API error", error);
    const message = error?.message || "Unexpected error";
    const status = /Unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
