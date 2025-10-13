"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function SyncUser() {
  const { authenticated, getAccessToken } = usePrivy();

  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    async function sync() {
      try {
        const token = await getAccessToken();
        if (!token) {
          console.warn("Privy access token unavailable; skipping user sync.");
          return;
        }

        const response = await fetch("/api/db/upsert-user", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok && !cancelled) {
          console.error(
            "Failed to sync user to Supabase",
            response.status,
            await response.text()
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync user to Supabase", error);
        }
      }
    }

    sync();

    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  return null;
}

export default function PrivyProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!PRIVY_APP_ID) {
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID for PrivyProvider");
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID}>
      <SyncUser />
      {children}
    </PrivyProvider>
  );
}
