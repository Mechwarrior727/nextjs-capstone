"use client";

import { useCallback, useMemo, useState } from "react";
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
  buildInitGoalTx,
  buildOpenStakeTx,
  buildDepositStakeTx,
  buildCancelBeforeStartTx,
  buildResolveSuccessTx,
  buildResolveFailureTx,
  deriveGoalPda,
  deriveGoalVaultAta,
  DEVNET_USDC_MINT,
  ensureAssociatedTokenAccount,
  fetchGoalAccount,
  fetchStakeAccount,
  getConnection,
  GoalAccountData,
  StakeAccountData,
  StakeStatus,
} from "@/lib/solana";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface TestStatus {
  step: "idle" | "building" | "signing" | "broadcasting" | "confirming" | "success" | "error";
  message: string;
  signature?: string;
  error?: string;
}

const STAKE_STATUS_LABELS: Record<StakeStatus, string> = {
  [StakeStatus.Pending]: "Pending",
  [StakeStatus.Success]: "Success",
  [StakeStatus.Failure]: "Failure",
  [StakeStatus.Canceled]: "Canceled",
};

const USDC_DECIMALS = 1_000_000;

const formatUsdc = (amount: number) =>
  (amount / USDC_DECIMALS).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleString();

const filterInstructions = (
  instructions: Array<TransactionInstruction | undefined>
): TransactionInstruction[] =>
  instructions.filter((ix): ix is TransactionInstruction => Boolean(ix));

/**
 * Comprehensive playground for the Solana escrow program.
 * Allows you to initialize goals, open stakes, deposit/cancel funds,
 * and resolve stakes as success/failure from a single UI.
 */
export function EscrowTestButton() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = wallets[0];

  const [goalInput, setGoalInput] = useState("default-test-goal-hash-32-bytes");
  const [stakeAmount, setStakeAmount] = useState("1"); // in USDC
  const [startDelayMinutes, setStartDelayMinutes] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [status, setStatus] = useState<TestStatus>({ step: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [airdropStatus, setAirdropStatus] = useState<"idle" | "in_progress" | "success" | "error">("idle");
  const [goalAccount, setGoalAccount] = useState<GoalAccountData | null>(null);
  const [stakeAccount, setStakeAccount] = useState<StakeAccountData | null>(null);

  const connection = useMemo(() => getConnection(), []);
  const mintKey = useMemo(() => new PublicKey(DEVNET_USDC_MINT), []);

  const handleError = useCallback((action: string, error: unknown) => {
    const isSendError = error instanceof SendTransactionError;
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatus({
      step: "error",
      message: `❌ ${action} failed`,
      error: message,
    });
    console.error(`${action} error:`, error);
    if (isSendError) {
      error
        .getLogs(connection)
        .then((logs) => logs && console.error("Transaction logs:", logs))
        .catch(() => undefined);
    }
  }, [connection]);

  const getGoalHashBuffer = useCallback(async () => {
    if (goalInput.length === 64 && /^[0-9a-f]{64}$/i.test(goalInput)) {
      return Buffer.from(goalInput, "hex");
    }
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(goalInput).digest();
  }, [goalInput]);

  const getStakerPublicKey = useCallback(() => {
    if (!solanaWallet?.address) {
      throw new Error("Solana wallet not found. Please log in again.");
    }
    return new PublicKey(solanaWallet.address);
  }, [solanaWallet]);

  const parseStakeAmount = useCallback(() => {
    const parsed = Number.parseFloat(stakeAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Stake amount must be greater than 0");
    }
    return Math.floor(parsed * USDC_DECIMALS);
  }, [stakeAmount]);

  const executeTransaction = useCallback(
    async (tx: Transaction, label: string) => {
      if (!solanaWallet?.signTransaction) {
        throw new Error("Privy Solana wallet not initialized yet.");
      }

      setStatus({ step: "signing", message: `${label}: requesting signature...` });

      const serializedTx = tx.serialize({ requireAllSignatures: false });
      const { signedTransaction } = await solanaWallet.signTransaction({
        transaction: serializedTx,
        chain: "solana:devnet",
      });

      setStatus({ step: "broadcasting", message: `${label}: sending to devnet...` });
      const signature = await connection.sendRawTransaction(new Uint8Array(signedTransaction));

      setStatus({
        step: "confirming",
        message: `${label}: awaiting confirmation...`,
        signature,
      });

      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      setStatus({
        step: "success",
        message: `✅ ${label} confirmed: ${signature.slice(0, 8)}...`,
        signature,
      });

      return signature;
    },
    [connection, solanaWallet]
  );

  const refreshAccounts = useCallback(
    async (announce = false) => {
      try {
        const goalHashBuffer = await getGoalHashBuffer();
        if (announce) {
          setStatus({ step: "building", message: "Refreshing on-chain state..." });
        }

        const stakerPk = solanaWallet?.address ? new PublicKey(solanaWallet.address) : null;

        const [goal, stake] = await Promise.all([
          fetchGoalAccount(goalHashBuffer),
          stakerPk ? fetchStakeAccount(goalHashBuffer, stakerPk) : Promise.resolve(null),
        ]);

        setGoalAccount(goal);
        setStakeAccount(stake);

        if (announce) {
          setStatus({
            step: "success",
            message: goal ? "On-chain state refreshed" : "Goal not found on-chain (yet)",
          });
        }
      } catch (error) {
        if (announce) {
          handleError("State refresh", error);
        } else {
          console.error("State refresh error:", error);
        }
      }
    },
    [getGoalHashBuffer, handleError, solanaWallet]
  );

  const runAction = useCallback(
    async (label: string, action: () => Promise<void>) => {
      try {
        setIsLoading(true);
        setStatus({ step: "building", message: `${label}: preparing...` });
        await action();
      } catch (error) {
        handleError(label, error);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const handleInitGoal = useCallback(async () => {
    await runAction("Initialize goal", async () => {
      const goalHashBuffer = await getGoalHashBuffer();
      const authority = getStakerPublicKey();
      const now = Math.floor(Date.now() / 1000);
      const startDelay = Number.parseInt(startDelayMinutes, 10) || 0;
      const duration = Number.parseInt(durationMinutes, 10) || 0;

      if (startDelay <= 0) {
        throw new Error("Start delay must be greater than 0 minutes for testing.");
      }
      if (duration <= 0) {
        throw new Error("Duration must be greater than 0 minutes.");
      }

      const startsOn = now + startDelay * 60;
      const endsOn = startsOn + duration * 60;

      const { address: groupVaultAta, instruction: groupVaultIx } =
        await ensureAssociatedTokenAccount(connection, authority, mintKey, authority);

      const tx = await buildInitGoalTx(
        {
          goalHash: goalHashBuffer,
          startsOn,
          endsOn,
          authority,
          groupVault: groupVaultAta,
          tokenMint: mintKey,
        },
        authority
      );

      const setup = filterInstructions([groupVaultIx]);
      if (setup.length) {
        tx.instructions = [...setup, ...tx.instructions];
      }

      await executeTransaction(tx, "Initialize goal");
      await refreshAccounts();
    });
  }, [
    connection,
    durationMinutes,
    executeTransaction,
    getGoalHashBuffer,
    getStakerPublicKey,
    mintKey,
    refreshAccounts,
    runAction,
    startDelayMinutes,
  ]);

  const handleOpenStake = useCallback(async () => {
    await runAction("Open stake", async () => {
      if (!goalAccount) {
        throw new Error("Goal is not initialized yet. Initialize or refresh first.");
      }

      const goalHashBuffer = await getGoalHashBuffer();
      const staker = getStakerPublicKey();
      const amount = parseStakeAmount();

      const tx = await buildOpenStakeTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount,
        },
        staker
      );

      await executeTransaction(tx, "Open stake");
      await refreshAccounts();
    });
  }, [
    executeTransaction,
    getGoalHashBuffer,
    getStakerPublicKey,
    goalAccount,
    parseStakeAmount,
    refreshAccounts,
    runAction,
  ]);

  const handleDepositStake = useCallback(async () => {
    await runAction("Deposit stake", async () => {
      if (!goalAccount) {
        throw new Error("Goal is not initialized yet.");
      }
      if (!stakeAccount) {
        throw new Error("Stake not opened yet. Open a stake before depositing.");
      }

      const goalHashBuffer = await getGoalHashBuffer();
      const staker = getStakerPublicKey();
      const amount = parseStakeAmount();
      const [goalPda] = deriveGoalPda(goalHashBuffer);

      const { address: stakerAta, instruction: stakerAtaIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, staker);
      const { address: goalVaultAta, instruction: goalVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, goalPda, true);

      const tx = await buildDepositStakeTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount,
        },
        stakerAta,
        goalVaultAta,
        staker
      );

      const setup = filterInstructions([stakerAtaIx, goalVaultIx]);
      if (setup.length) {
        tx.instructions = [...setup, ...tx.instructions];
      }

      await executeTransaction(tx, "Deposit stake");
      await refreshAccounts();
    });
  }, [
    connection,
    executeTransaction,
    getGoalHashBuffer,
    getStakerPublicKey,
    goalAccount,
    mintKey,
    parseStakeAmount,
    refreshAccounts,
    runAction,
    stakeAccount,
  ]);

  const handleCancelStake = useCallback(async () => {
    await runAction("Cancel stake", async () => {
      if (!goalAccount || !stakeAccount) {
        throw new Error("An active stake is required to cancel.");
      }

      const now = Math.floor(Date.now() / 1000);
      if (now >= goalAccount.startsOn) {
        throw new Error("Goal already started; cannot cancel.");
      }

      const goalHashBuffer = await getGoalHashBuffer();
      const staker = getStakerPublicKey();
      const [goalPda] = deriveGoalPda(goalHashBuffer);

      const { address: stakerAta, instruction: stakerAtaIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, staker);
      const { address: goalVaultAta, instruction: goalVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, goalPda, true);

      const tx = await buildCancelBeforeStartTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount: stakeAccount.amount,
        },
        stakerAta,
        goalVaultAta,
        staker
      );

      const setup = filterInstructions([stakerAtaIx, goalVaultIx]);
      if (setup.length) {
        tx.instructions = [...setup, ...tx.instructions];
      }

      await executeTransaction(tx, "Cancel stake");
      await refreshAccounts();
    });
  }, [
    connection,
    executeTransaction,
    getGoalHashBuffer,
    getStakerPublicKey,
    goalAccount,
    mintKey,
    refreshAccounts,
    runAction,
    stakeAccount,
  ]);

  const handleResolveSuccess = useCallback(async () => {
    await runAction("Resolve success", async () => {
      if (!goalAccount || !stakeAccount) {
        throw new Error("Goal and stake must exist before resolving.");
      }

      const now = Math.floor(Date.now() / 1000);
      if (now < goalAccount.endsOn) {
        throw new Error("Goal has not ended yet. Wait until the end time.");
      }

      const goalHashBuffer = await getGoalHashBuffer();
      const staker = getStakerPublicKey();
      const [goalPda] = deriveGoalPda(goalHashBuffer);

      const { address: stakerAta, instruction: stakerAtaIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, staker);
      const { address: goalVaultAta, instruction: goalVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, goalPda, true);

      const tx = await buildResolveSuccessTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount: stakeAccount.amount,
        },
        stakerAta,
        goalVaultAta,
        staker,
        staker
      );

      const setup = filterInstructions([stakerAtaIx, goalVaultIx]);
      if (setup.length) {
        tx.instructions = [...setup, ...tx.instructions];
      }

      await executeTransaction(tx, "Resolve success");
      await refreshAccounts();
    });
  }, [
    connection,
    executeTransaction,
    getGoalHashBuffer,
    getStakerPublicKey,
    goalAccount,
    mintKey,
    refreshAccounts,
    runAction,
    stakeAccount,
  ]);

  const handleResolveFailure = useCallback(async () => {
    await runAction("Resolve failure", async () => {
      if (!goalAccount || !stakeAccount) {
        throw new Error("Goal and stake must exist before resolving.");
      }

      const now = Math.floor(Date.now() / 1000);
      if (now < goalAccount.endsOn) {
        throw new Error("Goal has not ended yet. Wait until the end time.");
      }

      const goalHashBuffer = await getGoalHashBuffer();
      const staker = getStakerPublicKey();
      const [goalPda] = deriveGoalPda(goalHashBuffer);

      const { address: goalVaultAta, instruction: goalVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, goalPda, true);
      const { address: groupVaultAta, instruction: groupVaultIx } =
        await ensureAssociatedTokenAccount(connection, staker, mintKey, staker);

      const tx = await buildResolveFailureTx(
        {
          goalHash: goalHashBuffer,
          staker,
          amount: stakeAccount.amount,
        },
        goalVaultAta,
        groupVaultAta,
        staker,
        staker
      );

      const setup = filterInstructions([goalVaultIx, groupVaultIx]);
      if (setup.length) {
        tx.instructions = [...setup, ...tx.instructions];
      }

      await executeTransaction(tx, "Resolve failure");
      await refreshAccounts();
    });
  }, [
    connection,
    executeTransaction,
    getGoalHashBuffer,
    getStakerPublicKey,
    goalAccount,
    mintKey,
    refreshAccounts,
    runAction,
    stakeAccount,
  ]);

  const handleAirdrop = useCallback(async () => {
    if (!solanaWallet?.address) {
      alert("Solana wallet not found. Please log in again.");
      return;
    }

    setAirdropStatus("in_progress");
    try {
      const staker = new PublicKey(solanaWallet.address);
      const signature = await connection.requestAirdrop(staker, 1 * 1e9);
      await connection.confirmTransaction(signature, "confirmed");
      setAirdropStatus("success");
    } catch (error) {
      console.error("Airdrop failed:", error);
      setAirdropStatus("error");
    }
  }, [connection, solanaWallet]);

  if (!authenticated) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          Please log in with Google to test staking.
        </p>
      </div>
    );
  }

  const goalVaultAddress =
    goalAccount && deriveGoalVaultAta(goalAccount.goalPda, goalAccount.tokenMint);

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div>
        <h3 className="text-lg font-semibold">Escrow Playground</h3>
        <p className="text-sm text-gray-600">
          Create a goal, open and fund stakes, then cancel or resolve them to test every branch of the
          Anchor program on devnet USDC.
        </p>
      </div>

      {!solanaWallet?.address && (
        <div className="rounded bg-orange-50 p-2 text-sm text-orange-700">
          ⚠️ No Solana wallet found. Check Privy Solana configuration.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded border p-4">
          <h4 className="font-semibold">Goal Setup</h4>
          <div className="space-y-2">
            <label className="text-sm font-medium">Goal Identifier</label>
            <Input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="32-byte hash or any string"
              disabled={isLoading}
              className="text-xs"
            />
            <p className="text-xs text-gray-500">
              Provide 64 hex chars for a deterministic hash or enter any text to auto-hash via SHA-256.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Start Delay (minutes)</label>
              <Input
                type="number"
                min={1}
                value={startDelayMinutes}
                onChange={(e) => setStartDelayMinutes(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Duration (minutes)</label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleInitGoal} disabled={isLoading || !solanaWallet?.address}>
              Initialize Goal
            </Button>
            <Button
              variant="outline"
              onClick={() => refreshAccounts(true)}
              disabled={isLoading}
            >
              Refresh On-Chain State
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded border p-4">
          <h4 className="font-semibold">Stake Funding</h4>
          <div>
            <label className="text-sm font-medium">Stake Amount (USDC)</label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Requires devnet USDC (mint {DEVNET_USDC_MINT}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleOpenStake} disabled={isLoading || !solanaWallet?.address}>
              Open Stake
            </Button>
            <Button onClick={handleDepositStake} disabled={isLoading || !solanaWallet?.address}>
              Deposit Stake
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded border p-4">
        <h4 className="font-semibold">Resolution Controls</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleCancelStake}
            disabled={isLoading || !solanaWallet?.address}
          >
            Cancel Before Start
          </Button>
          <Button
            variant="outline"
            onClick={handleResolveSuccess}
            disabled={isLoading || !solanaWallet?.address}
          >
            Resolve Success
          </Button>
          <Button
            variant="outline"
            onClick={handleResolveFailure}
            disabled={isLoading || !solanaWallet?.address}
          >
            Resolve Failure
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Resolve actions require the goal to be past its end time. Cancel is only available before the start time.
        </p>
      </div>

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
            {status.step === "success" && (
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            {status.step === "error" && (
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            {["building", "signing", "broadcasting", "confirming"].includes(status.step) && (
              <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" />
            )}
            <div className="flex-1">
              <p className="font-medium">{status.message}</p>
              {status.error && (
                <p className="mt-1 text-xs opacity-75">{status.error}</p>
              )}
              {status.signature && (
                <p className="mt-1 text-xs">
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded border p-4 text-sm">
          <h4 className="font-semibold">Goal Snapshot</h4>
          {goalAccount ? (
            <dl className="space-y-1">
              <div>
                <dt className="text-gray-500">Goal PDA</dt>
                <dd className="font-mono text-xs break-all">{goalAccount.goalPda.toBase58()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Goal Hash</dt>
                <dd className="font-mono text-xs break-all">
                  {goalAccount.goalHash.toString("hex")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Authority</dt>
                <dd className="font-mono text-xs break-all">
                  {goalAccount.authority.toBase58()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Group Vault ATA</dt>
                <dd className="font-mono text-xs break-all">
                  {goalAccount.groupVault.toBase58()}
                </dd>
              </div>
              {goalVaultAddress && (
                <div>
                  <dt className="text-gray-500">Goal Vault ATA</dt>
                  <dd className="font-mono text-xs break-all">{goalVaultAddress.toBase58()}</dd>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-gray-500">Starts</dt>
                  <dd>{formatTimestamp(goalAccount.startsOn)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Ends</dt>
                  <dd>{formatTimestamp(goalAccount.endsOn)}</dd>
                </div>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">No on-chain goal found yet.</p>
          )}
        </div>

        <div className="space-y-2 rounded border p-4 text-sm">
          <h4 className="font-semibold">Stake Snapshot</h4>
          {stakeAccount ? (
            <dl className="space-y-1">
              <div>
                <dt className="text-gray-500">Stake PDA</dt>
                <dd className="font-mono text-xs break-all">{stakeAccount.stakePda.toBase58()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Amount</dt>
                <dd>{formatUsdc(stakeAccount.amount)} USDC</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd>{STAKE_STATUS_LABELS[stakeAccount.status]}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{formatTimestamp(stakeAccount.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">Stake not opened yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium">Funding helpers</p>
        <ul className="list-inside list-disc space-y-1">
          <li>✅ Logged in with Privy (Google)</li>
          <li>🔑 Privy embedded Solana wallet (auto-created)</li>
          <li>💰 Devnet USDC from{" "}
            <a
              className="text-blue-600 underline hover:no-underline"
              href="https://faucet.orca.so"
              target="_blank"
              rel="noopener noreferrer"
            >
              Orca Faucet
            </a>
          </li>
          <li>⛽ SOL for fees (~0.001 SOL). Use the button below for 1 SOL.</li>
        </ul>
        <Button
          onClick={handleAirdrop}
          disabled={airdropStatus === "in_progress"}
          className="text-xs"
          variant="outline"
        >
          {airdropStatus === "in_progress" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {airdropStatus === "idle" && "Airdrop 1 SOL"}
          {airdropStatus === "in_progress" && "Airdropping..."}
          {airdropStatus === "success" && "Airdrop successful!"}
          {airdropStatus === "error" && "Airdrop failed. Try again."}
        </Button>
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
