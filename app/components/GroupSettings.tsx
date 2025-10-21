'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { updateGroup } from '@/lib/groups';

interface GroupSettingsProps {
    group: any;
    onUpdate: () => void;
    userId: string;
}

export default function GroupSettings({ group, onUpdate, userId }: GroupSettingsProps) {
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description || '');
    const [isPrivate, setIsPrivate] = useState(group.is_private);
    const [allowStaking, setAllowStaking] = useState(group.allow_staking);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const hasChanges =
        name !== group.name ||
        description !== (group.description || '') ||
        isPrivate !== group.is_private ||
        allowStaking !== group.allow_staking;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Group name is required');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        const result = await updateGroup(group.id, userId, {
            name: name.trim(),
            description: description.trim() || null,
            is_private: isPrivate,
            allow_staking: allowStaking,
        });

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            onUpdate();
            setTimeout(() => setSuccess(false), 3000);
        } else {
            setError(result.error || 'Failed to update group');
        }
    };

    return (
        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">Group Settings</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Group Name */}
                <div className="space-y-2">
                    <Label htmlFor="name">Group Name</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        maxLength={100}
                        placeholder="e.g., Morning Runners 🏃"
                    />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={loading}
                        maxLength={500}
                        placeholder="What's this group about?"
                        rows={3}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                        {description.length}/500 characters
                    </p>
                </div>

                {/* Privacy Settings */}
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <h3 className="font-semibold text-black dark:text-white">Privacy & Features</h3>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="private">Private Group</Label>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Only invited members can join
                            </p>
                        </div>
                        <Switch
                            id="private"
                            checked={isPrivate}
                            onCheckedChange={setIsPrivate}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="staking">Allow Staking</Label>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Enable money pooling for goals
                            </p>
                        </div>
                        <Switch
                            id="staking"
                            checked={allowStaking}
                            onCheckedChange={setAllowStaking}
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-700 dark:text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg text-green-700 dark:text-green-200 text-sm">
                        Settings updated successfully!
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <Button
                        type="submit"
                        disabled={loading || !hasChanges}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}