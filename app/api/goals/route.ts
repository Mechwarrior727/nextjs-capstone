// app/api/goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePrivyUser } from "@/lib/privy";

export async function POST(req: NextRequest) {
  const privy = await requirePrivyUser();
  const {
    groupId,
    title,
    type,
    targetValue,
    unit,
    periodDays = 7,
    startsOn,
    endsOn,
    stakingOptIn = false,
  } = await req.json();

  const { data: goal, error } = await supabaseAdmin
    .from("goals")
    .insert({
      creator_id: privy.id,
      group_id: groupId ?? null,
      title,
      type,
      target_value: Number(targetValue),
      unit,
      period_days: periodDays,
      starts_on: startsOn,
      ends_on: endsOn,
      staking_opt_in: !!stakingOptIn,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  // enroll creator
  const { error: e2 } = await supabaseAdmin
    .from("user_goals")
    .insert({ user_id: privy.id, goal_id: goal.id });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  return NextResponse.json({ goal });
}
