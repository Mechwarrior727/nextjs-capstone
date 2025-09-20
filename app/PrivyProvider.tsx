'use client';

import {PrivyProvider} from '@privy-io/react-auth';

export default function PrivyProviders({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId="cmcwz5y4b0314l10l3kqave7z"
      config={{
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}