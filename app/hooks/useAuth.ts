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

async function syncUserToSupabase(privyUser: any) {
    try {
        const response = await fetch('/api/users/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: privyUser.id,
                display_name: privyUser.google?.name || null,
                email: privyUser.google?.email || privyUser.email?.address || null,
                google_id: privyUser.google?.subject || null,
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('User data synced to Supabase');
        } else {
            console.error('Failed to sync user data:', result.error);
        }
    } catch (error) {
        console.error('Error syncing user to Supabase:', error);
    }
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
            console.log('OAUTH TOKENS GRANTED:', oAuthTokens);
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
                console.log('Google OAuth tokens captured successfully');
            }
        }
    });

    useEffect(() => {
        console.log('useOAuthTokens hook initialized');
    }, []);

    useEffect(() => {
        if (authenticated && user) {
            console.log('👤 Syncing user data to Supabase...');
            syncUserToSupabase(user);
        }
    }, [authenticated, user?.id]); // Only re-run if auth status or user ID changes

    useEffect(() => {
        if (googleTokens && authenticated) {
            console.log('Google tokens available, fetching step data...');
            fetchStepData();
        }
    }, [googleTokens, authenticated]);

    useEffect(() => {
        if (user && authenticated) {
            console.log('DEBUG: User object:', user);
            console.log('DEBUG: Linked accounts:', user.linkedAccounts);

            const googleAccount = user.linkedAccounts?.find(account =>
                account.type === 'google_oauth'
            ) as any;

            if (googleAccount) {
                console.log('DEBUG: Google account found:', googleAccount);
                console.log('DEBUG: Google account keys:', Object.keys(googleAccount));
                console.log('DEBUG: Google account oauth_tokens:', googleAccount.oauth_tokens);

                console.log('DEBUG: Checking all properties:');
                Object.keys(googleAccount).forEach(key => {
                    console.log(`DEBUG: ${key}:`, googleAccount[key]);
                });
            }
        }
    }, [user, authenticated]);

    // Get linked wallets from usePrivy (includes embedded wallets)
    const linkedWallets = user?.linkedAccounts?.filter(account =>
        account.type === 'wallet'
    ) || [];

    // Use the first linked wallet for display with type assertion
    const displayWallet = linkedWallets.length > 0 ? linkedWallets[0] as any : null;
    const shortAddress = displayWallet && 'address' in displayWallet && displayWallet.address
        ? `${displayWallet.address.slice(0, 6)}...${displayWallet.address.slice(-4)}`
        : null;

	const fetchStepData = async () => {
		if (!authenticated || !user) return;

		setLoading(true);
		setError(null);

		try {
			let accessToken = googleTokens?.accessToken;
			if (!accessToken && user) {
				const googleAccount = user.linkedAccounts?.find(
					(a) => a.type === "google_oauth"
				) as any;
				accessToken =
					googleAccount?.oauth_tokens?.access_token ||
					googleAccount?.oauth?.accessToken ||
					googleAccount?.accessToken;
			}

			if (!accessToken) {
				setError("Google OAuth tokens not found. Please reauthorize.");
				setLoading(false);
				return;
            }

			const now = new Date();
			const end = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			start.setDate(start.getDate() - 29);
			start.setHours(0, 0, 0, 0);

			const startTimeMillis = start.getTime();
			const endTimeMillis = end.getTime();

			console.log("Calling backend /api/fit with Google token...");
			const response = await fetch("/api/fit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ accessToken, startTimeMillis, endTimeMillis }),
			});

			const result = await response.json();

			if (!response.ok) {
				console.error("/api/fit error:", result.error);
				setError(result.error || "Backend fetch failed");
				setLoading(false);
				return;
			}

			console.log("Backend /api/fit success:", result);
			setFitData({
				days: result.data.days,
				total: result.data.totalSteps,
			});
		} catch (err: any) {
			console.error("fetchStepData error:", err);
			setError(err.message || "Failed to fetch data");
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