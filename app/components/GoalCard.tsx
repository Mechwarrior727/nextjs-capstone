'use client';

import { Target, Calendar, TrendingUp, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getGoalProgress } from '@/lib/goals';

interface GoalCardProps {
    goal: any;
}

export default function GoalCard({ goal }: GoalCardProps) {
    const [progressData, setProgressData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProgress();
    }, [goal.id]);

    const fetchProgress = async () => {
        setLoading(true);
        const result = await getGoalProgress(goal.id);
        if (result.success && result.data) {
            setProgressData(result.data);
        }
        setLoading(false);
    };

    const getStatusColor = () => {
        const now = new Date();
        const endDate = new Date(goal.ends_on);

        if (now > endDate) return 'text-gray-500';
        return 'text-green-600 dark:text-green-400';
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
                                    className="bg-violet-600 h-2 rounded-full transition-all duration-300"
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