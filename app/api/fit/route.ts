import { NextRequest, NextResponse } from "next/server";
import { requirePrivySession } from "@/lib/privy";

// --- Types ---
interface GoogleFitData {
  days: Array<{
    date: string;
    steps: number;
    calories: number;
  }>;
  totalSteps: number;
  totalCalories: number;
}

interface GoogleFitBucket {
  startTimeMillis: string;
  endTimeMillis: string;
  dataset: Array<{
    dataSourceId: string;
    point: Array<{
      startTimeNanos: string;
      endTimeNanos: string;
      value: Array<{
        intVal?: number;
        fpVal?: number;
      }>[];
    }>[];
  }>[];
}

// --- Helper: calculate date range ---
function getLast30DaysMillis() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return {
    startTimeMillis: start.getTime(),
    endTimeMillis: end.getTime(),
  };
}

// --- Helper: fetch data from Google Fit ---
async function fetchStepData(accessToken: string): Promise<GoogleFitData> {
  const { startTimeMillis, endTimeMillis } = getLast30DaysMillis();

  console.log("📊 Fetching Google Fit data for date range:", {
    startTimeMillis,
    endTimeMillis,
    durationDays: Math.round((endTimeMillis - startTimeMillis) / (1000 * 60 * 60 * 24)),
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
    const errorText = await res.text();
    console.error("❌ Google Fit API error:", errorText);
    throw new Error(`Google Fit API error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const buckets = data.bucket ?? [];

  // Build map date → { steps, calories }
  const bucketMap: Record<string, { steps: number; calories: number }> = {};
  for (const b of buckets) {
    let steps = 0;
    let calories = 0;

    for (const dataset of b.dataset ?? []) {
      const sourceId = dataset.dataSourceId || "";
      for (const p of dataset.point ?? []) {
        const v = p.value?.[0];
        const n =
          typeof v?.intVal === "number"
            ? v.intVal
            : typeof v?.fpVal === "number"
            ? v.fpVal
            : 0;

        if (sourceId.includes("step_count")) steps += n;
        else if (sourceId.includes("calories")) calories += n;
      }
    }

    const date = new Date(Number(b.startTimeMillis)).toISOString().slice(0, 10);
    bucketMap[date] = { steps, calories };
  }

  // Fill in missing days
  const days: Array<{ date: string; steps: number; calories: number }> = [];
  const dayMillis = 24 * 60 * 60 * 1000;
  for (let t = startTimeMillis; t <= endTimeMillis; t += dayMillis) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({
      date,
      steps: bucketMap[date]?.steps ?? 0,
      calories: bucketMap[date]?.calories ?? 0,
    });
  }

  const totalSteps = days.reduce((s, d) => s + d.steps, 0);
  const totalCalories = days.reduce((s, d) => s + d.calories, 0);

  console.log("✅ Processed Google Fit data:", {
    daysCount: days.length,
    totalSteps,
    totalCalories,
    avgStepsPerDay: Math.round(totalSteps / days.length),
    avgCaloriesPerDay: Math.round(totalCalories / days.length),
  });

  return { days, totalSteps, totalCalories };
}

// --- Main API handler ---
export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();
    if (!accessToken) {
      return NextResponse.json({ error: "Access token is required" }, { status: 400 });
    }

    console.log("🚀 [API] Received Google OAuth token, calling Google Fit API");
    const { days, totalSteps, totalCalories } = await fetchStepData(accessToken);

    // 2️⃣ Verify Privy session
    const { user } = await requirePrivySession(request);

    // 3️⃣ Send data to /api/db/upsert-health instead of direct Supabase access
    console.log("📤 Forwarding health data to /api/db/upsert-health...");
    const upsertResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/db/upsert-health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ data: days }),
    });

    const upsertResult = await upsertResponse.json();

    if (!upsertResponse.ok) {
      console.error("❌ Upsert-health route failed:", upsertResult);
      throw new Error(upsertResult.error || "Upsert route failed");
    }

    console.log(`✅ Synced ${upsertResult.inserted} days of data for user ${user.id}`);

    // 4️⃣ Return response (keep your same format)
    return NextResponse.json({
      success: true,
      data: { days, totalSteps, totalCalories },
      metadata: {
        daysCount: days.length,
        dateRange: {
          start: new Date(getLast30DaysMillis().startTimeMillis).toISOString(),
          end: new Date(getLast30DaysMillis().endTimeMillis).toISOString(),
        },
        syncedToSupabase: true,
      },
    });
  } catch (error: any) {
    console.error("❌ [API] Error in Google Fit integration:", error);

    if (error.message?.includes("OAuth token expired") || error.message?.includes("401")) {
      return NextResponse.json(
        {
          error: "Google OAuth token expired. Please reauthorize with Google.",
          code: "TOKEN_EXPIRED",
          action: "reauthorize",
        },
        { status: 401 }
      );
    }

    if (error.message?.includes("No Google OAuth token found")) {
      return NextResponse.json(
        {
          error: "No Google OAuth token found. Please login with Google and grant fitness permissions.",
          code: "NO_GOOGLE_TOKEN",
          action: "login_google",
        },
        { status: 404 }
      );
    }

    if (error.message?.includes("rate limit") || error.message?.includes("429")) {
      return NextResponse.json(
        {
          error: "Google Fit API rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT",
          retryAfter: 60,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch or sync Google Fit data",
        code: "UNKNOWN_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
