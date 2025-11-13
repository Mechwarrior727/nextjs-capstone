"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey } from "@solana/web3.js";
import {
  buildOpenStakeTx,
  buildDepositStakeTx,
  deriveGoalPda,
  deriveStakePda,
} from "@/lib/solana";
import { useSolanaTransaction } from "@/app/hooks/useSolanaTransaction";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

interface StakeDepositProps {
  goalHash: Buffer;
  groupVaultAddress: string;
}

/**
 * Component to deposit USDC stake for a goal
 * 
 * NOTE: This is a demonstration component showing the integration structure.
 * Full implementation requires Privy Solana wallet support configuration.
 */
export function StakeDeposit({ goalHash, groupVaultAddress }: StakeDepositProps) {
  const { wallets } = useWallets();
  const { sendTransaction, confirmTransaction, transactionStatus } =
    useSolanaTransaction();

  const [stakeAmount, setStakeAmount] = useState<string>("1"); // 1 USDC
  const [isLoading, setIsLoading] = useState(false);

  const handleDepositStake = async () => {
    try {
      setIsLoading(true);

      const solanaWallet = wallets[0];
      if (!solanaWallet?.address) {
        throw new Error("No Solana wallet connected");
      }

      const stakerAddress = new PublicKey(solanaWallet.address);
      const amount = Math.floor(parseFloat(stakeAmount) * 1_000_000); // Convert to raw units

      // Step 1: Open stake
      const openStakeTx = await buildOpenStakeTx(
        {
          goalHash,
          staker: stakerAddress,
          amount,
        },
        stakerAddress
      );

      const openSig = await sendTransaction(openStakeTx);
      if (!openSig) {
        throw new Error("Failed to open stake");
      }

      // Wait for confirmation
      const confirmed = await confirmTransaction(openSig);
      if (!confirmed) {
        throw new Error("Open stake transaction not confirmed");
      }

      // Step 2: Deposit stake
      const [goalPda] = deriveGoalPda(goalHash);
      const [stakePda] = deriveStakePda(goalPda, stakerAddress);

      // NOTE: In real implementation, you would:
      // 1. Query the goal account to get token_mint
      // 2. Derive Associated Token Accounts for staker and goal vault
      // 3. Create the deposit transaction with proper ATA addresses
      // 4. Send and confirm

      console.log("Stake opened successfully. Deposit step would follow...");
    } catch (error) {
      console.error("Stake deposit error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Deposit Stake</h3>

      <div className="space-y-2">
        <label className="text-sm">Amount (USDC)</label>
        <Input
          type="number"
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          placeholder="1"
          min="0.1"
          step="0.1"
          disabled={isLoading}
        />
      </div>

      <Button
        onClick={handleDepositStake}
        disabled={isLoading || !wallets.length}
        className="w-full"
      >
        {isLoading ? "Processing..." : "Deposit Stake"}
      </Button>

      {transactionStatus.status === "success" && (
        <div className="rounded bg-green-50 p-2 text-sm text-green-700">
          Success! Tx: {transactionStatus.signature?.slice(0, 8)}...
        </div>
      )}

      {transactionStatus.status === "error" && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          Error: {transactionStatus.error}
        </div>
      )}

      {transactionStatus.status === "loading" && (
        <div className="rounded bg-blue-50 p-2 text-sm text-blue-700">
          Processing transaction...
        </div>
      )}

      <div className="text-xs text-gray-500 italic">
        Note: Requires Privy Solana wallet integration and devnet USDC setup
      </div>
    </div>
  );
}
