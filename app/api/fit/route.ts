import { NextRequest, NextResponse } from "next/server";
import { requirePrivySession } from "@/lib/privy";

interface GoogleFitData {
  days: Array<{ date: string; steps: number; calories: number }>;
  totalSteps: number;
  totalCalories: number;
}

async function fetchGoogleFitData(
  accessToken: string,
  startTimeMillis: number,
  endTimeMillis: number
): Promise<GoogleFitData> {
  console.log("📊 [fit] Fetching Google Fit data for:", {
    startTimeMillis,
    endTimeMillis,
  });

  const res = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aggregateBy: [
        { dataTypeName: "com.google.step_count.delta" },
        { dataTypeName: "com.google.calories.expended" },
      ],
      bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
      startTimeMillis,
      endTimeMillis,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("❌ [fit] Google Fit API error:", errText);
    throw new Error(`Google Fit API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const buckets = data.bucket ?? [];

  const days: Array<{ date: string; steps: number; calories: number }> = [];
  const bucketMap: Record<string, { steps: number; calories: number }> = {};

  for (const b of buckets) {
    let steps = 0;
    let calories = 0;

    for (const dataset of b.dataset ?? []) {
      const id = dataset.dataSourceId || "";
      for (const p of dataset.point ?? []) {
        const v = p.value?.[0];
        const val =
          typeof v?.intVal === "number"
            ? v.intVal
            : typeof v?.fpVal === "number"
            ? v.fpVal
            : 0;

        if (id.includes("step_count")) steps += val;
        if (id.includes("calories")) calories += val;
      }
    }

    const date = new Date(Number(b.startTimeMillis)).toISOString().slice(0, 10);
    bucketMap[date] = { steps, calories };
  }

  // Fill in missing days for smooth continuity
  const oneDay = 24 * 60 * 60 * 1000;
  for (let t = startTimeMillis; t <= endTimeMillis; t += oneDay) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({
      date,
      steps: bucketMap[date]?.steps ?? 0,
      calories: bucketMap[date]?.calories ?? 0,
    });
  }

  const totalSteps = days.reduce((s, d) => s + d.steps, 0);
  const totalCalories = days.reduce((s, d) => s + d.calories, 0);

  console.log("✅ [fit] Processed Google Fit data summary:", {
    totalSteps,
    totalCalories,
    days: days.length,
  });

  return { days, totalSteps, totalCalories };
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, startTimeMillis, endTimeMillis } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
    }

    const { user } = await requirePrivySession(req);
    const { days, totalSteps, totalCalories } = await fetchGoogleFitData(
      accessToken,
      startTimeMillis,
      endTimeMillis
    );

    // ✅ Dynamically determine base URL (works locally + hosted)
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    console.log("🌐 [fit] Upserting health data via:", `${baseUrl}/api/db/upsert-health`);
    
    // ✅ Sanitize (round floats) before DB upsert
    const safeDays = days.map(d => ({
      date: d.date,
      steps: Math.round(d.steps),
      calories: Math.round(d.calories),
    }));

    const upsert = await fetch(`${baseUrl}/api/db/upsert-health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({ data: safeDays }),
    });

    const result = await upsert.json();
    if (!upsert.ok) {
      console.error("❌ [fit] Upsert failed:", result);
      throw new Error(result.error || "Upsert route failed");
    }

    console.log(`✅ [fit] Synced ${result.inserted} days of data for user ${user.id}`);

    // ✅ Respond with sanitized data (safeDays)
    return NextResponse.json({
      success: true,
      data: { days: safeDays, totalSteps, totalCalories },
      synced: true,
    });
  } catch (err: any) {
    console.error("❌ [fit] Backend error:", err);
    return NextResponse.json(
      { error: "Failed to fetch or sync Google Fit data", details: err.message },
      { status: 500 }
    );
  }
}
