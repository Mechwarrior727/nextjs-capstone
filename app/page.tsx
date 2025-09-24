'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  // Determine display name: Google name → Email → Shortened wallet
  const displayName =
    user?.google?.name ||
    user?.email?.address ||
    (wallets[0]?.address
      ? wallets[0].address.slice(0, 6) + '...' + wallets[0].address.slice(-4)
      : null);

  return (
    <div className="relative min-h-screen font-sans bg-white dark:bg-black text-black dark:text-white">
      {/* Top bar with login/logout */}
      <header className="absolute top-6 right-6 flex flex-col items-end gap-2">
        {ready && authenticated ? (
          <>
            <button
              onClick={logout}
              className="rounded-full bg-violet-600 hover:bg-violet-700 py-2 px-4 text-white"
            >
              Logout
            </button>
            {wallets.map((wallet) => (
              <div key={wallet.address} className="font-mono text-sm">
                <p>Wallet: {wallet.address}</p>
              </div>
            ))}
          </>
        ) : (
          <button
            onClick={login}
            className="rounded-full bg-violet-600 hover:bg-violet-700 py-2 px-4 text-white"
          >
            Login
          </button>
        )}
      </header>

      {/* Centerpiece text */}
      <main className="flex flex-col items-center justify-center h-screen text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Peer Health Tracking and Commitment
        </h1>
        {ready && authenticated && displayName && (
          <p className="mt-2 text-lg font-medium text-green-500">
            Welcome {displayName}!
          </p>
        )}
      </main>

      {/* Delete account button bottom-right */}
      <footer className="absolute bottom-6 right-6">
        <button
          className="rounded-full bg-red-600 hover:bg-red-700 py-2 px-4 text-white"
        >
          Delete account
        </button>
      </footer>
    </div>
  );
}
