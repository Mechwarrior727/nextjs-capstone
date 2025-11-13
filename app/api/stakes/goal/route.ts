import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getConnection, PROGRAM_ID, deriveGoalPda } from "@/lib/solana";

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

    const connection = getConnection();
    const [goalPda] = deriveGoalPda(goalHashBuffer);

    // Fetch goal account
    const goalAccount = await connection.getAccountInfo(goalPda);
    if (!goalAccount) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    // Decode goal data (simplified - would use Anchor IDL in production)
    // Structure: discriminator(8) + goal_hash(32) + authority(32) + group_vault(32) + token_mint(32) + starts_on(8) + ends_on(8)
    const data = goalAccount.data;
    if (data.length < 152) {
      return NextResponse.json(
        { error: "Invalid goal account data" },
        { status: 400 }
      );
    }

    const goal = {
      address: goalPda.toString(),
      goalHash: data.slice(8, 40).toString("hex"),
      authority: new PublicKey(data.slice(40, 72)).toString(),
      groupVault: new PublicKey(data.slice(72, 104)).toString(),
      tokenMint: new PublicKey(data.slice(104, 136)).toString(),
      startsOn: Number(data.readBigInt64LE(136)),
      endsOn: Number(data.readBigInt64LE(144)),
      now: Math.floor(Date.now() / 1000),
    };

    return NextResponse.json({ goal });
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
