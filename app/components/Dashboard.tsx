"use client";

import { useState, useEffect } from "react";
import { Users, TrendingUp, DollarSign, ChevronRight } from "lucide-react";
import CreateGroupDialog from "@/components/GroupDialog";
import { getUserGroups } from "@/lib/groups";
import type { GroupMemberWithGroup } from "@/lib/supabase-types";
import Link from "next/link";

interface DashboardProps {
    ready: any;
    authenticated: any;
    displayName: any;
    shortAddress: any;
    googleTokens: any;
    user: any;
    fetchStepData: any;
    reauthorize: any;
    loading: any;
    error: any;
    setError: any;
    fitData: any;
}

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
}: DashboardProps) {
    const [groups, setGroups] = useState<GroupMemberWithGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);

    const fetchGroups = async () => {
        if (!user?.id) return;

        setLoadingGroups(true);
        const result = await getUserGroups(user.id);

        if (result.success && result.data) {
            setGroups(result.data);
        } else {
            setGroups([]);
        }
        setLoadingGroups(false);
    };

    useEffect(() => {
        if (authenticated && user?.id) {
            fetchGroups();
        }
    }, [authenticated, user?.id]);

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                <div className="text-black dark:text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black px-4">
                <div className="text-center max-w-2xl">
                    <h1 className="text-5xl font-bold text-black dark:text-white mb-4">CleverNameAboutPeerPressure</h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                        Compete with friends. Achieve your goals. Steal their money.
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
                        <h2 className="text-2xl font-bold text-black dark:text-white mb-4">How it works</h2>
                        <div className="space-y-4 text-left text-gray-700 dark:text-gray-300">
                            <div className="flex gap-3">
                                <span className="text-2xl">1️⃣</span>
                                <p>Create or join a group with friends</p>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-2xl">2️⃣</span>
                                <p>Track progress towards a common goal</p>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-2xl">3️⃣</span>
                                <p>???</p>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-2xl">4️⃣</span>
                                <p>Profit</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
                        Welcome back, {displayName || shortAddress || 'User'}!
                    </h1>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="text-violet-600 dark:text-violet-400" size={24} />
                            <span className="text-gray-600 dark:text-gray-400 text-sm">Active Groups</span>
                        </div>
                        <p className="text-3xl font-bold text-black dark:text-white">{groups.length}</p>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                            <DollarSign className="text-green-600 dark:text-green-400" size={24} />
                            <span className="text-gray-600 dark:text-gray-400 text-sm">Total at Stake</span>
                        </div>
                        <p className="text-3xl font-bold text-black dark:text-white">$0</p>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="text-yellow-600 dark:text-yellow-400" size={24} />
                            <span className="text-gray-600 dark:text-gray-400 text-sm">Best Streak</span>
                        </div>
                        <p className="text-3xl font-bold text-black dark:text-white">0 days</p>
                    </div>
                </div>

                {/* Groups Section */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-black dark:text-white">Your Groups</h2>
                    <CreateGroupDialog userId={user?.id} onGroupCreated={fetchGroups} />
                </div>

                {/* Loading State */}
                {loadingGroups ? (
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-12 border border-gray-200 dark:border-gray-800 text-center">
                        <p className="text-gray-600 dark:text-gray-400">Loading your groups...</p>
                    </div>
                ) : groups.length === 0 ? (
                    /* Empty State */
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-12 border border-gray-200 dark:border-gray-800 text-center">
                        <h3 className="text-2xl font-bold text-black dark:text-white mb-2">No groups yet</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first group and start competing with friends!</p>
                        <CreateGroupDialog userId={user?.id} onGroupCreated={fetchGroups} />
                    </div>
                ) : (
                    /* Groups List */
                    <div className="space-y-4">
                        {groups.map((membership) => (
                            <Link
                                key={membership.group_id}
                                href={`/groups/${membership.group_id}`}
                                className="block bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 hover:border-violet-500 dark:hover:border-violet-500 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold text-black dark:text-white">
                                                {membership.groups.name}
                                            </h3>
                                            {membership.role === 'owner' && (
                                                <span className="text-xs bg-violet-600 text-white px-2 py-1 rounded-full">
                                                    Owner
                                                </span>
                                            )}
                                        </div>
                                        {membership.groups.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                {membership.groups.description}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500 dark:text-gray-500">
                                            Joined {new Date(membership.joined_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <ChevronRight className="text-gray-400 dark:text-gray-600 flex-shrink-0" size={24} />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Development Tools - Only show in dev mode */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-8 bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                        <details>
                            <summary className="text-black dark:text-white font-semibold cursor-pointer mb-4">
                                Developer Tools
                            </summary>
                            <div className="space-y-4">
                                {/* Google Fit Integration Status */}
                                <div>
                                    <h4 className="text-black dark:text-white font-semibold mb-2">Google Fit Status</h4>
                                    {googleTokens ? (
                                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <span>OAuth tokens available</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                            <span>Waiting for OAuth tokens...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={fetchStepData}
                                        disabled={loading}
                                        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 py-2 px-4 text-white text-sm font-medium"
                                    >
                                        {loading ? 'Loading...' : 'Test Fetch Step Data'}
                                    </button>

                                    {user?.linkedAccounts?.find((a: any) => a.type === 'google_oauth') && (
                                        <button
                                            onClick={() => reauthorize({ provider: 'google' })}
                                            className="rounded-lg bg-green-600 hover:bg-green-700 py-2 px-4 text-white text-sm font-medium"
                                        >
                                            Refresh Google Auth
                                        </button>
                                    )}
                                </div>

                                {/* Error Display */}
                                {error && (
                                    <div className="p-4 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-700 dark:text-red-200 text-sm">
                                        <p className="font-semibold">Error:</p>
                                        <p>{error}</p>
                                    </div>
                                )}

                                {/* Fit Data Display */}
                                {fitData && (
                                    <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
                                        <p className="text-green-700 dark:text-green-200 text-sm font-semibold mb-2">
                                            Last 5 Days Step Count: {fitData.total.toLocaleString()} total steps
                                        </p>
                                        <div className="space-y-1">
                                            {fitData.days.map((day: any) => (
                                                <div key={day.date} className="text-green-600 dark:text-green-300 text-xs">
                                                    {day.date}: {day.steps} steps
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}