import { useCallback, useState } from "react";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useSolanaTransaction } from "@/app/hooks/useSolanaTransaction";
import {
  buildInitGoalTx,
  buildOpenStakeTx,
  buildDepositStakeTx,
  buildCancelBeforeStartTx,
  buildResolveSuccessTx,
  buildResolveFailureTx,
  buildOneClickStakeTx,
  buildCreateGoalAndStakeTx,
  deriveGoalPda,
  ensureAssociatedTokenAccount,
  getConnection,
  filterInstructions,
  GoalAccountData,
  StakeAccountData,
  DEVNET_USDC_MINT,
} from "@/lib/solana";

export type ActionStatus = {
  step: "idle" | "building" | "signing" | "broadcasting" | "confirming" | "success" | "error";
  message: string;
  signature?: string;
  error?: string;
};

export function useEscrowActions() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = wallets[0];
  const { sendTransaction, confirmTransaction } = useSolanaTransaction();
  
  const [status, setStatus] = useState<ActionStatus>({ step: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const connection = getConnection();
  const mintKey = new PublicKey(DEVNET_USDC_MINT);

  const getStakerPublicKey = useCallback(() => {
    if (!solanaWallet?.address) {
      throw new Error("Solana wallet not found. Please log in again.");
    }
    return new PublicKey(solanaWallet.address);
  }, [solanaWallet]);

  const executeAction = useCallback(
    async (label: string, actionFn: () => Promise<string | null>) => {
      try {
        setIsLoading(true);
        setStatus({ step: "building", message: `${label}: preparing...` });
        
        const signature = await actionFn();
        
        if (signature) {
          setStatus({
            step: "confirming",
            message: `${label}: awaiting confirmation...`,
            signature,
          });
          
          const confirmed = await confirmTransaction(signature);
          if (confirmed) {
            setStatus({
              step: "success",
              message: `✅ ${label} confirmed`,
              signature,
            });
            return signature;
          } else {
            throw new Error("Transaction confirmation failed");
          }
        }
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus({
          step: "error",
          message: `❌ ${label} failed`,
          error: message,
        });
        console.error(`${label} error:`, error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [confirmTransaction]
  );

  const initGoal = useCallback(
    async (
      goalHash: Buffer,
      startDelayMinutes: number,
      durationMinutes: number,
      resolverInput?: string
    ) => {
      return await executeAction("Initialize goal", async () => {
        const authority = getStakerPublicKey();
        const now = Math.floor(Date.now() / 1000);
        
        if (startDelayMinutes <= 0) throw new Error("Start delay must be > 0");
        if (durationMinutes <= 0) throw new Error("Duration must be > 0");

        const startsOn = now + startDelayMinutes * 60;
        const endsOn = startsOn + durationMinutes * 60;

        const { address: groupVaultAta, instruction: groupVaultIx } =
          await ensureAssociatedTokenAccount(connection, authority, mintKey, authority);

        let resolverKey: PublicKey | undefined;
        if (resolverInput?.trim().length) {
          resolverKey = new PublicKey(resolverInput.trim());
        }

        const tx = await buildInitGoalTx(
          {
            goalHash,
            startsOn,
            endsOn,
            authority,
            groupVault: groupVaultAta,
            tokenMint: mintKey,
            resolver: resolverKey,
          },
          authority
        );

        const setup = filterInstructions([groupVaultIx]);
        if (setup.length) {
          tx.instructions = [...setup, ...tx.instructions];
        }

        setStatus({ step: "signing", message: "Initialize goal: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [connection, executeAction, getStakerPublicKey, mintKey, sendTransaction]
  );

  const openStake = useCallback(
    async (goalHash: Buffer, amount: number) => {
      return await executeAction("Open stake", async () => {
        const staker = getStakerPublicKey();
        
        const tx = await buildOpenStakeTx(
          {
            goalHash,
            staker,
            amount,
          },
          staker
        );

        setStatus({ step: "signing", message: "Open stake: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [executeAction, getStakerPublicKey, sendTransaction]
  );

  const depositStake = useCallback(
    async (goal: GoalAccountData, amount: number) => {
      return await executeAction("Deposit stake", async () => {
        const staker = getStakerPublicKey();
        const [goalPda] = deriveGoalPda(goal.goalHash);

        const { address: stakerAta, instruction: stakerAtaIx } =
          await ensureAssociatedTokenAccount(connection, staker, goal.tokenMint, staker);
          
        const { address: goalVaultAta, instruction: goalVaultIx } =
          await ensureAssociatedTokenAccount(connection, staker, goal.tokenMint, goalPda, true);

        const tx = await buildDepositStakeTx(
          {
            goalHash: goal.goalHash,
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

        setStatus({ step: "signing", message: "Deposit stake: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [connection, executeAction, getStakerPublicKey, sendTransaction]
  );

  const oneClickStake = useCallback(
    async (goal: GoalAccountData, amount: number) => {
      return await executeAction("One-click stake", async () => {
        const staker = getStakerPublicKey();

        const tx = await buildOneClickStakeTx(
          {
            goalHash: goal.goalHash,
            staker,
            amount,
          },
          goal.tokenMint,
          staker
        );

        setStatus({ step: "signing", message: "One-click stake: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [executeAction, getStakerPublicKey, sendTransaction]
  );

  const createGoalAndStake = useCallback(
    async (
      goalHash: Buffer,
      startDelayMinutes: number,
      durationMinutes: number,
      amount: number,
      resolverInput?: string
    ) => {
      return await executeAction("Create goal & stake", async () => {
        const authority = getStakerPublicKey();
        const now = Math.floor(Date.now() / 1000);
        
        if (startDelayMinutes <= 0) throw new Error("Start delay must be > 0");
        if (durationMinutes <= 0) throw new Error("Duration must be > 0");

        const startsOn = now + startDelayMinutes * 60;
        const endsOn = startsOn + durationMinutes * 60;

        let resolverKey: PublicKey | undefined;
        if (resolverInput?.trim().length) {
          resolverKey = new PublicKey(resolverInput.trim());
        }

        const tx = await buildCreateGoalAndStakeTx(
          {
            goalHash,
            startsOn,
            endsOn,
            authority,
            groupVault: authority, // Placeholder, will be resolved in builder
            tokenMint: mintKey,
            resolver: resolverKey,
          },
          {
            goalHash,
            staker: authority,
            amount,
          },
          mintKey,
          authority
        );

        setStatus({ step: "signing", message: "Create & Stake: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [executeAction, getStakerPublicKey, mintKey, sendTransaction]
  );

  const cancelStake = useCallback(
    async (goal: GoalAccountData, stake: StakeAccountData) => {
      return await executeAction("Cancel stake", async () => {
        const staker = getStakerPublicKey();
        const [goalPda] = deriveGoalPda(goal.goalHash);

        const { address: stakerAta, instruction: stakerAtaIx } =
          await ensureAssociatedTokenAccount(connection, staker, goal.tokenMint, staker);
          
        const { address: goalVaultAta, instruction: goalVaultIx } =
          await ensureAssociatedTokenAccount(connection, staker, goal.tokenMint, goalPda, true);

        const tx = await buildCancelBeforeStartTx(
          {
            goalHash: goal.goalHash,
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

        setStatus({ step: "signing", message: "Cancel stake: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [connection, executeAction, getStakerPublicKey, sendTransaction]
  );

  const resolveSuccess = useCallback(
    async (goal: GoalAccountData, stake: StakeAccountData) => {
      return await executeAction("Resolve success", async () => {
        const signer = getStakerPublicKey();
        const [goalPda] = deriveGoalPda(goal.goalHash);

        const { address: stakerAta, instruction: stakerAtaIx } =
          await ensureAssociatedTokenAccount(connection, signer, goal.tokenMint, stake.staker);
          
        const { address: goalVaultAta, instruction: goalVaultIx } =
          await ensureAssociatedTokenAccount(connection, signer, goal.tokenMint, goalPda, true);

        const tx = await buildResolveSuccessTx(
          {
            goalHash: goal.goalHash,
            staker: stake.staker,
            amount: stake.amount,
          },
          stakerAta,
          goalVaultAta,
          signer,
          signer
        );

        const setup = filterInstructions([stakerAtaIx, goalVaultIx]);
        if (setup.length) {
          tx.instructions = [...setup, ...tx.instructions];
        }

        setStatus({ step: "signing", message: "Resolve success: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [connection, executeAction, getStakerPublicKey, sendTransaction]
  );

  const resolveFailure = useCallback(
    async (goal: GoalAccountData, stake: StakeAccountData) => {
      return await executeAction("Resolve failure", async () => {
        const signer = getStakerPublicKey();
        const [goalPda] = deriveGoalPda(goal.goalHash);

        const { address: goalVaultAta, instruction: goalVaultIx } =
          await ensureAssociatedTokenAccount(connection, signer, goal.tokenMint, goalPda, true);
          
        const groupVaultAta = goal.groupVault;

        const tx = await buildResolveFailureTx(
          {
            goalHash: goal.goalHash,
            staker: stake.staker,
            amount: stake.amount,
          },
          goalVaultAta,
          groupVaultAta,
          signer,
          signer
        );

        const setup = filterInstructions([goalVaultIx]);
        if (setup.length) {
          tx.instructions = [...setup, ...tx.instructions];
        }

        setStatus({ step: "signing", message: "Resolve failure: requesting signature..." });
        return await sendTransaction(tx);
      });
    },
    [connection, executeAction, getStakerPublicKey, sendTransaction]
  );

  return {
    status,
    isLoading,
    initGoal,
    openStake,
    depositStake,
    oneClickStake,
    createGoalAndStake,
    cancelStake,
    resolveSuccess,
    resolveFailure,
  };
}
