
import { NextRequest, NextResponse } from 'next/server';

// Types for better type safety
interface GoogleFitData {
  days: Array<{
    date: string;
    steps: number;
  }>;
  total: number;
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
      }>;
    }>;
  }>;
}

// Calculate date range for the last 5 days
function getLast5DaysMillis() {
  const now = new Date();
  // Aligned the time window to cover 5 full calendar days including today,
  // using the local timezone to match user's experience.
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 4);
  start.setHours(0, 0, 0, 0);
  return {
    startTimeMillis: start.getTime(),
    endTimeMillis: end.getTime(),
  };
}

// Fetch step data from Google Fit API with proper error handling
async function fetchStepData(accessToken: string): Promise<GoogleFitData> {
  const { startTimeMillis, endTimeMillis } = getLast5DaysMillis();

  console.log('📊 Fetching Google Fit data for date range:', {
    startTimeMillis,
    endTimeMillis,
    duration: endTimeMillis - startTimeMillis
  });

  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
        // Corrected bucket duration from hourly to daily to match intended aggregation.
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // daily buckets
        startTimeMillis,
        endTimeMillis,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Google Fit API error:', {
      status: res.status,
      statusText: res.statusText,
      body: errorText
    });

    // Handle specific error cases
    if (res.status === 401) {
      throw new Error('Google OAuth token expired or invalid');
    } else if (res.status === 403) {
      throw new Error('Google Fit API access denied. Check OAuth scopes.');
    } else if (res.status === 429) {
      throw new Error('Google Fit API rate limit exceeded');
    }

    throw new Error(`Google Fit API error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  console.log('✅ Google Fit API response received:', {
    hasBucket: !!data.bucket,
    bucketCount: data.bucket?.length || 0
  });

  const buckets = data.bucket ?? [];

  const days = buckets.map((b: GoogleFitBucket) => {
    const points = b.dataset?.[0]?.point ?? [];
    const steps = points.reduce((sum: number, p: any) => {
      const v = p.value?.[0];
      const n =
        typeof v?.intVal === "number"
          ? v.intVal
          : typeof v?.fpVal === "number"
          ? v.fpVal
          : 0;
      return sum + (n || 0);
    }, 0);

    const d = new Date(Number(b.startTimeMillis));
    // Switched from UTC to local date parts to prevent timezone-related "off-by-one-day" errors.
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    return { date: `${yyyy}-${mm}-${dd}`, steps };
  });

  const total = days.reduce((s: number, d: any) => s + d.steps, 0);

  console.log('📈 Processed step data:', {
    daysCount: days.length,
    totalSteps: total,
    averageStepsPerDay: days.length > 0 ? Math.round(total / days.length) : 0
  });

  return { days, total };
}

// Main API handler - simplified for frontend OAuth token passing
export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    console.log('🚀 [API] Received Google OAuth token, calling Google Fit API');

    // Use the Google OAuth token to call Google Fit API
    const { days, total } = await fetchStepData(accessToken);

    console.log('✅ [API] Successfully fetched and processed Google Fit data');

    return NextResponse.json({
      success: true,
      data: { days, total },
      metadata: {
        daysCount: days.length,
        dateRange: {
          start: new Date(getLast5DaysMillis().startTimeMillis).toISOString(),
          end: new Date(getLast5DaysMillis().endTimeMillis).toISOString()
        },
        cached: false
      }
    });

  } catch (error: any) {
    console.error('❌ [API] Error in Google Fit integration:', error);

    // Enhanced error handling with specific error codes
    if (error.message?.includes('Google OAuth token expired') || error.message?.includes('401')) {
      return NextResponse.json(
        {
          error: 'Google OAuth token expired. Please reauthorize with Google.',
          code: 'TOKEN_EXPIRED',
          action: 'reauthorize'
        },
        { status: 401 }
      );
    }

    if (error.message?.includes('No Google OAuth token found')) {
      return NextResponse.json(
        {
          error: 'No Google OAuth token found. Please login with Google and grant fitness permissions.',
          code: 'NO_GOOGLE_TOKEN',
          action: 'login_google'
        },
        { status: 404 }
      );
    }

    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return NextResponse.json(
        {
          error: 'Google Fit API rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT',
          retryAfter: 60
        },
        { status: 429 }
      );
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: 'Failed to fetch Google Fit step data',
        code: 'UNKNOWN_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Note: Vercel automatically handles Next.js API route configuration
// No manual runtime configuration needed for Next.js API routes

