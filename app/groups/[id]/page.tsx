﻿'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Settings, Target } from 'lucide-react';
import { getGroupById } from '@/lib/groups';
import GroupSettings from '@/components/GroupSettings';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

type Tab = 'overview' | 'settings';

export default function GroupDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = usePrivy();
    const groupId = params.id as string;

    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const isOwner = group && user?.id && group.owner_id === user.id;

    useEffect(() => {
        fetchGroup();
    }, [groupId]);

    const fetchGroup = async () => {
        setLoading(true);
        setError(null);

        const result = await getGroupById(groupId);

        if (result.success && result.data) {
            setGroup(result.data);
        } else {
            setError(result.error || 'Failed to load group');
        }

        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
                <p className="text-gray-600 dark:text-gray-400">Loading group...</p>
            </div>
        );
    }

    if (error || !group) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Group not found'}</p>
                    <Link
                        href="/"
                        className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Dashboard
                    </Link>

                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
                                {group.name}
                            </h1>
                            {group.description && (
                                <p className="text-gray-600 dark:text-gray-400 text-lg">
                                    {group.description}
                                </p>
                            )}
                            <div className="flex items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Users size={16} />
                                    {group.group_members?.length || 0} members
                                </span>
                                {isOwner && (
                                    <span className="text-xs bg-violet-600 text-white px-2 py-1 rounded-full">
                                        Owner
                                    </span>
                                )}
                                {group.is_private && (
                                    <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded-full">
                                        Private
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-800 mb-8">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`pb-4 px-2 border-b-2 transition-colors ${activeTab === 'overview'
                                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Target size={20} />
                                Overview
                            </div>
                        </button>
                        {isOwner && (
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`pb-4 px-2 border-b-2 transition-colors ${activeTab === 'settings'
                                    ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Settings size={20} />
                                    Settings
                                </div>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Members Section */}
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                                <Users size={24} />
                                Members
                            </h2>
                            <div className="space-y-3">
                                {group.group_members?.length > 0 ? (
                                    group.group_members.map((member: any) => (
                                        <div
                                            key={member.user_id}
                                            className="flex items-center justify-between p-3 bg-white dark:bg-black rounded-lg"
                                        >
                                            <div>
                                                <p className="text-black dark:text-white font-medium">
                                                    {member.user_id}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                                {member.role}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                                        No members yet
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Goals Section - Placeholder */}
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                                <Target size={24} />
                                Goals
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                                No goals set yet. Create your first goal to start tracking progress!
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && isOwner && (
                    <GroupSettings group={group} onUpdate={fetchGroup} userId={user?.id || ''} />
                )}
            </div>
        </div>
    );
}