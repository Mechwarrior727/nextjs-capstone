// app/api/db/upsert-user/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePrivyUser } from "@/lib/privy";

export async function POST() {
  try {
    const privy = await requirePrivyUser();

    const id = privy.id; // stable privy user id
    const email = privy.email?.address ?? null;
    const displayName =
      privy.google?.name || privy.twitter?.username || email || null;
    const twitter = privy.twitter?.username ?? null;
    const googleId = privy.google?.subject ?? null;
    const wallet =
      privy.wallet?.address ??
      privy.linkedAccounts?.find((a) => a.type === "wallet")?.address ??
      null;

    const { error } = await supabaseAdmin.from("users").upsert(
      {
        id,
        display_name: displayName,
        email,
        twitter_handle: twitter,
        google_id: googleId,
        wallet_address: wallet,
        metadata: { last_login_at: new Date().toISOString() },
      },
      { onConflict: "id" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
