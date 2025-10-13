"use client";

interface LoginProps {
    ready: any;
    authenticated: any;
    login: any;
    logout: any;
    linkedWallets: any;
}

export default function Login({ ready, authenticated, login, logout, linkedWallets }: LoginProps) {
  return (
    <>
      {/* Top bar with login/logout */}
          <header className="fixed top-6 right-6 flex flex-col items-end gap-2 z-50">
        {ready && authenticated ? (
          <>
            <button
              onClick={logout}
              className="rounded-full bg-violet-600 hover:bg-violet-700 py-2 px-4 text-white"
            >
              Logout
            </button>
            {linkedWallets.map((wallet: any) => (
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
    </>
   );
}