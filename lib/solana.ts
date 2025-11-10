import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

// DevNet configuration
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_USDC_MINT = "EPjFWaJPuPj1j4q7W4R8Pg8XKk1mVjCTWC5qjLxvPeq";
export const PROGRAM_ID = new PublicKey("9CD9sjrZXwLjBRy7v6MacPrcyVHntxd5EPY2a6BvMaQG");

export function getConnection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

// Helper to get associated token account address (without creating it)
export async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  // For now, assume the ATA exists at the standard derived address
  // In production, you'd check if it exists and create if needed
  const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
  return getAssociatedTokenAddressSync(mint, owner);
}

export interface GoalParams {
  goalHash: Buffer;
  startsOn: number; // Unix timestamp
  endsOn: number;   // Unix timestamp
  authority: PublicKey;
  groupVault: PublicKey;
}

export interface StakeParams {
  goalHash: Buffer;
  staker: PublicKey;
  amount: number; // In raw token units (for USDC, 1 USDC = 1,000,000)
}

/**
 * Derives the Goal PDA
 */
export function deriveGoalPda(goalHash: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("goal"), goalHash],
    PROGRAM_ID
  );
}

/**
 * Derives the Stake PDA
 */
export function deriveStakePda(goalPda: PublicKey, staker: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), goalPda.toBuffer(), staker.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derives the Goal Vault ATA PDA
 */
export function deriveGoalVaultAta(goalPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("goal_vault"), goalPda.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Creates a transaction to initialize a goal
 * Requires: authority has SOL for fees
 */
export async function buildInitGoalTx(
  params: GoalParams,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(params.goalHash);

  // Build instruction (simplified - you'd use Anchor for proper IDL)
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.groupVault, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(DEVNET_USDC_MINT), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      Buffer.from([0x0]), // init_goal discriminator (simplified)
      params.goalHash,
      new BN(params.startsOn).toBuffer("le", 8),
      new BN(params.endsOn).toBuffer("le", 8),
    ]),
  });

  const tx = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  return tx;
}

/**
 * Creates a transaction to open a stake
 */
export async function buildOpenStakeTx(
  params: StakeParams,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(params.goalHash);
  const [stakePda] = deriveStakePda(goalPda, params.staker);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: true },
      { pubkey: params.staker, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      Buffer.from([0x1]), // open_stake discriminator (simplified)
      new BN(params.amount).toBuffer("le", 8),
    ]),
  });

  const tx = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  return tx;
}

/**
 * Creates a transaction to deposit stake (transfer USDC)
 */
export async function buildDepositStakeTx(
  params: StakeParams,
  stakerAta: PublicKey,
  goalVaultAta: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(params.goalHash);
  const [stakePda] = deriveStakePda(goalPda, params.staker);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: false },
      { pubkey: params.staker, isSigner: true, isWritable: true },
      { pubkey: stakerAta, isSigner: false, isWritable: true },
      { pubkey: goalVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0x2]), // deposit_stake discriminator (simplified)
  });

  const tx = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  return tx;
}

/**
 * Resolves a stake as success (returns funds to staker)
 */
export async function buildResolveSuccessTx(
  params: StakeParams,
  stakerAta: PublicKey,
  goalVaultAta: PublicKey,
  resolver: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(params.goalHash);
  const [stakePda] = deriveStakePda(goalPda, params.staker);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: resolver, isSigner: true, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: true },
      { pubkey: goalVaultAta, isSigner: false, isWritable: true },
      { pubkey: stakerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0x4]), // resolve_success discriminator (simplified)
  });

  const tx = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  return tx;
}

/**
 * Resolves a stake as failure (sends funds to group vault)
 */
export async function buildResolveFailureTx(
  params: StakeParams,
  goalVaultAta: PublicKey,
  groupVaultAta: PublicKey,
  resolver: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(params.goalHash);
  const [stakePda] = deriveStakePda(goalPda, params.staker);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: resolver, isSigner: true, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: true },
      { pubkey: goalVaultAta, isSigner: false, isWritable: true },
      { pubkey: groupVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0x5]), // resolve_failure discriminator (simplified)
  });

  const tx = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  return tx;
}
