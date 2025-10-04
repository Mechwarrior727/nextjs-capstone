'use client';
import { usePrivy, useOAuthTokens, type OAuthTokens } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';

interface StepData {
  date: string;
  steps: number;
}

interface FitData {
  days: StepData[];
  total: number;
  note?: string;
}

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [fitData, setFitData] = useState<FitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleTokens, setGoogleTokens] = useState<OAuthTokens | null>(null);

  const displayName = user?.google?.name || user?.email?.address;

  // Use OAuth tokens hook to get Google access tokens
  const { reauthorize } = useOAuthTokens({
    onOAuthTokenGrant: ({ oAuthTokens }) => {
      console.log('🔑 OAUTH TOKENS GRANTED:', oAuthTokens);
      console.log('Provider:', oAuthTokens.provider);
      console.log('Has access token:', !!oAuthTokens.accessToken);
      console.log('Token details:', {
        accessToken: oAuthTokens.accessToken ? 'present' : 'missing',
        refreshToken: oAuthTokens.refreshToken ? 'present' : 'missing',
        scopes: oAuthTokens.scopes,
        expiresIn: oAuthTokens.accessTokenExpiresInSeconds
      });
      if (oAuthTokens.provider === 'google') {
        setGoogleTokens(oAuthTokens);
        setError(null); // Clear any previous errors
        console.log('✅ Google OAuth tokens captured successfully');
      }
    }
  });

  // Debug: Log when the hook is initialized
  useEffect(() => {
    console.log('🔧 useOAuthTokens hook initialized');
  }, []);

  // Auto-fetch step data when Google tokens become available
  useEffect(() => {
    if (googleTokens && authenticated) {
      console.log('Google tokens available, fetching step data...');
      fetchStepData();
    }
  }, [googleTokens, authenticated]);

  // Debug: Check if we can access tokens directly from user object
  useEffect(() => {
    if (user && authenticated) {
      console.log('🔍 DEBUG: User object:', user);
      console.log('🔍 DEBUG: Linked accounts:', user.linkedAccounts);

      // Try to find Google account and check for tokens
      const googleAccount = user.linkedAccounts?.find(account =>
        account.type === 'google_oauth'
      ) as any;

      if (googleAccount) {
        console.log('🔍 DEBUG: Google account found:', googleAccount);
        console.log('🔍 DEBUG: Google account keys:', Object.keys(googleAccount));
        console.log('🔍 DEBUG: Google account oauth_tokens:', googleAccount.oauth_tokens);

        // Try to access tokens through different properties
        console.log('🔍 DEBUG: Checking all properties:');
        Object.keys(googleAccount).forEach(key => {
          console.log(`🔍 DEBUG: ${key}:`, googleAccount[key]);
        });
      }
    }
  }, [user, authenticated]);

  // Get linked wallets from usePrivy (includes embedded wallets)
  const linkedWallets = user?.linkedAccounts?.filter(account =>
    account.type === 'wallet'
  ) || [];

  // Use the first linked wallet for display
  const displayWallet = linkedWallets[0];
  const shortAddress = displayWallet?.address
    ? displayWallet.address.slice(0, 6) + '...' + displayWallet.address.slice(-4)
    : null;

  const fetchStepData = async () => {
    if (!authenticated || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Try multiple ways to get the Google OAuth token

      // Method 1: From useOAuthTokens hook
      let accessToken = googleTokens?.accessToken;

      // Method 2: From user object (try different property names)
      if (!accessToken && user) {
        const googleAccount = user.linkedAccounts?.find(account =>
          account.type === 'google_oauth'
        ) as any;

        if (googleAccount) {
          // Try different possible property names for OAuth tokens
          accessToken = googleAccount.oauth_tokens?.access_token ||
                       googleAccount.oauth?.accessToken ||
                       googleAccount.accessToken ||
                       googleAccount.token;

          if (accessToken) {
            console.log('🔑 Found OAuth token in user object:', accessToken ? 'present' : 'missing');
          }
        }
      }

      // Method 3: Check if we have any OAuth tokens in the user object
      if (!accessToken && user) {
        console.log('🔍 Checking all user object properties for tokens...');
        const checkObject = (obj: any, path: string = '') => {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            if (typeof value === 'string' && value.length > 50 && !path.includes('id') && !path.includes('subject')) {
              console.log(`🔍 Possible token found at ${currentPath}:`, value.substring(0, 20) + '...');
            }
            if (typeof value === 'object' && value !== null) {
              checkObject(value, currentPath);
            }
          }
        };
        checkObject(user);
      }

      if (!accessToken) {
        setError('Google OAuth tokens not found. The useOAuthTokens hook may not be capturing tokens properly. Try clicking "Refresh Google Auth" or re-login with Google.');
        setLoading(false);
        return;
      }

      console.log('🔑 Using Google OAuth token:', accessToken ? 'present' : 'missing');

      // Try direct Google Fit API call from frontend
      console.log('🚀 Attempting direct Google Fit API call from frontend...');

      // Aligned the time window to midnight to prevent splitting calendar days,
      // which caused inaccurate daily totals. Using local timezone for accuracy.
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - 4);
      start.setHours(0, 0, 0, 0);

      const startTimeMillis = start.getTime();
      const endTimeMillis = end.getTime();

      const directResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // daily buckets
          startTimeMillis,
          endTimeMillis,
        }),
      });

      console.log('📊 Direct API response status:', directResponse.status);

      if (directResponse.ok) {
        console.log('✅ Direct Google Fit API call successful!');
        const directData = await directResponse.json();
        console.log('📊 Direct API response data:', directData);

        // Process the data
        const days = directData.bucket?.map((b: any) => {
          const steps = b.dataset?.[0]?.point?.reduce((sum: number, p: any) => {
            const v = p.value?.[0];
            const n = typeof v?.intVal === "number" ? v.intVal : 0;
            return sum + (n || 0);
          }, 0) || 0;

          const d = new Date(Number(b.startTimeMillis));
          // Using local date parts to avoid timezone conversion errors from .toISOString()
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return { date: `${yyyy}-${mm}-${dd}`, steps };
        }) || [];

        const total = days.reduce((s: number, d: any) => s + d.steps, 0);

        setFitData({ days, total });
        return;
      } else {
        const errorText = await directResponse.text();
        console.error('❌ Direct Google Fit API failed:', errorText);

        // Fallback to API route
        console.log('🔄 Falling back to API route...');
        const response = await fetch('/api/fit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error?.includes('token') || result.error?.includes('auth')) {
            setError('Token expired. Please click "Refresh Google Auth" to reauthorize.');
            return;
          }
          throw new Error(result.error || 'Failed to fetch step data');
        }

        setFitData(result.data);
      }

    } catch (err: any) {
      console.error('Error fetching step data:', err);

      // Handle different types of errors
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        setError('Google OAuth token expired. Please click "Refresh Google Auth" to reauthorize.');
      } else if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        setError('Google Fit API access denied. Please ensure you have granted fitness permissions.');
      } else if (err.message?.includes('CORS')) {
        setError('CORS error. The direct API approach may not work due to browser restrictions.');
      } else {
        setError(err.message || 'Failed to fetch step data');
      }
    } finally {
      setLoading(false);
    }
  };

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
