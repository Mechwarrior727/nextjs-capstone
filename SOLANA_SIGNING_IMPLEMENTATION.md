# Solana Transaction Signing Implementation with Privy

## Overview

This document explains the Solana transaction signing implementation for the USDC escrow staking system using Privy's embedded wallet.

## Privy v3 Configuration (Code-Based)

All Solana configuration happens in code, not in the Privy dashboard.

### PrivyProvider Setup

```typescript
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

<PrivyProvider 
  appId={PRIVY_APP_ID} 
  config={{
    loginMethods: ['google'],
    embeddedWallets: {
      solana: {
        createOnLogin: 'users-without-wallets',
      },
    },
    solana: {
      rpcs: {
        'solana:devnet': {
          rpc: createSolanaRpc('https://api.devnet.solana.com'),
          rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.devnet.solana.com')
        },
      },
    },
  }}
>
```

**Key Points:**
- RPC configuration is in `config.solana.rpcs`, NOT embedded wallet config
- Use `createSolanaRpc` and `createSolanaRpcSubscriptions` from `@solana/kit`
- Specify the cluster: `'solana:devnet'` for devnet
- No dashboard configuration needed for RPC endpoints

## Architecture

### 1. Authentication Flow

```
User → Google OAuth (Privy) → Embedded Solana Wallet Created → Ready to Sign
```

**Key Points:**
- Privy handles Google authentication
- Embedded Solana wallet is created automatically on first login (`createOnLogin: 'users-without-wallets'`)
- Wallet keypair is securely stored by Privy
- **No re-authentication needed** after first login (wallet persists in Privy)

### 2. Transaction Signing Flow

```
Build Transaction Message
    ↓
Serialize Message (compileMessage().serialize())
    ↓
Pass to Privy signTransaction() with wallet
    ↓
Privy signs with embedded wallet
    ↓
Returns full signed transaction bytes
    ↓
Send raw transaction to Solana RPC
    ↓
Confirm on-chain
```

## Implementation Details

### A. PrivyProvider Configuration

```typescript
config={{
  loginMethods: ['google'],
  embeddedWallets: {
    solana: {
      createOnLogin: 'users-without-wallets',
    },
  },
}}
```

**Why this works:**
- Creates an embedded Solana wallet on first Google login
- The wallet is persistent and doesn't need re-creation
- User doesn't manage private keys directly

### B. Transaction Building (lib/solana.ts)

```typescript
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
      Buffer.from([0x1]), // instruction discriminator
      numberToBuffer(params.amount, 8), // amount in raw units
    ]),
  });

  const tx = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer; // Set fee payer (the staker)

  return tx;
}
```

**Key Details:**
- Instruction marks `staker` as `isSigner: true` (must sign the transaction)
- `feePayer` is set to the staker (they pay for SOL fees)
- Recent blockhash prevents replay attacks
- Uses `numberToBuffer()` helper (not BN from Anchor) for browser compatibility

### C. Transaction Signing (EscrowTestButton.tsx)

In Privy v3, you call signing methods directly on the wallet object:

```typescript
// Step 1: Serialize the full transaction (not just the message)
// requireAllSignatures: false because Privy will add the signature
const serializedTx = tx.serialize({
  requireAllSignatures: false,
});

// Step 2: Sign with wallet.signTransaction()
const { signedTransaction } = await solanaWallet.signTransaction({
  transaction: serializedTx,  // Pass full transaction, not message
  chain: 'solana:devnet',
});

// Step 3: Broadcast
const signature = await connection.sendRawTransaction(
  new Uint8Array(signedTransaction)
);
```

**Critical: Full Transaction vs Message**
- ❌ WRONG: `tx.compileMessage().serialize()` - gives only the message bytes
- ✅ CORRECT: `tx.serialize({requireAllSignatures: false})` - gives full transaction
- Privy needs the full transaction structure to properly insert the signature

**Key Differences in Privy v3:**
- Call methods directly on wallet: `wallet.signTransaction()` (not a hook)
- Must pass `chain: 'solana:devnet'` to specify the network
- Pass full serialized transaction (Uint8Array format)
- Set `requireAllSignatures: false` because signature will be added by Privy

**What Privy Returns:**
- Full signed transaction bytes ready to broadcast
- Includes message + signature in correct format
- Can send directly with `sendRawTransaction()`

## Authentication Requirements

### First Time Users
1. User clicks "Login with Google" (Privy button)
2. Google OAuth flow completes
3. Privy creates embedded Solana wallet
4. User is ready to sign transactions

### Returning Users
- **No re-authentication needed**
- Just log in with Google again
- Embedded wallet is restored from Privy
- Can immediately sign transactions

### If Wallet Is Missing
- Check browser console for: `"Wallet not found. Available wallets:"`
- **Solution:** Log out completely and log back in
  - Clears local session
  - Forces Privy to re-initialize embedded wallet
  - Often fixes transient issues

### If Signing Fails
- Error message: "Signing method not available"
- **Solutions (in order):**
  1. Refresh the page
  2. Log out and log back in
  3. Check Privy dashboard that Solana is enabled for your app
  4. Check browser console for additional error details

## Number Serialization (numberToBuffer)

We use a custom `numberToBuffer()` function instead of BN from Anchor:

```typescript
function numberToBuffer(value: number, bytes: number = 8): Buffer {
  const buffer = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) {
    buffer[i] = (value >> (i * 8)) & 0xff;
  }
  return buffer;
}
```

**Why:**
- BN (BigNumber) from Anchor is Node.js-only
- Browser doesn't have `.toBuffer()` method
- Custom function works in both environments
- Converts numbers to little-endian byte format (Solana standard)

## Error Handling

### "Signature verification failed. Missing signature"
- **Cause:** Trying to serialize transaction with unsigned signers
- **Fix:** Use `compileMessage().serialize()` instead of `serialize()`

### "BN is not defined"
- **Cause:** Using Anchor's BN in browser code
- **Fix:** Use `numberToBuffer()` helper instead

### "Solana wallet not found"
- **Cause:** Privy wallet not initialized
- **Fix:** Log out and log back in

### "Privy Solana signing not initialized"
- **Cause:** `useSignTransaction` hook not available
- **Fix:** Verify Privy app settings have Solana enabled

## Testing Workflow

1. **Setup:**
   ```bash
   cd /home/epic/nextjs-capstone
   pnpm install
   pnpm dev
   ```

2. **Open browser:**
   - Go to `http://localhost:3000`
   - Navigate to `/escrow-test` page

3. **First time:**
   - Click "Login with Google"
   - Complete Google OAuth
   - Wait for Privy to create embedded wallet
   - Should see wallet address

4. **Test staking:**
   - Enter goal hash (auto-hashed if not 32 bytes)
   - Enter stake amount (USDC, e.g., 1)
   - Click "Test Stake (Open)"
   - Approve signature popup
   - Watch console logs for transaction details
   - Check Solana Explorer for on-chain confirmation

5. **Requirements:**
   - Wallet must have SOL (≈0.001 for fees)
   - Wallet must have USDC (get from faucet if needed)
   - Goal must exist on-chain (or test will fail with "Account not found")

## Console Logging

The implementation logs transaction details for debugging:

```typescript
console.log("Serialized message bytes:", ...);
console.log("Wallet address:", solanaWallet.address);
console.log("Signed transaction bytes:", ...);
console.log("Signed transaction length:", signedTransaction.length);
```

Watch the browser console to verify:
- Message is being serialized correctly
- Wallet address matches your embedded wallet
- Signed transaction has reasonable length (typically 200-300 bytes)

## Next Steps

1. **Add goal creation UI** (currently manual)
2. **Add deposit/resolve UI** (currently only open_stake works)
3. **Add error recovery** (retry logic for failed transactions)
4. **Add transaction history** (track past stakes)
5. **Production hardening** (better error messages, rate limiting)

## References

- [Privy Solana Docs](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction)
- [Privy Auth Docs](https://docs.privy.io/authentication/user-authentication/authentication-state)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Anchor Framework](https://www.anchor-lang.com/)
