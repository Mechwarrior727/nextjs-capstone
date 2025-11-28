import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { fetchStakeAccount } from "@/lib/solana";

/**
 * GET /api/stakes/status?goalHash=<hex>&stakerAddress=<pubkey>
 * Fetches stake account data for a specific staker
 */
export async function GET(req: NextRequest) {
  try {
    const goalHash = req.nextUrl.searchParams.get("goalHash");
    const stakerAddress = req.nextUrl.searchParams.get("stakerAddress");

    if (!goalHash || !stakerAddress) {
      return NextResponse.json(
        { error: "Missing goalHash or stakerAddress parameter" },
        { status: 400 }
      );
    }

    // Parse parameters
    const goalHashBuffer = Buffer.from(goalHash, "hex");
    if (goalHashBuffer.length !== 32) {
      return NextResponse.json(
        { error: "goalHash must be 32 bytes (64 hex characters)" },
        { status: 400 }
      );
    }

    let staker: PublicKey;
    try {
      staker = new PublicKey(stakerAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid stakerAddress" },
        { status: 400 }
      );
    }

    const stake = await fetchStakeAccount(goalHashBuffer, staker);
    if (!stake) {
      return NextResponse.json(
        { error: "Stake not found" },
        { status: 404 }
      );
    }

    const normalizedStake = {
      address: stake.stakePda.toBase58(),
      goal: stake.goal.toBase58(),
      staker: stake.staker.toBase58(),
      amount: stake.amount,
      status: stake.status,
      createdAt: stake.createdAt,
    };

    return NextResponse.json({ stake: normalizedStake });
  } catch (error: any) {
    console.error("Get stake status error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch stake",
      },
      { status: 500 }
    );
  }
}
