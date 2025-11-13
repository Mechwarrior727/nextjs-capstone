import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getConnection,
  PROGRAM_ID,
  deriveGoalPda,
  deriveStakePda,
} from "@/lib/solana";

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

    const connection = getConnection();
    const [goalPda] = deriveGoalPda(goalHashBuffer);
    const [stakePda] = deriveStakePda(goalPda, staker);

    // Fetch stake account
    const stakeAccount = await connection.getAccountInfo(stakePda);
    if (!stakeAccount) {
      return NextResponse.json(
        { error: "Stake not found" },
        { status: 404 }
      );
    }

    // Decode stake data (simplified)
    // Structure: discriminator(8) + goal(32) + staker(32) + amount(8) + status(1) + created_at(8)
    const data = stakeAccount.data;
    if (data.length < 89) {
      return NextResponse.json(
        { error: "Invalid stake account data" },
        { status: 400 }
      );
    }

    const stakeStatus = ["Pending", "Success", "Failure", "Canceled"];
    const statusCode = data[72];

    const stake = {
      address: stakePda.toString(),
      goal: new PublicKey(data.slice(8, 40)).toString(),
      staker: new PublicKey(data.slice(40, 72)).toString(),
      amount: Number(data.readBigInt64LE(72)),
      status: stakeStatus[statusCode] || "Unknown",
      statusCode,
      createdAt: Number(data.readBigInt64LE(80)),
    };

    return NextResponse.json({ stake });
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
