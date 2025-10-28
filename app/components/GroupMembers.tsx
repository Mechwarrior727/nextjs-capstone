'use client';

import { Users } from 'lucide-react';

interface Member {
    user_id: string;
    role: string;
    joined_at: string;
    users: {
        id: string;
        display_name: string | null;
        email: string | null;
        google_id: string | null;
    };
}

interface GroupMembersProps {
    members: Member[];
}

// Helper function to get display name
function getDisplayName(member: Member): string {
    // Priority: display_name > email > user_id
    if (member.users?.display_name) {
        return member.users.display_name;
    }
    if (member.users?.email) {
        return member.users.email;
    }
    // Fallback to shortened user_id
    return member.user_id.split(':').pop()?.slice(0, 8) || member.user_id;
}

export default function GroupMembers({ members }: GroupMembersProps) {
    return (
        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                <Users size={24} />
                Members ({members.length})
            </h2>
            <div className="space-y-3">
                {members.length > 0 ? (
                    members.map((member) => (
                        <div
                            key={member.user_id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-black rounded-lg"
                        >
                            <div className="flex-1">
                                <p className="text-black dark:text-white font-medium">
                                    {getDisplayName(member)}
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
    );
}