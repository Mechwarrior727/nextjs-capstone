# Privy + Solana Integration Setup

This document explains how to set up Privy for signing Solana transactions on the escrow program.

## Overview

The test button (`EscrowTestButton`) demonstrates how to:
1. Build a Solana transaction using our program helpers
2. Sign it with Privy's embedded wallet
3. Broadcast to devnet
4. Confirm on-chain

## Prerequisites

### 1. Privy Configuration

Your Privy app must have Solana support enabled. Update `PrivyProvider.tsx`:

```typescript
<PrivyProvider 
  appId={PRIVY_APP_ID} 
  config={{
    loginMethods: ['google'],
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
    solana: {
      enabled: true,
      rpcUrl: 'https://api.devnet.solana.com',
    },
  }}
>
```

### 2. Privy App Settings

In your Privy dashboard (https://console.privy.io):

1. Go to your app settings
2. Enable **Solana** under "Blockchain Networks"
3. Select **Devnet** as the default cluster
4. Save settings

### 3. Embedded Wallet Creation

With the config above, Privy will automatically create:
- One embedded Solana wallet per user (on first login)
- Keypair stored securely in Privy
- Available immediately after Google login

## Using `useSignTransaction`

### Import (Client Component)

```typescript
import { useSignTransaction, useWallets } from '@privy-io/react-auth';
```

### Hook Usage

```typescript
const { signTransaction } = useSignTransaction();
const { wallets } = useWallets();

// Get Solana wallet
const solanaWallet = wallets.find(w => w.chainType === 'solana');

if (!solanaWallet) {
  console.error('Solana wallet not initialized');
  return;
}

// Build transaction (using our lib/solana.ts helpers)
const tx = await buildOpenStakeTx(...);

// Encode to bytes
const encodedTx = tx.serialize();

// Sign with Privy
const { signedTransaction } = await signTransaction({
  transaction: encodedTx,
  wallet: solanaWallet,
});

// Broadcast signed transaction
const connection = getConnection();
const signature = await connection.sendRawTransaction(
  Buffer.from(signedTransaction)
);

// Confirm
await connection.confirmTransaction(signature, 'confirmed');
```

## Complete Example Component

```typescript
"use client";

import { useSignTransaction, useWallets } from '@privy-io/react-auth';
import { getConnection, buildOpenStakeTx, deriveGoalPda } from '@/lib/solana';
import { PublicKey } from '@solana/web3.js';
import { useState } from 'react';

export function StakeComponent() {
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);

  const handleStake = async () => {
    try {
      setLoading(true);

      const solanaWallet = wallets.find(w => w.chainType === 'solana');
      if (!solanaWallet?.address) {
        throw new Error('Solana wallet not found');
      }

      // Build transaction
      const staker = new PublicKey(solanaWallet.address);
      const tx = await buildOpenStakeTx(
        {
          goalHash: Buffer.from('goal-hash-32-bytes'),
          staker,
          amount: 1_000_000, // 1 USDC
        },
        staker
      );

      // Sign with Privy
      const encodedTx = tx.serialize();
      const { signedTransaction } = await signTransaction({
        transaction: encodedTx,
        wallet: solanaWallet,
      });

      // Broadcast
      const connection = getConnection();
      const signature = await connection.sendRawTransaction(
        Buffer.from(signedTransaction)
      );

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Transaction confirmed:', signature);
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleStake} disabled={loading}>
      {loading ? 'Processing...' : 'Stake USDC'}
    </button>
  );
}
```

## Transaction Flow (Detailed)

### 1. Build

```typescript
// Use our helpers from lib/solana.ts
const tx = await buildOpenStakeTx({
  goalHash: Buffer.alloc(32, 'goal-id'),
  staker: new PublicKey('...'),
  amount: 1_000_000, // 1 USDC in raw units
}, feePayer);

// tx is a Transaction with:
// - Latest blockhash set
// - Instruction added
// - Fee payer set
```

### 2. Encode

```typescript
// Convert to bytes that Privy can sign
const encodedTx = tx.serialize();
// encodedTx is Uint8Array | Buffer
```

### 3. Sign

```typescript
// Call Privy with the wallet
const { signedTransaction } = await signTransaction({
  transaction: encodedTx,
  wallet: solanaWallet, // ConnectedStandardSolanaWallet
});

// signedTransaction is Uint8Array (signed bytes)
```

### 4. Broadcast

```typescript
// Send raw signed transaction
const signature = await connection.sendRawTransaction(
  Buffer.from(signedTransaction)
);
// signature is string (tx hash)
```

### 5. Confirm

```typescript
// Wait for finality
const confirmation = await connection.confirmTransaction(
  signature,
  'confirmed'
);

if (confirmation.value.err) {
  console.error('Transaction failed');
} else {
  console.log('✅ Transaction confirmed');
}
```

## Debugging

### "Solana wallet not found"

**Cause**: Privy hasn't created the wallet yet

**Solutions**:
1. Ensure `solana.enabled: true` in PrivyProvider config
2. Check Privy app settings have Solana enabled
3. Log out and log back in
4. Clear browser cache/cookies

### "Signature from (wallet) did not verify"

**Cause**: Wallet not properly authorized or transaction was modified

**Solutions**:
1. Ensure wallet is signer in transaction
2. Don't modify tx after encoding
3. Use correct wallet address
4. Check transaction structure

### "Custom program error: 0x1" (generic error)

**Cause**: Instruction failed at program level

**Solutions**:
1. Verify goal exists and hash is correct
2. Check account exists and has data
3. Ensure user has SOL for fees
4. Verify amount > 0

### "Insufficient funds for instruction"

**Cause**: Account doesn't have enough lamports

**Solutions**:
1. Airdrop SOL: `solana airdrop 2 <wallet>`
2. Check wallet balance: `solana balance <wallet>`
3. Ensure enough for rent + fees

## Testing Checklist

- [ ] Privy app has Solana enabled
- [ ] Google login works
- [ ] Embedded wallet created (check useWallets)
- [ ] Wallet has SOL for fees
- [ ] Wallet has USDC (airdrop if needed)
- [ ] Transaction builds without errors
- [ ] useSignTransaction hook available
- [ ] Transaction signs successfully
- [ ] Transaction broadcasts
- [ ] Explorer shows transaction

## Production Considerations

1. **Error Handling**: Wrap in try/catch, show user-friendly errors
2. **Confirmation**: Always wait for "confirmed" or "finalized"
3. **Retry Logic**: Retry failed broadcasts with exponential backoff
4. **Fee Estimation**: Check and display estimated fees before signing
5. **UI Feedback**: Show clear status (building → signing → broadcasting → confirming)
6. **Rate Limiting**: Implement cooldowns for repeated transactions

## References

- [Privy Solana Docs](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Anchor Framework](https://www.anchor-lang.com/)

## Troubleshooting Support

If you encounter issues:

1. Check browser console for errors
2. Verify all prerequisites above
3. Test with simpler transactions first
4. Check Privy dashboard for app status
5. Verify program is deployed to correct address
