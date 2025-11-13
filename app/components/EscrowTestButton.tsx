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
    async (
      announce = false
    ): Promise<{
      goal: GoalAccountData | null;
      stake: StakeAccountData | null;
    }> => {
      try {
        if (!goalInput || goalInput.trim().length === 0) {
          if (announce) {
            setStatus({
              step: "error",
              message: "Goal identifier is empty",
              error: "Please enter a goal identifier before refreshing",
            });
          }
          setGoalAccount(null);
          setStakeAccount(null);
          return { goal: null, stake: null };
        }

        const goalHashBuffer = await getGoalHashBuffer();
        if (!solanaWallet?.address) {
          setGoalAccount(null);
          setStakeAccount(null);
          return { goal: null, stake: null };
        }

        if (announce) {
          setStatus({ step: "building", message: "Refreshing on-chain state..." });
        }

        const stakerPk = new PublicKey(solanaWallet.address);

        // First fetch the goal
        const goal = await fetchGoalAccount(goalHashBuffer);
        setGoalAccount(goal);

        // Only fetch stake if goal exists
        let stake: StakeAccountData | null = null;
        if (goal) {
          stake = await fetchStakeAccount(goalHashBuffer, stakerPk);
          setStakeAccount(stake);
        } else {
          setStakeAccount(null);
        }

        if (announce) {
          setStatus({
            step: "success",
            message: goal ? "On-chain state refreshed" : "Goal not found on-chain (yet)",
          });
        }

        return { goal, stake };
      } catch (error) {
        if (announce) {
          handleError("State refresh", error);
        } else {
          console.error("State refresh error:", error);
        }
        setGoalAccount(null);
        setStakeAccount(null);
        return { goal: null, stake: null };
      }
    },
    [getGoalHashBuffer, goalInput, handleError, solanaWallet]
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

  const requireGoalAccount = useCallback(async (): Promise<GoalAccountData> => {
    if (goalAccount) {
      return goalAccount;
    }
    const { goal } = await refreshAccounts();
    if (!goal) {
      throw new Error("Goal not found on-chain. Initialize or refresh the goal first.");
    }
    return goal;
  }, [goalAccount, refreshAccounts]);

  const requireStakeAccount = useCallback(async (): Promise<{
    goal: GoalAccountData;
    stake: StakeAccountData;
  }> => {
    if (goalAccount && stakeAccount) {
      return { goal: goalAccount, stake: stakeAccount };
    }
    const { goal, stake } = await refreshAccounts();
    if (!goal) {
      throw new Error("Goal not found on-chain. Initialize or refresh the goal first.");
    }
    if (!stake) {
      throw new Error("Stake not opened yet. Use Open Stake before continuing.");
    }
    return { goal, stake };
  }, [goalAccount, refreshAccounts, stakeAccount]);

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

       const { goal: existingGoal } = await refreshAccounts();
       if (existingGoal) {
         throw new Error(
           "Goal already exists on-chain. Click “Refresh On-Chain State” or choose a new identifier."
         );
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
      await requireGoalAccount();

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
    parseStakeAmount,
    refreshAccounts,
    requireGoalAccount,
    runAction,
  ]);

  const handleDepositStake = useCallback(async () => {
    await runAction("Deposit stake", async () => {
      const { stake } = await requireStakeAccount();

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
    mintKey,
    parseStakeAmount,
    refreshAccounts,
    requireStakeAccount,
    runAction,
  ]);

  const handleCancelStake = useCallback(async () => {
    await runAction("Cancel stake", async () => {
      const { goal, stake } = await requireStakeAccount();

      const now = Math.floor(Date.now() / 1000);
      if (now >= goal.startsOn) {
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
          amount: stake.amount,
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
    mintKey,
    refreshAccounts,
    requireStakeAccount,
    runAction,
  ]);

  const handleResolveSuccess = useCallback(async () => {
    await runAction("Resolve success", async () => {
      const { goal, stake } = await requireStakeAccount();

      const now = Math.floor(Date.now() / 1000);
      if (now < goal.endsOn) {
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
          amount: stake.amount,
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
    mintKey,
    refreshAccounts,
    requireStakeAccount,
    runAction,
  ]);

  const handleResolveFailure = useCallback(async () => {
    await runAction("Resolve failure", async () => {
      const { goal, stake } = await requireStakeAccount();

      const now = Math.floor(Date.now() / 1000);
      if (now < goal.endsOn) {
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
          amount: stake.amount,
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
    mintKey,
    refreshAccounts,
    requireStakeAccount,
    runAction,
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
    <div className="space-y-6 rounded-lg border-2 border-gray-800 bg-gray-50 p-6">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 rounded-lg">
        <h3 className="text-2xl font-bold text-white">Escrow Playground</h3>
        <p className="text-sm text-indigo-100 mt-1">
          Create a goal, open and fund stakes, then cancel or resolve them to test every branch of the Anchor program on devnet USDC.
        </p>
      </div>

      {!solanaWallet?.address && (
        <div className="rounded bg-orange-50 p-2 text-sm text-orange-700">
          ⚠️ No Solana wallet found. Check Privy Solana configuration.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border-2 border-indigo-300 bg-white p-4 shadow-sm">
          <h4 className="font-bold text-lg text-indigo-900 border-b-2 border-indigo-300 pb-2">
            1️⃣ Goal Setup
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-800">Goal Identifier</label>
              <button
                onClick={() => setGoalInput(`test-goal-${Date.now()}`)}
                disabled={isLoading}
                className="text-xs bg-blue-300 hover:bg-blue-400 text-blue-900 font-bold px-2 py-1 rounded"
              >
                Generate New
              </button>
            </div>
            <Input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="32-byte hash or any string"
              disabled={isLoading}
              className="text-sm font-bold text-gray-900 bg-blue-50 border-blue-400 border-2"
            />
            <p className="text-xs text-gray-700 font-medium">
              💡 Provide 64 hex chars for deterministic hash or enter any text to auto-hash via SHA-256. Click "Generate New" for a unique timestamp-based identifier.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-800">Start Delay (minutes)</label>
              <Input
                type="number"
                min={1}
                value={startDelayMinutes}
                onChange={(e) => setStartDelayMinutes(e.target.value)}
                disabled={isLoading}
                className="text-sm font-bold text-gray-900 bg-blue-50 border-blue-400 border-2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-800">Duration (minutes)</label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={isLoading}
                className="text-sm font-bold text-gray-900 bg-blue-50 border-blue-400 border-2"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleInitGoal} disabled={isLoading || !solanaWallet?.address} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Initialize Goal
            </Button>
            <Button
              variant="outline"
              onClick={() => refreshAccounts(true)}
              disabled={isLoading}
              className="border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold"
            >
              Refresh State
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border-2 border-green-300 bg-white p-4 shadow-sm">
          <h4 className="font-bold text-lg text-green-900 border-b-2 border-green-300 pb-2">
            2️⃣ Stake Funding
          </h4>
          <div>
            <label className="text-sm font-semibold text-gray-800">Stake Amount (USDC)</label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              disabled={isLoading}
              className="text-sm font-bold text-gray-900 bg-green-50 border-green-400 border-2"
            />
            <p className="text-xs text-gray-700 font-medium">
              💡 Requires devnet USDC (mint {DEVNET_USDC_MINT}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleOpenStake} disabled={isLoading || !solanaWallet?.address} className="bg-green-600 hover:bg-green-700 text-white font-bold">
              Open Stake
            </Button>
            <Button onClick={handleDepositStake} disabled={isLoading || !solanaWallet?.address} className="bg-green-600 hover:bg-green-700 text-white font-bold">
              Deposit Stake
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border-2 border-orange-300 bg-white p-4 shadow-sm">
        <h4 className="font-bold text-lg text-orange-900 border-b-2 border-orange-300 pb-2">
          3️⃣ Resolution Controls
        </h4>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCancelStake}
            disabled={isLoading || !solanaWallet?.address}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
          >
            Cancel Before Start
          </Button>
          <Button
            onClick={handleResolveSuccess}
            disabled={isLoading || !solanaWallet?.address}
            className="bg-green-700 hover:bg-green-800 text-white font-bold"
          >
            Resolve Success
          </Button>
          <Button
            onClick={handleResolveFailure}
            disabled={isLoading || !solanaWallet?.address}
            className="bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            Resolve Failure
          </Button>
        </div>
        <p className="text-sm text-gray-700 font-semibold">
          ⏰ Resolve actions require the goal to be past its end time. Cancel is only available before the start time.
        </p>
      </div>

      {status.step !== "idle" && (
        <div
          className={`rounded-lg p-4 text-sm border-2 ${
            status.step === "success"
              ? "bg-green-50 text-green-900 border-green-400"
              : status.step === "error"
              ? "bg-red-50 text-red-900 border-red-400"
              : "bg-blue-50 text-blue-900 border-blue-400"
          }`}
        >
          <div className="flex items-start gap-2">
            {status.step === "success" && (
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700" />
            )}
            {status.step === "error" && (
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-700" />
            )}
            {["building", "signing", "broadcasting", "confirming"].includes(status.step) && (
              <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin text-blue-700" />
            )}
            <div className="flex-1">
              <p className="font-bold">{status.message}</p>
              {status.error && (
                <p className="mt-2 text-sm font-semibold">{status.error}</p>
              )}
              {status.signature && (
                <p className="mt-2 text-sm">
                  <a
                    href={`https://explorer.solana.com/tx/${status.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline hover:no-underline"
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
        <div className="space-y-2 rounded-lg border-2 border-blue-300 bg-blue-50 p-4 text-sm">
          <h4 className="font-bold text-lg text-blue-900 border-b-2 border-blue-300 pb-2">
            📋 Goal Snapshot
          </h4>
          {goalAccount ? (
            <dl className="space-y-2">
              <div>
                <dt className="text-blue-800 font-semibold text-xs">Goal PDA</dt>
                <dd className="font-mono text-xs break-all text-gray-700">{goalAccount.goalPda.toBase58()}</dd>
              </div>
              <div>
                <dt className="text-blue-800 font-semibold text-xs">Goal Hash</dt>
                <dd className="font-mono text-xs break-all text-gray-700">
                  {goalAccount.goalHash.toString("hex")}
                </dd>
              </div>
              <div>
                <dt className="text-blue-800 font-semibold text-xs">Authority</dt>
                <dd className="font-mono text-xs break-all text-gray-700">
                  {goalAccount.authority.toBase58()}
                </dd>
              </div>
              <div>
                <dt className="text-blue-800 font-semibold text-xs">Group Vault ATA</dt>
                <dd className="font-mono text-xs break-all text-gray-700">
                  {goalAccount.groupVault.toBase58()}
                </dd>
              </div>
              {goalVaultAddress && (
                <div>
                  <dt className="text-blue-800 font-semibold text-xs">Goal Vault ATA</dt>
                  <dd className="font-mono text-xs break-all text-gray-700">{goalVaultAddress.toBase58()}</dd>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <dt className="text-blue-800 font-semibold text-xs">Starts</dt>
                  <dd className="text-gray-700 text-sm font-medium">{formatTimestamp(goalAccount.startsOn)}</dd>
                </div>
                <div>
                  <dt className="text-blue-800 font-semibold text-xs">Ends</dt>
                  <dd className="text-gray-700 text-sm font-medium">{formatTimestamp(goalAccount.endsOn)}</dd>
                </div>
              </div>
            </dl>
          ) : (
            <p className="text-blue-800 font-semibold">📌 No on-chain goal found yet.</p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border-2 border-purple-300 bg-purple-50 p-4 text-sm">
          <h4 className="font-bold text-lg text-purple-900 border-b-2 border-purple-300 pb-2">
            💰 Stake Snapshot
          </h4>
          {stakeAccount ? (
            <dl className="space-y-2">
              <div>
                <dt className="text-purple-800 font-semibold text-xs">Stake PDA</dt>
                <dd className="font-mono text-xs break-all text-gray-700">{stakeAccount.stakePda.toBase58()}</dd>
              </div>
              <div>
                <dt className="text-purple-800 font-semibold text-xs">Amount</dt>
                <dd className="text-gray-700 text-sm font-bold">{formatUsdc(stakeAccount.amount)} USDC</dd>
              </div>
              <div>
                <dt className="text-purple-800 font-semibold text-xs">Status</dt>
                <dd className="text-gray-700 text-sm font-bold">{STAKE_STATUS_LABELS[stakeAccount.status]}</dd>
              </div>
              <div>
                <dt className="text-purple-800 font-semibold text-xs">Created</dt>
                <dd className="text-gray-700 text-sm font-medium">{formatTimestamp(stakeAccount.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-purple-800 font-semibold">📌 Stake not opened yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border-2 border-green-400 bg-green-50 p-4">
        <p className="font-bold text-lg text-green-900">🛠️ Funding & Setup Helpers</p>
        <ul className="list-inside list-disc space-y-2 text-sm text-green-800 font-medium">
          <li>✅ Logged in with Privy (Google)</li>
          <li>🔑 Privy embedded Solana wallet (auto-created)</li>
          <li>💰 Devnet USDC from{" "}
            <a
              className="font-bold text-green-700 underline hover:text-green-900"
              href="https://faucet.orca.so"
              target="_blank"
              rel="noopener noreferrer"
            >
              Orca Faucet
            </a>
          </li>
          <li>⛽ SOL for transaction fees (~0.001 SOL per transaction). Click the button below to get 1 SOL.</li>
        </ul>
        <Button
          onClick={handleAirdrop}
          disabled={airdropStatus === "in_progress"}
          className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold"
        >
          {airdropStatus === "in_progress" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {airdropStatus === "idle" && "🚀 Airdrop 1 SOL"}
          {airdropStatus === "in_progress" && "Airdropping..."}
          {airdropStatus === "success" && "✓ Airdrop successful!"}
          {airdropStatus === "error" && "❌ Airdrop failed. Try again."}
        </Button>
      </div>

      {solanaWallet?.address && (
        <div className="rounded-lg bg-gray-700 text-white p-3 text-sm font-semibold">
          🔐 Connected Wallet: <code className="text-yellow-300">{solanaWallet.address.slice(0, 8)}...{solanaWallet.address.slice(-8)}</code>
        </div>
      )}
    </div>
  );
}
