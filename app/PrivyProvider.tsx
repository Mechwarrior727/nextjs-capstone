'use client';

import {PrivyProvider} from '@privy-io/react-auth';
import {toSolanaWalletConnectors} from "@privy-io/react-auth/solana";

export default function PrivyProviders({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId="cmcwz5y4b0314l10l3kqave7z"
      config={{
        loginMethods: ['email', 'google'],
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
        externalWallets: {
            solana: {
                connectors: toSolanaWalletConnectors()
            }
        },
        appearance: {
            walletChainType: 'solana-only'
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}