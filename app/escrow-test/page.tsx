"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { EscrowTestButton } from "@/app/components/EscrowTestButton";
import { Button } from "@/app/components/ui/button";

export default function EscrowTestPage() {
  const { authenticated, logout, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [authenticated, ready, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="text-gray-600 hover:text-gray-900 -ml-2"
              >
                ← Back to Home
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Habit Tracker Escrow
            </h1>
            <p className="mt-2 text-gray-600">
              Test staking USDC through the Solana program
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>

        {/* Main Test Component */}
        <div className="mb-8 space-y-4 rounded-lg border-2 border-blue-600 bg-blue-100 p-6">
          <div>
            <h2 className="mb-2 text-xl font-bold text-blue-900">
              Quick Start Guide
            </h2>
            <p className="text-sm font-semibold text-blue-800 mb-4">Follow these steps to test staking:</p>
          </div>
          <ol className="list-inside list-decimal space-y-3 text-sm text-blue-900 font-medium">
            <li>
              <span className="font-bold">Get USDC:</span> Visit{" "}
              <a
                href="https://faucet.orca.so"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-blue-700 hover:text-blue-900"
              >
                Orca Faucet
              </a>
              {" "}and airdrop USDC to your wallet
            </li>
            <li>
              <span className="font-bold">Get SOL:</span> Click the "Airdrop 1 SOL" button in the playground below to get fees
            </li>
            <li>
              <span className="font-bold">Initialize Goal:</span> Enter a Goal Identifier and click "Initialize Goal"
            </li>
            <li>
              <span className="font-bold">Open Stake:</span> Enter your stake amount and click "Open Stake"
            </li>
            <li>
              <span className="font-bold">Deposit & Resolve:</span> Fund your stake or resolve it when the goal period ends
            </li>
            <li>
              <span className="font-bold">Track Progress:</span> View transaction signatures on{" "}
              <a
                href="https://explorer.solana.com?cluster=devnet"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-blue-700 hover:text-blue-900"
              >
                Solana Explorer
              </a>
            </li>
          </ol>
        </div>

        {/* Test Component */}
        <div className="mb-8">
          <EscrowTestButton />
        </div>

        {/* Documentation */}
        <div className="space-y-6 rounded-lg border-2 border-gray-400 p-6 bg-white">
          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900 border-b-2 border-gray-300 pb-2">
              How It Works
            </h3>
            <p className="text-gray-800 font-medium">
              This test demonstrates the core escrow functionality:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-gray-800 font-medium">
              <li>
                <strong>Goal Hash</strong>: Unique identifier for the habit goal
              </li>
              <li>
                <strong>Stake Amount</strong>: USDC collateral you're risking
              </li>
              <li>
                <strong>Signing</strong>: Privy signs the transaction with your embedded wallet
              </li>
              <li>
                <strong>On-Chain</strong>: Solana program manages escrow
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900 border-b-2 border-gray-300 pb-2">
              Program Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-bold text-gray-800">Program ID:</dt>
                <dd className="col-span-2 break-all font-mono text-gray-800 font-semibold">
                  Fbyu5W1jyoFnTvDrbwZvo8GpLXCc83HFt1RPtjVNkF1b
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-bold text-gray-800">Token:</dt>
                <dd className="col-span-2 break-all font-mono text-gray-800 font-semibold">
                  DevNet USDC
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-bold text-gray-800">Network:</dt>
                <dd className="col-span-2 font-mono text-gray-800 font-semibold">Devnet</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900 border-b-2 border-gray-300 pb-2">
              Transaction Flow
            </h3>
            <div className="space-y-2 text-sm text-gray-800 font-medium">
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-900">
                  1
                </span>
                <span>Build: Construct open_stake instruction</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-900">
                  2
                </span>
                <span>Sign: Privy signs with your embedded wallet</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-900">
                  3
                </span>
                <span>Broadcast: Transaction sent to Solana devnet</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-900">
                  4
                </span>
                <span>Confirm: Wait for on-chain confirmation</span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900 border-b-2 border-gray-300 pb-2">
              Next Steps
            </h3>
            <p className="text-sm text-gray-800 font-medium">
              After opening a stake, you can:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-800 font-medium">
              <li>Deposit USDC (transfer to goal vault)</li>
              <li>Cancel before goal starts (refund)</li>
              <li>Wait for goal resolution (success/failure)</li>
              <li>Claim funds or forfeit to group vault</li>
            </ul>
          </div>
        </div>

        {/* Important Notes */}
        <div className="mt-8 rounded-lg border-2 border-yellow-500 bg-yellow-50 p-4">
          <h3 className="mb-3 font-bold text-lg text-yellow-900 border-b-2 border-yellow-400 pb-2">⚠️ Important Notes</h3>
          <ul className="space-y-2 text-sm text-yellow-900 font-semibold">
            <li>✅ This is a test on devnet - no real funds at risk</li>
            <li>✅ Privy embedded wallet is created automatically on login</li>
            <li>✅ All transactions require your signature via Privy</li>
            <li>✅ USDC must be in your embedded wallet (airdrop first)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
