# Privy Dashboard Configuration for Solana Devnet

## Problem

Even with embedded wallets configured in code, Privy shows warnings:
- "App configuration has Solana wallet login enabled, but no Solana wallet connectors have been passed"
- "No RPC configuration found for chain solana:mainnet"

## Solution: Configure in Privy Dashboard

Your Privy app needs to be configured in the Privy dashboard to specify Solana settings.

### Steps

1. **Go to Privy Console**
   - Navigate to: https://console.privy.io
   - Log in with your Privy account

2. **Select Your App**
   - Find the app with ID: `cmcwz5y4b0314l10l3kqave7z`
   - Click to open app settings

3. **Configure Blockchain Networks**
   - Look for "Blockchain Networks" or "Wallets" section
   - Click **"Configure"** or **"Add Network"**

4. **Add Solana Configuration**
   - Select **Solana** from the list
   - **Important:** Choose **Devnet** as the cluster (NOT Mainnet)
   - Save/apply settings

5. **Configure Embedded Wallets (if not already done)**
   - Look for "Embedded Wallets" section
   - Enable **Solana embedded wallets**
   - Set: "Create wallet on login" → "For users without wallets"
   - Save

6. **Optional: Configure External Wallet Connectors**
   - If you want users to connect external wallets (Phantom, Backpack, Solflare)
   - In "Wallets" section, enable specific connectors
   - These are optional for this project (we use embedded wallets)

### Expected Configuration

After setup, your app should have:

**Solana Embedded Wallets:**
- ✅ Enabled
- ✅ Auto-create on login
- ✅ Cluster: Devnet

**Solana RPC Configuration:**
- ✅ Network: Solana
- ✅ Cluster: Devnet
- ✅ RPC endpoint: `https://api.devnet.solana.com`

### Verify Configuration

After saving in the dashboard:

1. **Refresh your browser** (clear cache if needed)
2. **Log out and log back in**
   - Forces Privy to re-initialize with new config
3. **Check browser console** for:
   - ✅ No "no Solana wallet connectors" warning
   - ✅ No "No RPC configuration" error
   - ✅ Console log: "Base Account SDK Initialized"

### Testing Workflow

After dashboard setup:

```bash
# 1. Clear browser cache/cookies
#    (or open in incognito/private window)

# 2. Start dev server
pnpm dev

# 3. Navigate to http://localhost:3000/escrow-test

# 4. Click "Login with Google"
#    - Complete OAuth flow
#    - Wait for Privy to initialize

# 5. Check console for:
#    - Wallet address: Dh4GKEkpbQ4v9iMbkUmVGeBq1LjWL9QdB3fNBR1FGTt3
#    - No errors about RPC config

# 6. Test staking:
#    - Enter amount (1 USDC)
#    - Click "Test Stake (Open)"
#    - Approve signature
#    - Check transaction confirmation
```

## Code Configuration

Your `PrivyProvider.tsx` is correctly configured:

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

The dashboard settings are what **enable** this code configuration to work.

## Troubleshooting

### Still Getting "no Solana wallet connectors" Warning?
1. Go to Privy dashboard
2. Verify Solana is enabled in "Blockchain Networks"
3. Try adding external connectors (Phantom, Backpack, Solflare) even if not used
4. Save and refresh browser

### Still Getting "No RPC configuration" Error?
1. Verify Solana cluster is set to **Devnet** (not Mainnet)
2. Verify RPC endpoint is: `https://api.devnet.solana.com`
3. Log out completely and log back in
4. Clear browser cache

### Wallet Not Creating on Login?
1. Verify "Embedded Wallets" section has Solana enabled
2. Verify "Create wallet on login" is set to "For users without wallets"
3. Check Privy dashboard shows wallet was created for your user

### Transaction Fails to Sign?
1. Verify wallet has SOL for fees (≥0.001)
2. Verify wallet has USDC (get from faucet)
3. Check console logs show wallet address
4. Try refreshing page and trying again

## Dashboard Settings Summary

| Setting | Value |
|---------|-------|
| **Blockchain Network** | Solana |
| **Cluster** | Devnet |
| **RPC Endpoint** | https://api.devnet.solana.com |
| **Embedded Wallets** | Enabled |
| **Create on Login** | For users without wallets |
| **External Connectors** | Optional (Phantom, Backpack, Solflare) |

## Next Steps

Once configuration is complete:

1. **Full integration test**
   - Log in with Google
   - Test staking transaction
   - Verify on Solana Explorer

2. **Add production Privy app**
   - For mainnet deployment
   - Configure with Solana mainnet
   - Ensure USDC mainnet mint is correct

3. **Error recovery**
   - Add retry logic for failed transactions
   - Better user feedback for common errors
   - Wallet connection status monitoring

## References

- [Privy Dashboard](https://console.privy.io)
- [Privy Solana Docs](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction)
- [Solana Devnet Faucet](https://faucet.solana.com)
- [Devnet USDC Faucet](https://faucet.orca.so)
