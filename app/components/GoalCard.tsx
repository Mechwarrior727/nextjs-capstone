'use client';

import { Target, Calendar, TrendingUp, Users, Coins, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getGoalProgress } from '@/lib/goals';
import { useEscrowActions } from '@/app/hooks/useEscrowActions';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { PublicKey } from '@solana/web3.js';
import {
    fetchGoalAccount,
    fetchStakeAccount,
    GoalAccountData,
    StakeAccountData,
    StakeStatus,
} from '@/lib/solana';

interface GoalCardProps {
    goal: any;
}

export default function GoalCard({ goal }: GoalCardProps) {
    const [progressData, setProgressData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // On-chain state
    const [goalAccount, setGoalAccount] = useState<GoalAccountData | null>(null);
    const [stakeAccount, setStakeAccount] = useState<StakeAccountData | null>(null);
    const [onChainLoading, setOnChainLoading] = useState(false);

    const { resolveSuccess, status: actionStatus, isLoading: isActionLoading } = useEscrowActions();
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const solanaWallet = wallets[0];

    useEffect(() => {
        fetchProgress();
        if (authenticated && solanaWallet) {
            fetchOnChainData();
        }
    }, [goal.id, authenticated, solanaWallet]);

    const fetchProgress = async () => {
        setLoading(true);
        const result = await getGoalProgress(goal.id);
        if (result.success && result.data) {
            setProgressData(result.data);
        }
        setLoading(false);
    };

    const fetchOnChainData = useCallback(async () => {
        if (!solanaWallet?.address) return;

        setOnChainLoading(true);
        try {
            const crypto = await import('crypto');
            const goalHash = crypto.createHash('sha256').update(goal.id).digest();

            const goalAcct = await fetchGoalAccount(goalHash);
            setGoalAccount(goalAcct);

            if (goalAcct) {
                const staker = new PublicKey(solanaWallet.address);
                const stakeAcct = await fetchStakeAccount(goalHash, staker);
                setStakeAccount(stakeAcct);
            }
        } catch (error) {
            console.error("Failed to fetch on-chain data:", error);
        } finally {
            setOnChainLoading(false);
        }
    }, [goal.id, solanaWallet]);

    const handleClaim = async () => {
        if (!goalAccount || !stakeAccount) return;
        await resolveSuccess(goalAccount, stakeAccount);
        // Refresh data after claim
        await fetchOnChainData();
    };

    const getStatusColor = () => {
        const now = new Date();
        const endDate = new Date(goal.ends_on);

        if (now > endDate) return 'text-gray-500';
        return 'text-yellow-600 dark:text-yellow-400';
    };

    const getStatusText = () => {
        const now = new Date();
        const endDate = new Date(goal.ends_on);
        const startDate = new Date(goal.starts_on);

        if (now > endDate) return 'Completed';
        if (now < startDate) return 'Upcoming';

        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const creatorName = goal.users?.display_name || goal.users?.email || 'Unknown';
    const isEnded = new Date() > new Date(goal.ends_on);

    return (
        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-black dark:text-white mb-1">
                        {goal.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Created by {creatorName}
                    </p>
                </div>
                <span className={`text-sm font-semibold ${getStatusColor()}`}>
                    {getStatusText()}
                </span>
            </div>

            {/* Goal Details */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Target size={16} />
                    <span>{goal.target_value.toLocaleString()} {goal.unit}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar size={16} />
                    <span>{goal.period_days} days</span>
                </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                {formatDate(goal.starts_on)} - {formatDate(goal.ends_on)}
            </div>

            {/* Stake Section */}
            {authenticated && (
                <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-black dark:text-white">
                            <Coins size={16} className="text-yellow-500" />
                            <span>My Stake</span>
                        </div>
                        {onChainLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    </div>

                    {stakeAccount ? (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                                <span className="font-mono font-medium">{(stakeAccount.amount / 1_000_000).toFixed(2)} USDC</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                <span className={`font-medium ${stakeAccount.status === StakeStatus.Funded ? 'text-yellow-600' :
                                        stakeAccount.status === StakeStatus.Success ? 'text-green-600' :
                                            'text-gray-600'
                                    }`}>
                                    {stakeAccount.status === StakeStatus.Pending ? 'Pending' :
                                        stakeAccount.status === StakeStatus.Funded ? 'Active' :
                                            stakeAccount.status === StakeStatus.Success ? 'Returned' :
                                                stakeAccount.status === StakeStatus.Failure ? 'Forfeited' : 'Canceled'}
                                </span>
                            </div>

                            {/* Claim Button */}
                            {isEnded && stakeAccount.status === StakeStatus.Funded && (
                                <button
                                    onClick={handleClaim}
                                    disabled={isActionLoading}
                                    className="w-full mt-2 py-1.5 px-3 bg-yellow-600 hover:bg-yellow-700 text-black text-sm font-bold rounded transition-colors flex items-center justify-center gap-2"
                                >
                                    {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                    Claim Refund
                                </button>
                            )}
                        </div>
                    ) : goalAccount ? (
                        <div className="text-sm text-gray-500 italic">
                            No stake found for this goal.
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 italic">
                            {onChainLoading ? 'Checking blockchain...' : 'No on-chain goal found.'}
                        </div>
                    )}
                </div>
            )}

            {/* Progress Section */}
            {loading ? (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400 text-sm">
                    Loading progress...
                </div>
            ) : progressData && progressData.progress.length > 0 ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-black dark:text-white">
                        <Users size={16} />
                        <span>Team Progress</span>
                    </div>
                    {progressData.progress.map((userProgress: any) => (
                        <div key={userProgress.user_id} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                    {userProgress.display_name}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                    {userProgress.total.toLocaleString()} / {goal.target_value.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                                <div
                                    className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(userProgress.percentage, 100)}%` }}
                                />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                                {userProgress.percentage.toFixed(1)}% complete
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400 text-sm">
                    No progress data yet
                </div>
            )}
        </div>
    );
}