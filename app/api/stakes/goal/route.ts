import { NextRequest, NextResponse } from "next/server";
import { fetchGoalAccount } from "@/lib/solana";

/**
 * GET /api/stakes/goal?goalHash=<hex>
 * Fetches goal account data from the Solana program
 */
export async function GET(req: NextRequest) {
  try {
    const goalHash = req.nextUrl.searchParams.get("goalHash");
    if (!goalHash) {
      return NextResponse.json(
        { error: "Missing goalHash parameter" },
        { status: 400 }
      );
    }

    // Parse hex goalHash to Buffer
    const goalHashBuffer = Buffer.from(goalHash, "hex");
    if (goalHashBuffer.length !== 32) {
      return NextResponse.json(
        { error: "goalHash must be 32 bytes (64 hex characters)" },
        { status: 400 }
      );
    }

    const goal = await fetchGoalAccount(goalHashBuffer);
    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    const normalizedGoal = {
      address: goal.goalPda.toBase58(),
      goalHash: goal.goalHash.toString("hex"),
      authority: goal.authority.toBase58(),
      resolver: goal.resolver.toBase58(),
      groupVault: goal.groupVault.toBase58(),
      tokenMint: goal.tokenMint.toBase58(),
      startsOn: goal.startsOn,
      endsOn: goal.endsOn,
    };

    return NextResponse.json({ goal: normalizedGoal });
  } catch (error: any) {
    console.error("Get goal error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch goal",
      },
      { status: 500 }
    );
  }
}
