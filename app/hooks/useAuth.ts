import { useState, useEffect } from "react";
import { usePrivy, useOAuthTokens } from "@privy-io/react-auth";

interface StepData {
  date: string;
  steps: number;
}

interface FitData {
  days: StepData[];
  total: number;
  note?: string;
}

export function useAuth() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [googleTokens, setGoogleTokens] = useState<any>(null);
  const [fitData, setFitData] = useState<FitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = user?.google?.name || user?.email?.address;

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

      // Aligned the time window to midnight to prevent splitting calendar days
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
  
 return {
    fitData,
    loading,
    error,
    setError,
    reauthorize,
    fetchStepData,
    googleTokens,
    displayName,
    linkedWallets,
    shortAddress
  };
}