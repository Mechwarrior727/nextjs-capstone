// app/api/progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePrivyUser } from "@/lib/privy";

export async function POST(req: NextRequest) {
  const privy = await requirePrivyUser();
  const { goalId, day, value, source = "manual" } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("goal_progress")
    .upsert(
      { user_id: privy.id, goal_id: goalId, day, value, source },
      { onConflict: "user_id,goal_id,day" }
    )
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ progress: data });
}
