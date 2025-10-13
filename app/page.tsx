'use client';
import { usePrivy, useOAuthTokens, type OAuthTokens } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import Login from "@/components/Login";
import Dashboard from "@/components/Dashboard";
import {useAuth} from "@/hooks/useAuth"


export default function Home() {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const {fitData, loading, error, setError, reauthorize, fetchStepData, googleTokens, linkedWallets, displayName, shortAddress} = useAuth();


  return (
   <>
      {/* Top bar with login/logout */}
      <Login
        ready={ready}
        authenticated={authenticated}
        login={login}
        logout={logout}
        linkedWallets={linkedWallets}
      />
      <Dashboard
        ready={ready}
        authenticated={authenticated}
        displayName={displayName}
        shortAddress={shortAddress}
        googleTokens={googleTokens}
        user={user}
        fetchStepData={fetchStepData}
        reauthorize={reauthorize}
        loading={loading}
        error={error}
        setError={setError}
        fitData={fitData}
      />
    </>
  );
}