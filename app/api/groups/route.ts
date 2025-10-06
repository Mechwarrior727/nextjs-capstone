// app/api/groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePrivyUser } from "@/lib/privy";

export async function POST(req: NextRequest) {
  const privy = await requirePrivyUser();
  const body = await req.json();
  const { name, description, isPrivate = true, allowStaking = false } = body;

  // Create group + owner membership in one transaction via RPC or do it here with two queries:
  const { data: group, error } = await supabaseAdmin
    .from("groups")
    .insert({
      owner_id: privy.id,
      name,
      description,
      is_private: !!isPrivate,
      allow_staking: !!allowStaking,
    })
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: mErr } = await supabaseAdmin
    .from("group_members")
    .insert({ group_id: group.id, user_id: privy.id, role: "admin" });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  return NextResponse.json({ group });
}
