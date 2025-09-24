'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export default function Home() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  return (
    <div className="relative min-h-screen bg-white font-sans">
      {/* Top bar */}
      <header className="absolute top-4 right-4">
        {ready && authenticated ? (
          <button
            onClick={logout}
            className="rounded-full bg-violet-600 hover:bg-violet-700 py-2 px-4 text-white"
          >
            Logout
          </button>
        ) : (
          <button
            onClick={login}
            className="rounded-full bg-violet-600 hover:bg-violet-700 py-2 px-4 text-white"
          >
            Login
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex flex-col items-center justify-center h-screen">
        {ready && authenticated && (
          <div className="mt-6">
            {wallets.map((wallet) => (
              <div key={wallet.address} className="font-mono text-sm">
                <p>Wallet Address: {wallet.address}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
