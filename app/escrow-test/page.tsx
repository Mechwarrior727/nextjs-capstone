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
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-4 text-lg font-semibold text-blue-900">
            Quick Start
          </h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-blue-800">
            <li>
              Get USDC on devnet:{" "}
              <a
                href="https://faucet.orca.so"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Orca Faucet
              </a>
            </li>
            <li>
              Airdrop SOL for fees:{" "}
              <code className="bg-white px-2 py-1 text-xs">
                solana airdrop 2 &lt;wallet&gt;
              </code>
            </li>
            <li>Use the test button below to open your first stake</li>
            <li>
              View transaction on{" "}
              <a
                href="https://explorer.solana.com?cluster=devnet"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Solana Explorer (Devnet)
              </a>
            </li>
          </ol>
        </div>

        {/* Test Component */}
        <div className="mb-8">
          <EscrowTestButton />
        </div>

        {/* Documentation */}
        <div className="space-y-6 rounded-lg border border-gray-200 p-6">
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              How It Works
            </h3>
            <p className="text-gray-600">
              This test demonstrates the core escrow functionality:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-gray-600">
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
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Program Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-medium text-gray-700">Program ID:</dt>
                <dd className="col-span-2 break-all font-mono text-gray-600">
                  Fbyu5W1jyoFnTvDrbwZvo8GpLXCc83HFt1RPtjVNkF1b
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-medium text-gray-700">Token:</dt>
                <dd className="col-span-2 break-all font-mono text-gray-600">
                  DevNet USDC
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-medium text-gray-700">Network:</dt>
                <dd className="col-span-2 font-mono text-gray-600">Devnet</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Transaction Flow
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  1
                </span>
                <span>Build: Construct open_stake instruction</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  2
                </span>
                <span>Sign: Privy signs with your embedded wallet</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  3
                </span>
                <span>Broadcast: Transaction sent to Solana devnet</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  4
                </span>
                <span>Confirm: Wait for on-chain confirmation</span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Next Steps
            </h3>
            <p className="text-sm text-gray-600">
              After opening a stake, you can:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
              <li>Deposit USDC (transfer to goal vault)</li>
              <li>Cancel before goal starts (refund)</li>
              <li>Wait for goal resolution (success/failure)</li>
              <li>Claim funds or forfeit to group vault</li>
            </ul>
          </div>
        </div>

        {/* Important Notes */}
        <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-2 font-semibold text-yellow-900">⚠️ Important</h3>
          <ul className="space-y-1 text-sm text-yellow-800">
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
