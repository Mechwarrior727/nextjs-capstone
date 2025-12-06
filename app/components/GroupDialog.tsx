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
import { Plus, Loader2 } from 'lucide-react';
import { createGroup } from '@/lib/groups';
import { sanitizeGroupName } from '@/lib/sanitization';

interface CreateGroupDialogProps {
    userId: string;
    onGroupCreated?: () => void;
}

export default function CreateGroupDialog({ userId, onGroupCreated }: CreateGroupDialogProps) {
    const [open, setOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Sanitize and validate input
        const { valid, sanitized, error: validationError } = sanitizeGroupName(groupName);

        if (!valid) {
            setError(validationError || 'Invalid group name');
            return;
        }

        setLoading(true);
        setError(null);

        // Use sanitized value
        const result = await createGroup(userId, sanitized);

        setLoading(false);

        if (result.success) {
            setGroupName('');
            setOpen(false);
            onGroupCreated?.();
        } else {
            setError(result.error || 'Failed to create group');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold flex items-center gap-2">
                    <Plus size={20} />
                    Create Group
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create a New Group</DialogTitle>
                        <DialogDescription>
                            Start a new habit tracking group. You can add goals and invite friends after creation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Group Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Runners"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                disabled={loading}
                                maxLength={100}
                            />
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
                            disabled={loading || !groupName.trim()}
                            className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Group'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}