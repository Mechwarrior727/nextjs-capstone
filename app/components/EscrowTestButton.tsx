"use client";

import { Buffer } from "buffer";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  deriveGoalVaultAta,
  DEVNET_USDC_MINT,
  fetchGoalAccount,
  fetchStakeAccount,
  getConnection,
  GoalAccountData,
  StakeAccountData,
  StakeStatus,
} from "@/lib/solana";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useEscrowActions, ActionStatus } from "@/app/hooks/useEscrowActions";

interface DbGoalSummary {
  id: string;
  title: string;
  group_id: string | null;
  starts_on: string;
  ends_on: string;
  creator_id: string;
  groups?: { id: string; name: string | null } | null;
}

const STAKE_STATUS_LABELS: Record<StakeStatus, string> = {
  [StakeStatus.Pending]: "Pending",
  [StakeStatus.Funded]: "Funded",
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

/**
 * Comprehensive playground for the Solana escrow program.
 * Allows you to initialize goals, open stakes, deposit/cancel funds,
 * and resolve stakes as success/failure from a single UI.
 */
export function EscrowTestButton() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = wallets[0];

  const {
    status: actionStatus,
    isLoading: isActionLoading,
    initGoal,
    openStake,
    depositStake,
    oneClickStake,
    cancelStake,
    resolveSuccess,
    resolveFailure,
  } = useEscrowActions();

  const [goalInput, setGoalInput] = useState("default-test-goal-hash-32-bytes");
  const [stakeAmount, setStakeAmount] = useState("1"); // in USDC
  const [startDelayMinutes, setStartDelayMinutes] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [resolverInput, setResolverInput] = useState("");
  
  // Local status for non-transaction actions (like refreshing)
  const [localStatus, setLocalStatus] = useState<ActionStatus>({ step: "idle", message: "" });
  
  const [airdropStatus, setAirdropStatus] = useState<"idle" | "in_progress" | "success" | "error">("idle");
  const [goalAccount, setGoalAccount] = useState<GoalAccountData | null>(null);
  const [stakeAccount, setStakeAccount] = useState<StakeAccountData | null>(null);
  const [dbGoals, setDbGoals] = useState<DbGoalSummary[]>([]);
  const [dbGoalsLoading, setDbGoalsLoading] = useState(false);
  const [dbGoalsError, setDbGoalsError] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ sol: number | null; usdc: number | null }>({
    sol: null,
    usdc: null,
  });

  const connection = useMemo(() => getConnection(), []);
  const mintKey = useMemo(() => new PublicKey(DEVNET_USDC_MINT), []);

  // Combine statuses for display
  const status = isActionLoading || actionStatus.step !== "idle" ? actionStatus : localStatus;
  const isLoading = isActionLoading || localStatus.step === "building";

  const refreshBalances = useCallback(async () => {
    if (!solanaWallet?.address) {
      setBalances({ sol: null, usdc: null });
      return;
    }

    try {
      const owner = new PublicKey(solanaWallet.address);
      const [solLamports, tokenAccounts] = await Promise.all([
        connection.getBalance(owner, "confirmed"),
        connection.getParsedTokenAccountsByOwner(owner, { mint: mintKey }),
      ]);

      const parsedAmount =
        tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount
          .uiAmount ?? 0;

      setBalances({
        sol: solLamports / LAMPORTS_PER_SOL,
        usdc: Number(parsedAmount ?? 0),
      });
    } catch (error) {
      console.error("Balance fetch error:", error);
    }
  }, [connection, mintKey, solanaWallet]);

  const fetchDbGoals = useCallback(async () => {
    if (!authenticated) {
      setDbGoals([]);
      setDbGoalsError(null);
      return;
    }

    setDbGoalsLoading(true);
    setDbGoalsError(null);
    try {
      const res = await fetch("/api/finance/goals");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to load goals");
      }
      const payload = await res.json();
      setDbGoals(payload?.data ?? []);
    } catch (error) {
      setDbGoals([]);
      setDbGoalsError(
        error instanceof Error ? error.message : "Failed to load goals"
      );
    } finally {
      setDbGoalsLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  useEffect(() => {
    fetchDbGoals();
  }, [fetchDbGoals]);

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
            setLocalStatus({
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
          setLocalStatus({ step: "building", message: "Refreshing on-chain state..." });
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

        await refreshBalances();

        if (announce) {
          setLocalStatus({
            step: "success",
            message: goal ? "On-chain state refreshed" : "Goal not found on-chain (yet)",
          });
        }

        return { goal, stake };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (announce) {
          setLocalStatus({
            step: "error",
            message: "❌ State refresh failed",
            error: message,
          });
        } else {
          console.error("State refresh error:", error);
        }
        setGoalAccount(null);
        setStakeAccount(null);
        return { goal: null, stake: null };
      }
    },
    [getGoalHashBuffer, goalInput, refreshBalances, solanaWallet]
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

  const handleInitGoal = async () => {
    if (!solanaWallet?.address) {
      setLocalStatus({
        step: "error",
        message: "No Solana wallet connected",
        error: "Please connect a Solana wallet to continue.",
      });
      return;
    }
    const goalHashBuffer = await getGoalHashBuffer();
    const startDelay = Number.parseInt(startDelayMinutes, 10) || 0;
    const duration = Number.parseInt(durationMinutes, 10) || 0;
    
    await initGoal(goalHashBuffer, startDelay, duration, resolverInput);
    await refreshAccounts();
  };

  const handleOpenStake = async () => {
    const goalHashBuffer = await getGoalHashBuffer();
    const amount = parseStakeAmount();
    
    // Ensure goal exists first
    await requireGoalAccount();
    
    await openStake(goalHashBuffer, amount);
    await refreshAccounts();
  };

  const handleDepositStake = async () => {
    const { goal } = await requireStakeAccount();
    const amount = parseStakeAmount();
    
    await depositStake(goal, amount);
    await refreshAccounts();
  };

  const handleOneClickStake = async () => {
    const goal = await requireGoalAccount();
    const amount = parseStakeAmount();
    
    await oneClickStake(goal, amount);
    await refreshAccounts();
  };

  const handleCancelStake = async () => {
    const { goal, stake } = await requireStakeAccount();
    
    await cancelStake(goal, stake);
    await refreshAccounts();
  };

  const handleResolveSuccess = async () => {
    const { goal, stake } = await requireStakeAccount();
    
    await resolveSuccess(goal, stake);
    await refreshAccounts();
  };

  const handleResolveFailure = async () => {
    const { goal, stake } = await requireStakeAccount();
    
    await resolveFailure(goal, stake);
    await refreshAccounts();
  };

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
      await refreshBalances();
    } catch (error) {
      console.error("Airdrop failed:", error);
      setAirdropStatus("error");
    }
  }, [connection, refreshBalances, solanaWallet]);

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
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">USDC Balance</p>
          <p className="text-2xl font-bold text-slate-900">
            {balances.usdc !== null ? `${balances.usdc.toFixed(4)} USDC` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">SOL Balance</p>
          <p className="text-2xl font-bold text-slate-900">
            {balances.sol !== null ? `${balances.sol.toFixed(4)} SOL` : "—"}
          </p>
        </div>
      </div>

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
              placeholder="Enter unique string or 32-byte hex"
              className="font-mono text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-600">Start Delay (min)</label>
                <Input
                  type="number"
                  value={startDelayMinutes}
                  onChange={(e) => setStartDelayMinutes(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Duration (min)</label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Resolver (Optional)</label>
              <Input
                value={resolverInput}
                onChange={(e) => setResolverInput(e.target.value)}
                placeholder="Defaults to you (authority)"
                className="font-mono text-xs"
              />
            </div>
            <Button
              onClick={handleInitGoal}
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              Initialize Goal
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border-2 border-emerald-300 bg-white p-4 shadow-sm">
          <h4 className="font-bold text-lg text-emerald-900 border-b-2 border-emerald-300 pb-2">
            2️⃣ Stake Funding
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-sm font-semibold text-gray-800">Amount (USDC)</label>
              <Input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="0.000001"
                step="1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleOpenStake}
                disabled={isLoading}
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              >
                Open Stake
              </Button>
              <Button
                onClick={handleDepositStake}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Deposit USDC
              </Button>
            </div>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or do both</span>
              </div>
            </div>
            <Button
              onClick={handleOneClickStake}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              One-Click Stake (Open + Deposit)
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border-2 border-rose-300 bg-white p-4 shadow-sm">
          <h4 className="font-bold text-lg text-rose-900 border-b-2 border-rose-300 pb-2">
            3️⃣ Resolution
          </h4>
          <div className="space-y-2">
            <Button
              onClick={handleCancelStake}
              disabled={isLoading}
              variant="outline"
              className="w-full border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              Cancel Before Start
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleResolveSuccess}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                Resolve Success
              </Button>
              <Button
                onClick={handleResolveFailure}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                Resolve Failure
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border-2 border-slate-300 bg-white p-4 shadow-sm">
          <h4 className="font-bold text-lg text-slate-900 border-b-2 border-slate-300 pb-2">
            4️⃣ Utilities
          </h4>
          <div className="space-y-2">
            <Button
              onClick={() => refreshAccounts(true)}
              disabled={isLoading}
              variant="secondary"
              className="w-full"
            >
              Refresh On-Chain State
            </Button>
            <Button
              onClick={handleAirdrop}
              disabled={airdropStatus === "in_progress" || isLoading}
              variant="outline"
              className="w-full"
            >
              {airdropStatus === "in_progress" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Airdrop 1 SOL (Devnet)
            </Button>
            {airdropStatus === "success" && (
              <p className="text-center text-xs text-green-600">Airdrop successful!</p>
            )}
            {airdropStatus === "error" && (
              <p className="text-center text-xs text-red-600">Airdrop failed</p>
            )}
          </div>
        </div>
      </div>

      {/* Status Panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="mb-2 font-bold text-gray-900">Transaction Status</h4>
        <div className="flex items-center gap-3 rounded bg-gray-50 p-3">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          ) : status.step === "success" ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : status.step === "error" ? (
            <XCircle className="h-5 w-5 text-red-600" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {status.message || "Ready"}
            </p>
            {status.error && (
              <p className="mt-1 text-xs text-red-600">{status.error}</p>
            )}
            {status.signature && (
              <a
                href={`https://explorer.solana.com/tx/${status.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-blue-600 hover:underline"
              >
                View on Explorer ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* On-Chain State Inspector */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="mb-2 font-bold text-gray-900">On-Chain State Inspector</h4>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase text-gray-500">
              Goal Account
            </h5>
            {goalAccount ? (
              <div className="rounded bg-slate-900 p-3 text-xs text-slate-50 font-mono overflow-x-auto">
                <p>PDA: {goalAccount.goalPda.toBase58()}</p>
                <p>Hash: {Buffer.from(goalAccount.goalHash).toString("hex")}</p>
                <p>Auth: {goalAccount.authority.toBase58()}</p>
                <p>Starts: {formatTimestamp(goalAccount.startsOn)}</p>
                <p>Ends: {formatTimestamp(goalAccount.endsOn)}</p>
                <p>Vault: {goalVaultAddress?.toBase58()}</p>
              </div>
            ) : (
              <div className="rounded bg-gray-100 p-3 text-xs text-gray-500 italic">
                Not initialized
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase text-gray-500">
              Stake Account
            </h5>
            {stakeAccount ? (
              <div className="rounded bg-slate-900 p-3 text-xs text-slate-50 font-mono overflow-x-auto">
                <p>PDA: {stakeAccount.stakePda.toBase58()}</p>
                <p>Staker: {stakeAccount.staker.toBase58()}</p>
                <p>Amount: {formatUsdc(stakeAccount.amount)} USDC</p>
                <p>Status: {STAKE_STATUS_LABELS[stakeAccount.status]}</p>
                <p>Created: {formatTimestamp(stakeAccount.createdAt)}</p>
              </div>
            ) : (
              <div className="rounded bg-gray-100 p-3 text-xs text-gray-500 italic">
                No stake found
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* DB Goals Inspector */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-gray-900">Database Goals (Sync Check)</h4>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchDbGoals}
            disabled={dbGoalsLoading}
          >
            {dbGoalsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        
        {dbGoalsError && (
          <p className="text-xs text-red-600 mb-2">{dbGoalsError}</p>
        )}
        
        {dbGoals.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {dbGoals.map((goal) => (
              <div key={goal.id} className="rounded border border-gray-200 p-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>{goal.title}</span>
                  <span className="text-gray-500">{goal.id.slice(0, 8)}...</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1 text-gray-600">
                  <p>Start: {new Date(goal.starts_on).toLocaleDateString()}</p>
                  <p>End: {new Date(goal.ends_on).toLocaleDateString()}</p>
                  <p>Group: {goal.groups?.name || "None"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded bg-gray-100 p-3 text-xs text-gray-500 italic">
            No goals found in database
          </div>
        )}
      </div>
    </div>
  );
}
