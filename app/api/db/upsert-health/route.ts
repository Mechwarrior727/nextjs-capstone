import { NextRequest, NextResponse } from "next/server";
import { requirePrivySession } from "@/lib/privy";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePrivySession(req);
    const { data } = await req.json(); // [{ date, steps, calories }]
    const supabase = getSupabaseAdmin();

    // Deduplicate any same-date entries just in case
    const unique = Object.values(
      data.reduce((acc: any, d: any) => {
        acc[d.date] = d;
        return acc;
      }, {})
    );

    const inserts = unique.map((d: any) => ({
      user_id: user.id,
      date: d.date,
      steps: d.steps ?? null,
      calories: d.calories ?? null,
      source: "google_fit",
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("user_health_data")
      .upsert(inserts, { onConflict: "user_id,date" });

    if (error) throw error;

    console.log(`✅ Inserted/updated ${inserts.length} days of data for user ${user.id}`);

    return NextResponse.json({ ok: true, inserted: inserts.length });
  } catch (error: any) {
    console.error("upsert-health error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to store health data" },
      { status: 500 }
    );
  }
}
