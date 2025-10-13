      "use client";

export default function Dashboard({
  ready,
  authenticated,
  displayName,
  shortAddress,
  googleTokens,
  user,
  fetchStepData,
  reauthorize,
  loading,
  error,
  setError,
  fitData,
}) {
  return (
    <div className="relative min-h-screen font-sans bg-white dark:bg-black text-black dark:text-white">
        {/* Centerpiece text */}
      <main className="flex flex-col items-center justify-center h-screen text-center px-4">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-8">
          Peer Health Tracking and Commitment
        </h1>
        {ready && authenticated && (
          <>
            {displayName ? (
              <p className="mt-2 text-lg font-medium text-green-500 mb-6">
                Welcome {displayName}!
              </p>
            ) : shortAddress ? (
              <p className="mt-2 text-lg font-medium text-green-500 mb-6">
                Welcome {shortAddress}!
              </p>
            ) : null}

            {/* Google Fit Integration */}
            <div className="mb-6 space-y-4">
              {/* Token Status */}
              <div className="text-center">
                {googleTokens ? (
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm">Google OAuth tokens available</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Waiting for Google OAuth tokens...</span>
                  </div>
                )}
              </div>

              {/* Setup Instructions */}
              {!googleTokens && process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-blue-600 dark:text-blue-400 text-center max-w-md mx-auto p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold mb-2">🔧 Setup Required:</p>
                  <p className="mb-2">1. Add your PRIVY_APP_SECRET to .env.local</p>
                  <p className="mb-2">2. Find it in Privy Dashboard → Configuration → App settings</p>
                  <p>3. Login with Google to test Google Fit integration</p>
                </div>
              )}

              {/* Debug Info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 text-center max-w-md mx-auto">
                  <details>
                    <summary className="cursor-pointer">Debug Info</summary>
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-left">
                      <p>Authenticated: {authenticated ? 'Yes' : 'No'}</p>
                      <p>Google Tokens: {googleTokens ? 'Available' : 'None'}</p>
                      <p>User: {user ? 'Logged in' : 'Not logged in'}</p>
                      <p>Google Account: {user?.linkedAccounts?.find(a => a.type === 'google_oauth') ? 'Linked' : 'Not linked'}</p>
                    </div>
                  </details>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={fetchStepData}
                  disabled={loading}
                  className="rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 py-2 px-6 text-white font-medium"
                >
                  {loading ? 'Loading Step Data...' : 'Get Step Data (Direct API)'}
                </button>

                {user?.linkedAccounts?.find(a => a.type === 'google_oauth') && (
                  <button
                    onClick={() => reauthorize({ provider: 'google' })}
                    className="rounded-full bg-green-600 hover:bg-green-700 py-2 px-6 text-white font-medium text-sm"
                  >
                    Refresh Google Auth
                  </button>
                )}
              </div>

              {!googleTokens && (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Login with Google to enable Google Fit integration
                </p>
              )}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg text-red-700 dark:text-red-300 max-w-md">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
                <div className="mt-3 flex gap-2">
                  {error.includes('expired') || error.includes('reauthorize') || error.includes('permissions') ? (
                    <button
                      onClick={() => reauthorize({ provider: 'google' })}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Reauthorize Google
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      setError(null);
                      fetchStepData();
                    }}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {fitData && (
              <div className="w-full max-w-2xl">
                <h2 className="text-xl font-semibold mb-4">
                  Your Last 5 Days Step Count
                  {fitData.note && (
                    <span className="text-sm text-yellow-600 dark:text-yellow-400 ml-2">
                      (Demo Data - Setup Required)
                    </span>
                  )}
                  {!fitData.note && (
                    <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                      (Live Google Fit Data)
                    </span>
                  )}
                </h2>

                {/* Simple bar chart visualization */}
                <div className="mb-6 space-y-2">
                  {fitData.days.map((day, index) => {
                    const maxSteps = Math.max(...fitData.days.map(d => d.steps));
                    const barWidth = maxSteps > 0 ? (day.steps / maxSteps) * 100 : 0;

                    return (
                      <div key={day.date} className="flex items-center gap-4">
                        <span className="text-sm font-mono w-20">{day.date}</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                          <div
                            className="bg-green-500 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                            style={{ width: `${barWidth}%` }}
                          >
                            <span className="text-white text-xs font-semibold">
                              {day.steps}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total steps */}
                <div className="text-center p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                  <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                    Total Steps (5 days): {fitData.total.toLocaleString()}
                  </p>
                </div>
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
