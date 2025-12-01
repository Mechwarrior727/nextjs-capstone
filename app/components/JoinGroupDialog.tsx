'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import { joinGroupWithCode } from '@/lib/invite';
import { useRouter } from 'next/navigation';

interface JoinGroupDialogProps {
    userId: string;
    onGroupJoined?: () => void;
}

export default function JoinGroupDialog({ userId, onGroupJoined }: JoinGroupDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inviteCode.trim()) {
            setError('Invite code is required');
            return;
        }

        setLoading(true);
        setError(null);

        const result = await joinGroupWithCode(inviteCode.trim(), userId);

        setLoading(false);

        if (result.success && result.group) {
            setInviteCode('');
            setOpen(false);
            onGroupJoined?.();

            // Navigate to the group page
            router.push(`/groups/${result.group.id}`);
        } else {
            setError(result.error || 'Failed to join group');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950 font-semibold flex items-center gap-2"
                >
                    <UserPlus size={20} />
                    Join Group
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Join a Group</DialogTitle>
                        <DialogDescription>
                            Enter the 3-word invite code shared by the group owner.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="code">Invite Code</Label>
                            <Input
                                id="code"
                                placeholder="e.g., apple-banana-cherry"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                disabled={loading}
                                className="font-mono"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Format: word-word-word
                            </p>
                            {error && (
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !inviteCode.trim()}
                            className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                'Join Group'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}