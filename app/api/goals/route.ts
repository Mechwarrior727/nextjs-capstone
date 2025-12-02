import { NextRequest, NextResponse } from "next/server";
import { fetchGoalAccount } from "@/lib/solana";
import { checkRateLimit } from "@/lib/sanitization";

export async function GET(req: NextRequest) {
    try {
        // Rate limiting
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        const rateLimitCheck = checkRateLimit(`stakes-goal:${clientIp}`, 60, 60000);
        if (!rateLimitCheck.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded` },
                { status: 429 }
            );
        }

        const goalHash = req.nextUrl.searchParams.get("goalHash");

        if (!goalHash) {
            return NextResponse.json(
                { error: "Missing goalHash parameter" },
                { status: 400 }
            );
        }

        // Validate hex format
        if (!/^[0-9a-fA-F]+$/.test(goalHash)) {
            return NextResponse.json(
                { error: "goalHash must be hexadecimal" },
                { status: 400 }
            );
        }

        // Validate length
        if (goalHash.length !== 64) {
            return NextResponse.json(
                { error: "goalHash must be 32 bytes (64 hex characters)" },
                { status: 400 }
            );
        }

        const goalHashBuffer = Buffer.from(goalHash, "hex");
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
                error: "Failed to fetch goal",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}