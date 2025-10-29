'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, RefreshCw, Check, Loader2 } from 'lucide-react';
import { getGroupInviteCode, regenerateInviteCode } from '@/lib/invite';

interface InviteCodeDisplayProps {
    groupId: string;
    userId: string;
}

export default function InviteCodeDisplay({ groupId, userId }: InviteCodeDisplayProps) {
    const [inviteCode, setInviteCode] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchInviteCode();
    }, [groupId]);

    const fetchInviteCode = async () => {
        setLoading(true);
        setError(null);

        const result = await getGroupInviteCode(groupId, userId);

        if (result.success && 'inviteCode' in result && result.inviteCode) {
            setInviteCode(result.inviteCode);
        } else {
            setError('error' in result && result.error ? result.error : 'Failed to load invite code');
        }

        setLoading(false);
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        setError(null);

        const result = await regenerateInviteCode(groupId, userId);

        if (result.success && 'inviteCode' in result && result.inviteCode) {
            setInviteCode(result.inviteCode);
        } else {
            setError('error' in result && result.error ? result.error : 'Failed to regenerate code');
        }

        setRegenerating(false);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (loading) {
        return (
            <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-black dark:text-white mb-4">Invite Code</h2>

            <div className="space-y-4">
                <div>
                    <Label htmlFor="invite-code">Share this code with friends</Label>
                    <div className="flex gap-2 mt-2">
                        <Input
                            id="invite-code"
                            value={inviteCode}
                            readOnly
                            className="font-mono text-lg"
                        />
                        <Button
                            onClick={handleCopy}
                            variant="outline"
                            className="flex-shrink-0"
                        >
                            {copied ? (
                                <>
                                    <Check className="h-4 w-4" />
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Anyone with this code can join your group
                    </p>
                    <Button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        variant="outline"
                        size="sm"
                    >
                        {regenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Regenerating...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerate
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}