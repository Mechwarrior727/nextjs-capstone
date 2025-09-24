'use client';
import { usePrivy } from '@privy-io/react-auth';

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  const displayName = user?.google?.name || user?.email?.address;

  // Get linked wallets from usePrivy (includes embedded wallets)
  const linkedWallets = user?.linkedAccounts?.filter(account =>
    account.type === 'wallet'
  ) || [];

  // Use the first linked wallet for display
  const displayWallet = linkedWallets[0];
  const shortAddress = displayWallet?.address
    ? displayWallet.address.slice(0, 6) + '...' + displayWallet.address.slice(-4)
    : null;

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
            {linkedWallets.map((wallet) => (
              <div key={wallet.address} className="font-mono text-sm">
                <p>
                  Wallet:{" "}
                  <span
                    className="cursor-pointer underline decoration-dotted"
                    title="Click to copy full address"
                    onClick={() => {
                      if (wallet.address) {
                        navigator.clipboard.writeText(wallet.address);
                      }
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.textDecoration = "underline solid";
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.textDecoration = "underline dotted";
                    }}
                  >
                    {wallet.address
                      ? wallet.address.slice(0, 6) + "..." + wallet.address.slice(-4)
                      : ""}
                  </span>
                </p>
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
        {ready && authenticated && (
          <>
            {displayName ? (
              <p className="mt-2 text-lg font-medium text-green-500">
                Welcome {displayName}!
              </p>
            ) : shortAddress ? (
              <p className="mt-2 text-lg font-medium text-green-500">
                Welcome {shortAddress}!
              </p>
            ) : null}
            {displayName && shortAddress && (
              <div className="mt-2 font-mono text-sm text-gray-500">
                Wallet:{" "}
                <span
                  className="cursor-pointer underline decoration-dotted"
                  title="Click to copy full address"
                  onClick={() => {
                    if (displayWallet?.address) {
                      navigator.clipboard.writeText(displayWallet.address);
                    }
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.textDecoration = "underline solid";
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.textDecoration = "underline dotted";
                  }}
                >
                  {shortAddress}
                </span>
              </div>
            )}
          </>
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
