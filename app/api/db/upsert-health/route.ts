import { NextRequest, NextResponse } from "next/server";
import { requirePrivySession } from "@/lib/privy";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/sanitization";

export async function POST(req: NextRequest) {
    try {
        const { user } = await requirePrivySession(req);

        // Rate limiting - prevent abuse
        const rateLimitCheck = checkRateLimit(`upsert-health:${user.id}`, 60, 60000); // 60 per minute
        if (!rateLimitCheck.allowed) {
            return NextResponse.json(
                { ok: false, error: `Rate limit exceeded. Try again in ${rateLimitCheck.retryAfter}s` },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { data } = body;

        // Validate data array
        if (!Array.isArray(data)) {
            return NextResponse.json(
                { ok: false, error: "Data must be an array" },
                { status: 400 }
            );
        }

        // Limit array size to prevent DoS
        if (data.length > 400) { // ~1 year of data
            return NextResponse.json(
                { ok: false, error: "Too many records. Maximum 400 allowed" },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Deduplicate and validate each record
        const unique = Object.values(
            data.reduce((acc: any, d: any) => {
                // Validate date format (YYYY-MM-DD)
                if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
                    throw new Error(`Invalid date format: ${d.date}`);
                }

                // Validate numeric values
                const steps = typeof d.steps === 'number' ? Math.max(0, Math.round(d.steps)) : null;
                const calories = typeof d.calories === 'number' ? Math.max(0, Math.round(d.calories)) : null;

                // Sanity check - reasonable limits
                if (steps !== null && steps > 200000) { // 200k steps per day is unrealistic
                    throw new Error(`Unrealistic step count: ${steps}`);
                }
                if (calories !== null && calories > 50000) { // 50k calories is unrealistic
                    throw new Error(`Unrealistic calorie count: ${calories}`);
                }

                acc[d.date] = { date: d.date, steps, calories };
                return acc;
            }, {})
        );

        const inserts = Object.values(unique).map((d: any) => ({
            user_id: user.id,
            date: d.date,
            steps: d.steps,
            calories: d.calories,
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