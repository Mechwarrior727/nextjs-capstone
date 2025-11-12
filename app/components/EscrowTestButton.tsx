"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SendTransactionError,
} from "@solana/web3.js";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  deriveGoalPda,
  DEVNET_USDC_MINT,
  getConnection,
  buildInitGoalTx,
  buildOpenStakeTx,
  buildDepositStakeTx,
  ensureAssociatedTokenAccount,
} from "@/lib/solana";
import { AlertCircle, Loader2, CheckCircle, XCircle } from "lucide-react";

interface TestStatus {
  step: "idle" | "building" | "signing" | "broadcasting" | "confirming" | "success" | "error";
  message: string;
  signature?: string;
  error?: string;
}

/**
 * Test component for staking USDC through the escrow program
 * 
 * Prerequisites:
 * 1. User must be logged in with Google (Privy)
 * 2. Privy embedded Solana wallet must exist
 * 3. Wallet must have USDC on devnet (airdrop first)
 * 
 * Flow:
 * 1. User inputs goal hash and stake amount
 * 2. We build an open_stake instruction
 * 3. Privy signs the transaction
 * 4. We broadcast to devnet
 * 5. We confirm the transaction
 */
export function EscrowTestButton() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [goalHash, setGoalHash] = useState("default-test-goal-hash-32-bytes");
  const [stakeAmount, setStakeAmount] = useState("1"); // USDC
  const [status, setStatus] = useState<TestStatus>({ step: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [airdropStatus, setAirdropStatus] = useState<"idle" | "in_progress" | "success" | "error">("idle");

  // Get the first Solana wallet (from Privy's Solana hooks)
  const solanaWallet = wallets[0];

  const handleAirdrop = async () => {
    if (!solanaWallet?.address) {
      alert("Solana wallet not found. Please log in again.");
      return;
    }
    setAirdropStatus("in_progress");
    try {
      const connection = getConnection();
      const staker = new PublicKey(solanaWallet.address);
      const signature = await connection.requestAirdrop(staker, 1 * 1e9); // 1 SOL
      await connection.confirmTransaction(signature, "confirmed");
      setAirdropStatus("success");
    } catch (error) {
      console.error("Airdrop failed:", error);
      setAirdropStatus("error");
    }
  };

  const handleTestStake = async () => {
    try {
      if (!authenticated || !user) {
        setStatus({
          step: "error",
          message: "Please log in first",
          error: "User not authenticated",
        });
        return;
      }

      if (!solanaWallet?.address) {
        console.error("Wallet not found. Available wallets:", wallets);
        setStatus({
          step: "error",
          message: "Solana wallet not found",
          error: "Privy Solana wallet not initialized. Try logging out and logging back in.",
        });
        return;
      }

      setIsLoading(true);
      const connection = getConnection();
      const staker = new PublicKey(solanaWallet.address);
      const mint = new PublicKey(DEVNET_USDC_MINT);

      const executeTransaction = async (tx: Transaction, label: string) => {
        setStatus({
          step: "signing",
          message: `${label}: requesting signature...`,
        });

        const serializedTx = tx.serialize({ requireAllSignatures: false });
        const { signedTransaction } = await solanaWallet.signTransaction({
          transaction: serializedTx,
          chain: "solana:devnet",
        });

        setStatus({
          step: "broadcasting",
          message: `${label}: sending to devnet...`,
        });

        const signature = await connection.sendRawTransaction(
          new Uint8Array(signedTransaction)
        );

        setStatus({
          step: "confirming",
          message: `${label}: waiting for confirmation...`,
          signature,
        });

        const confirmation = await connection.confirmTransaction(
          signature,
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        return signature;
      };

      setStatus({
        step: "building",
        message: "Validating inputs and checking goal...",
      });

      let goalHashBuffer: Buffer;
      if (goalHash.length === 64 && /^[0-9a-f]{64}$/i.test(goalHash)) {
        goalHashBuffer = Buffer.from(goalHash, "hex");
      } else {
        const crypto = await import("crypto");
        goalHashBuffer = crypto.createHash("sha256").update(goalHash).digest();
      }

      const amount = Math.floor(parseFloat(stakeAmount) * 1_000_000);

      if (amount <= 0) {
        throw new Error("Stake amount must be greater than 0");
      }

      const [goalPda] = deriveGoalPda(goalHashBuffer);
      const { address: groupVaultAta, instruction: createGroupVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mint, staker);
      const goalAccount = await connection.getAccountInfo(goalPda);

      if (!goalAccount) {
        setStatus({
          step: "building",
          message: "Goal not found. Initializing goal on devnet...",
        });

        const now = Math.floor(Date.now() / 1000);
        const startsOn = now + 60;
        const endsOn = startsOn + 3600;

        const initTx = await buildInitGoalTx(
          {
            goalHash: goalHashBuffer,
            startsOn,
            endsOn,
            authority: staker,
            groupVault: groupVaultAta,
            tokenMint: mint,
          },
          staker
        );

        if (createGroupVaultIx) {
          initTx.instructions = [createGroupVaultIx, ...initTx.instructions];
        }

        await executeTransaction(initTx, "Goal init");
      }

      setStatus({
        step: "building",
        message: `Building open_stake for ${stakeAmount} USDC...`,
      });

      const openTx = await buildOpenStakeTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount,
        },
        staker
      );

      await executeTransaction(openTx, "Open stake");

      setStatus({
        step: "building",
        message: "Preparing token accounts for deposit...",
      });

      const { address: stakerAta, instruction: createStakerAtaIx } =
        await ensureAssociatedTokenAccount(connection, staker, mint, staker);
      const { address: goalVaultAta, instruction: createGoalVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mint, goalPda, true);

      const depositTx = await buildDepositStakeTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount,
        },
        stakerAta,
        goalVaultAta,
        staker
      );

      const setupInstructions = [createStakerAtaIx, createGoalVaultIx].filter(
        (ix): ix is TransactionInstruction => Boolean(ix)
      );
      if (setupInstructions.length > 0) {
        depositTx.instructions = [...setupInstructions, ...depositTx.instructions];
      }

      const depositSignature = await executeTransaction(depositTx, "Deposit stake");

      setStatus({
        step: "success",
        message: `✅ Stake deposited! Signature: ${depositSignature.slice(0, 8)}...`,
        signature: depositSignature,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      let logs: string[] | undefined;

      if (error instanceof SendTransactionError) {
        try {
          logs = await error.getLogs(getConnection());
        } catch (logError) {
          console.warn("Failed to fetch logs:", logError);
        }
      }

      setStatus({
        step: "error",
        message: `❌ Failed: ${errorMessage}`,
        error: logs ? `${errorMessage}\nLogs: ${logs.join(" | ")}` : errorMessage,
      });
      console.error("Stake test error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          Please log in with Google to test staking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Escrow Staking Test</h3>

      {!solanaWallet?.address && (
        <div className="rounded bg-orange-50 p-2 text-sm text-orange-700">
          ⚠️ No Solana wallet found. Check Privy Solana configuration.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Goal Hash</label>
        <Input
          value={goalHash}
          onChange={(e) => setGoalHash(e.target.value)}
          placeholder="32-byte goal identifier (or auto-hashed)"
          disabled={isLoading}
          className="text-xs"
        />
        <p className="text-xs text-gray-500">
          Use 64 hex chars for 32-byte hash, or any string to auto-hash
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Stake Amount (USDC)</label>
        <Input
          type="number"
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          placeholder="1"
          min="0.1"
          step="0.1"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500">
          Requires USDC in embedded wallet on devnet
        </p>
      </div>

      <Button
        onClick={handleTestStake}
        disabled={isLoading || !solanaWallet?.address}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {status.message}
          </>
        ) : (
          "Test Stake (Open)"
        )}
      </Button>

      {/* Status Display */}
      {status.step !== "idle" && (
        <div
          className={`rounded p-3 text-sm ${
            status.step === "success"
              ? "bg-green-50 text-green-700"
              : status.step === "error"
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          <div className="flex items-start gap-2">
            {status.step === "success" && <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            {status.step === "error" && <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            {["building", "signing", "broadcasting", "confirming"].includes(status.step) && (
              <Loader2 className="h-4 w-4 flex-shrink-0 mt-0.5 animate-spin" />
            )}
            <div className="flex-1">
              <p className="font-medium">{status.message}</p>
              {status.error && (
                <p className="mt-1 text-xs opacity-75">{status.error}</p>
              )}
              {status.signature && (
                <p className="mt-1 text-xs opacity-75">
                  <a
                    href={`https://explorer.solana.com/tx/${status.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    View on Solana Explorer
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="space-y-3 rounded bg-gray-50 p-3 text-xs text-gray-600">
        <div>
          <p className="font-medium">Setup Requirements:</p>
          <ul className="list-inside list-disc space-y-1 mt-1">
            <li>✅ Logged in with Google</li>
            <li>🔑 Privy embedded Solana wallet (auto-created)</li>
            <li>💰 USDC balance on devnet (need airdrop)</li>
            <li>⛽ SOL for fees (~0.001 SOL)</li>
          </ul>
        </div>

        <div>
          <p className="font-medium">How to Get Devnet Tokens:</p>
          <ol className="list-inside list-decimal space-y-1 mt-1">
            <li>
              Get USDC:{" "}
              <a
                href="https://faucet.orca.so"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:no-underline"
              >
                Orca Faucet
              </a>{" "}
              (choose devnet)
            </li>
            <li>
              Get SOL: Use Solana CLI, an online faucet, or the button below.
            </li>
            <li>Send to your embedded wallet address below</li>
          </ol>
          <Button
            onClick={handleAirdrop}
            disabled={airdropStatus === "in_progress"}
            className="mt-2 text-xs"
            variant="outline"
            size="sm"
          >
            {airdropStatus === "in_progress" && (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            )}
            {airdropStatus === "idle" && "Airdrop 1 SOL"}
            {airdropStatus === "in_progress" && "Airdropping..."}
            {airdropStatus === "success" && "Airdrop successful!"}
            {airdropStatus === "error" && "Airdrop failed. Try again."}
          </Button>
        </div>

        <div>
          <p className="font-medium">What This Does:</p>
          <ol className="list-inside list-decimal space-y-1 mt-1">
            <li>Builds open_stake instruction</li>
            <li>Signs with Privy wallet (auto)</li>
            <li>Broadcasts to Solana devnet</li>
            <li>Confirms on-chain</li>
          </ol>
        </div>

        <div className="rounded bg-blue-50 p-2 border border-blue-200">
          <p className="font-medium text-blue-700 mb-1">✨ Full Integration:</p>
          <p className="text-blue-600">
            See{" "}
            <code className="bg-white px-1 rounded text-xs">PRIVY_SOLANA_SETUP.md</code>{" "}
            for complete Privy + Solana transaction signing guide.
          </p>
        </div>
      </div>

      {solanaWallet?.address && (
        <div className="text-xs text-gray-500">
          Wallet: {solanaWallet.address.slice(0, 8)}...
          {solanaWallet.address.slice(-8)}
        </div>
      )}
    </div>
  );
}
