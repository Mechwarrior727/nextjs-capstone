import { useCallback, useMemo, useState } from "react";
import { Transaction, PublicKey } from "@solana/web3.js";
import { useWallets } from "@privy-io/react-auth/solana";
import { getConnection } from "@/lib/solana";

export interface TransactionStatus {
  status: "idle" | "loading" | "success" | "error";
  signature?: string;
  error?: string;
}

/**
 * Hook to send Solana transactions using Privy embedded wallet
 * Note: This requires Privy to support Solana wallets in your configuration
 */
export function useSolanaTransaction() {
  const { wallets } = useWallets();
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({
    status: "idle",
  });
  const connection = useMemo(() => getConnection(), []);

  const sendTransaction = useCallback(
    async (transaction: Transaction): Promise<string | null> => {
      try {
        setTransactionStatus({ status: "loading" });

        const solanaWallet = wallets[0];
        if (!solanaWallet?.signTransaction) {
          throw new Error("Privy Solana wallet not found or not initialized.");
        }

        if (!transaction.recentBlockhash) {
          const { blockhash } = await connection.getLatestBlockhash("confirmed");
          transaction.recentBlockhash = blockhash;
        }

        if (!transaction.feePayer) {
          if (!solanaWallet.address) {
            throw new Error("Wallet address missing for fee payer assignment.");
          }
          transaction.feePayer = new PublicKey(solanaWallet.address);
        }

        const serializedTx = transaction.serialize({ requireAllSignatures: false });
        const { signedTransaction } = await solanaWallet.signTransaction({
          transaction: serializedTx,
          chain: "solana:devnet",
        });

        const signature = await connection.sendRawTransaction(
          new Uint8Array(signedTransaction)
        );

        setTransactionStatus({ status: "success", signature });
        return signature;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error sending transaction";
        setTransactionStatus({ status: "error", error: errorMessage });
        console.error("Transaction error:", error);
        return null;
      }
    },
    [connection, wallets]
  );

  const confirmTransaction = useCallback(
    async (signature: string, maxRetries: number = 30): Promise<boolean> => {
      try {
        let confirmed = false;
        let retries = 0;

        while (!confirmed && retries < maxRetries) {
          const status = await connection.getSignatureStatus(signature);
          if (status.value?.confirmationStatus === "confirmed") {
            confirmed = true;
            setTransactionStatus({ status: "success", signature });
            return true;
          }

          if (status.value?.err) {
            throw new Error(`Transaction failed: ${status.value.err}`);
          }

          retries++;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
        }

        if (!confirmed) {
          throw new Error("Transaction confirmation timeout");
        }

        return confirmed;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Confirmation error";
        setTransactionStatus({ status: "error", error: errorMessage });
        console.error("Confirmation error:", error);
        return false;
      }
    },
    [connection]
  );

  return {
    sendTransaction,
    confirmTransaction,
    transactionStatus,
  };
}
