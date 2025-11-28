import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import habitTrackerAnchorIdl from "@/lib/idl/habit_tracker_anchor.json";

type ProgramIdl = anchor.Idl & { address: string };

const IDL = habitTrackerAnchorIdl as unknown as ProgramIdl;
const INSTRUCTION_CODER = new anchor.BorshInstructionCoder(IDL);
const ACCOUNTS_CODER = new anchor.BorshAccountsCoder(IDL);

// DevNet configuration
export const DEVNET_RPC = "https://devnet.helius-rpc.com/?api-key=3a8dbca3-c068-49c7-9d16-f1224d21aa32";
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const PROGRAM_ID = new PublicKey(IDL.address);

export function getConnection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

export async function ensureAssociatedTokenAccount(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false
): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
  const address = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const info = await connection.getAccountInfo(address);
  if (!info) {
    return {
      address,
      instruction: createAssociatedTokenAccountInstruction(
        payer,
        address,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    };
  }

  return { address };
}

export interface GoalParams {
  goalHash: Buffer;
  startsOn: number; // Unix timestamp
  endsOn: number;   // Unix timestamp
  authority: PublicKey;
  groupVault: PublicKey;
  tokenMint: PublicKey;
  resolver?: PublicKey;
}

export interface StakeParams {
  goalHash: Buffer;
  staker: PublicKey;
  amount: number; // In raw token units (for USDC, 1 USDC = 1,000,000)
}

export enum StakeStatus {
  Pending = 0,
  Funded = 1,
  Success = 2,
  Failure = 3,
  Canceled = 4,
}

export interface GoalAccountData {
  goalPda: PublicKey;
  goalHash: Buffer;
  authority: PublicKey;
  resolver: PublicKey;
  groupVault: PublicKey;
  tokenMint: PublicKey;
  startsOn: number;
  endsOn: number;
}

export interface StakeAccountData {
  stakePda: PublicKey;
  goal: PublicKey;
  staker: PublicKey;
  amount: number;
  status: StakeStatus;
  createdAt: number;
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
export function deriveGoalVaultAta(goalPda: PublicKey, mint?: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    mint ?? new PublicKey(DEVNET_USDC_MINT),
    goalPda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
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
  const resolver = params.resolver ?? params.authority;

  const data = INSTRUCTION_CODER.encode("init_goal", {
    goal_hash: Array.from(params.goalHash),
    starts_on: new anchor.BN(params.startsOn),
    ends_on: new anchor.BN(params.endsOn),
    resolver,
  });

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.groupVault, isSigner: false, isWritable: false },
      { pubkey: params.tokenMint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return finalizeTransaction(connection, payer, [instruction]);
}

/**
 * Creates a transaction to open a stake
 */
export async function buildOpenStakeTx(
  params: StakeParams,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const { goalPda, stakePda } = getStakeAddresses(
    params.goalHash,
    params.staker
  );
  const instruction = createOpenStakeInstruction(
    goalPda,
    stakePda,
    params.staker,
    params.amount
  );

  return finalizeTransaction(connection, payer, [instruction]);
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
  const { goalPda, stakePda } = getStakeAddresses(
    params.goalHash,
    params.staker
  );
  const instruction = createDepositStakeInstruction(
    goalPda,
    stakePda,
    params.staker,
    stakerAta,
    goalVaultAta
  );

  return finalizeTransaction(connection, payer, [instruction]);
}

export async function buildOneClickStakeTx(
  params: StakeParams,
  mint: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const { goalPda, stakePda } = getStakeAddresses(
    params.goalHash,
    params.staker
  );

  const stakerAtaInfo = await ensureAssociatedTokenAccount(
    connection,
    payer,
    mint,
    params.staker
  );

  const goalVaultInfo = await ensureAssociatedTokenAccount(
    connection,
    payer,
    mint,
    goalPda,
    true
  );

  const instructions: TransactionInstruction[] = [];
  if (stakerAtaInfo.instruction) {
    instructions.push(stakerAtaInfo.instruction);
  }
  if (goalVaultInfo.instruction) {
    instructions.push(goalVaultInfo.instruction);
  }

  instructions.push(
    createOpenStakeInstruction(
      goalPda,
      stakePda,
      params.staker,
      params.amount
    )
  );

  instructions.push(
    createDepositStakeInstruction(
      goalPda,
      stakePda,
      params.staker,
      stakerAtaInfo.address,
      goalVaultInfo.address
    )
  );

  return finalizeTransaction(connection, payer, instructions);
}

export async function buildCreateGoalAndStakeTx(
  goalParams: GoalParams,
  stakeParams: StakeParams,
  mint: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(goalParams.goalHash);
  const { stakePda } = getStakeAddresses(goalParams.goalHash, stakeParams.staker);
  const resolver = goalParams.resolver ?? goalParams.authority;

  // 1. Ensure Group Vault ATA (for init_goal)
  // Note: goalParams.groupVault is passed in, but we should ensure it exists if it's the payer's ATA
  const groupVaultInfo = await ensureAssociatedTokenAccount(
    connection,
    payer,
    mint,
    goalParams.authority
  );

  // 2. Ensure Staker ATA (for deposit_stake)
  const stakerAtaInfo = await ensureAssociatedTokenAccount(
    connection,
    payer,
    mint,
    stakeParams.staker
  );

  // 3. Ensure Goal Vault ATA (for deposit_stake)
  const goalVaultInfo = await ensureAssociatedTokenAccount(
    connection,
    payer,
    mint,
    goalPda,
    true
  );

  const instructions: TransactionInstruction[] = [];

  // Add ATA creation instructions if needed
  if (groupVaultInfo.instruction) instructions.push(groupVaultInfo.instruction);
  // Avoid duplicate instructions if staker == authority (likely)
  if (stakerAtaInfo.instruction && stakerAtaInfo.address.toBase58() !== groupVaultInfo.address.toBase58()) {
    instructions.push(stakerAtaInfo.instruction);
  }
  if (goalVaultInfo.instruction) instructions.push(goalVaultInfo.instruction);

  // 4. Init Goal Instruction
  const initData = INSTRUCTION_CODER.encode("init_goal", {
    goal_hash: Array.from(goalParams.goalHash),
    starts_on: new anchor.BN(goalParams.startsOn),
    ends_on: new anchor.BN(goalParams.endsOn),
    resolver,
  });

  instructions.push(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: true },
      { pubkey: goalParams.authority, isSigner: true, isWritable: true },
      { pubkey: groupVaultInfo.address, isSigner: false, isWritable: false }, // Use verified address
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: initData,
  }));

  // 5. Open Stake Instruction
  instructions.push(
    createOpenStakeInstruction(
      goalPda,
      stakePda,
      stakeParams.staker,
      stakeParams.amount
    )
  );

  // 6. Deposit Stake Instruction
  instructions.push(
    createDepositStakeInstruction(
      goalPda,
      stakePda,
      stakeParams.staker,
      stakerAtaInfo.address,
      goalVaultInfo.address
    )
  );

  return finalizeTransaction(connection, payer, instructions);
}

export async function buildCancelBeforeStartTx(
  params: StakeParams,
  stakerAta: PublicKey,
  goalVaultAta: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const connection = getConnection();
  const { goalPda, stakePda } = getStakeAddresses(
    params.goalHash,
    params.staker
  );
  const instruction = createCancelInstruction(
    goalPda,
    stakePda,
    params.staker,
    stakerAta,
    goalVaultAta
  );

  return finalizeTransaction(connection, payer, [instruction]);
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
  const { goalPda, stakePda } = getStakeAddresses(
    params.goalHash,
    params.staker
  );
  const instruction = createResolveSuccessInstruction(
    goalPda,
    stakePda,
    resolver,
    goalVaultAta,
    stakerAta
  );

  return finalizeTransaction(connection, payer, [instruction]);
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
  const { goalPda, stakePda } = getStakeAddresses(
    params.goalHash,
    params.staker
  );
  const instruction = createResolveFailureInstruction(
    goalPda,
    stakePda,
    resolver,
    goalVaultAta,
    groupVaultAta
  );

  return finalizeTransaction(connection, payer, [instruction]);
}

function bnToNumber(value: anchor.BN | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export async function fetchGoalAccount(goalHash: Buffer): Promise<GoalAccountData | null> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(goalHash);
  const accountInfo = await connection.getAccountInfo(goalPda);
  if (!accountInfo) return null;

  const decoded = ACCOUNTS_CODER.decode("Goal", accountInfo.data) as {
    goal_hash: number[];
    authority: PublicKey;
    resolver: PublicKey;
    group_vault: PublicKey;
    token_mint: PublicKey;
    starts_on: anchor.BN;
    ends_on: anchor.BN;
  };

  return {
    goalPda,
    goalHash: Buffer.from(decoded.goal_hash),
    authority: decoded.authority,
    resolver: decoded.resolver,
    groupVault: decoded.group_vault,
    tokenMint: decoded.token_mint,
    startsOn: bnToNumber(decoded.starts_on),
    endsOn: bnToNumber(decoded.ends_on),
  };
}

export async function fetchStakeAccount(
  goalHash: Buffer,
  staker: PublicKey
): Promise<StakeAccountData | null> {
  const connection = getConnection();
  const [goalPda] = deriveGoalPda(goalHash);
  const [stakePda] = deriveStakePda(goalPda, staker);
  const accountInfo = await connection.getAccountInfo(stakePda);
  if (!accountInfo) return null;

  const decoded = ACCOUNTS_CODER.decode("Stake", accountInfo.data) as {
    goal: PublicKey;
    staker: PublicKey;
    amount: anchor.BN;
    status: number;
    created_at: anchor.BN;
  };

  return {
    stakePda,
    goal: decoded.goal,
    staker: decoded.staker,
    amount: bnToNumber(decoded.amount),
    status: decoded.status as StakeStatus,
    createdAt: bnToNumber(decoded.created_at),
  };
}

export function filterInstructions(
  instructions: (TransactionInstruction | undefined | null)[]
): TransactionInstruction[] {
  return instructions.filter(
    (ix): ix is TransactionInstruction => ix !== undefined && ix !== null
  );
}

async function finalizeTransaction(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<Transaction> {
  const tx = new Transaction();
  instructions.forEach((ix) => tx.add(ix));
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  return tx;
}

function getStakeAddresses(
  goalHash: Buffer,
  staker: PublicKey
): { goalPda: PublicKey; stakePda: PublicKey } {
  const [goalPda] = deriveGoalPda(goalHash);
  const [stakePda] = deriveStakePda(goalPda, staker);
  return { goalPda, stakePda };
}

function createOpenStakeInstruction(
  goalPda: PublicKey,
  stakePda: PublicKey,
  staker: PublicKey,
  amount: number
): TransactionInstruction {
  const data = INSTRUCTION_CODER.encode("open_stake", {
    amount: new anchor.BN(amount),
  });

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: true },
      { pubkey: staker, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createDepositStakeInstruction(
  goalPda: PublicKey,
  stakePda: PublicKey,
  staker: PublicKey,
  stakerAta: PublicKey,
  goalVaultAta: PublicKey
): TransactionInstruction {
  const data = INSTRUCTION_CODER.encode("deposit_stake", {});

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: true },
      { pubkey: staker, isSigner: true, isWritable: true },
      { pubkey: stakerAta, isSigner: false, isWritable: true },
      { pubkey: goalVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createCancelInstruction(
  goalPda: PublicKey,
  stakePda: PublicKey,
  staker: PublicKey,
  stakerAta: PublicKey,
  goalVaultAta: PublicKey
): TransactionInstruction {
  const data = INSTRUCTION_CODER.encode("cancel_before_start", {});

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: goalPda, isSigner: false, isWritable: false },
      { pubkey: stakePda, isSigner: false, isWritable: true },
      { pubkey: staker, isSigner: true, isWritable: true },
      { pubkey: stakerAta, isSigner: false, isWritable: true },
      { pubkey: goalVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createResolveSuccessInstruction(
  goalPda: PublicKey,
  stakePda: PublicKey,
  resolver: PublicKey,
  goalVaultAta: PublicKey,
  stakerAta: PublicKey
): TransactionInstruction {
  const data = INSTRUCTION_CODER.encode("resolve_success", {});

  return new TransactionInstruction({
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
    data,
  });
}

function createResolveFailureInstruction(
  goalPda: PublicKey,
  stakePda: PublicKey,
  resolver: PublicKey,
  goalVaultAta: PublicKey,
  groupVaultAta: PublicKey
): TransactionInstruction {
  const data = INSTRUCTION_CODER.encode("resolve_failure", {});

  return new TransactionInstruction({
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
    data,
  });
}
