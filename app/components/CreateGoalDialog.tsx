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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { createGoal } from '@/lib/goals';

interface CreateGoalDialogProps {
    groupId: string;
    userId: string;
    onGoalCreated?: () => void;
}

export default function CreateGoalDialog({ groupId, userId, onGoalCreated }: CreateGoalDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [targetValue, setTargetValue] = useState('10000');
    const [periodDays, setPeriodDays] = useState('7');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            setError('Goal title is required');
            return;
        }

        const targetNum = parseInt(targetValue);
        const periodNum = parseInt(periodDays);

        if (isNaN(targetNum) || targetNum <= 0) {
            setError('Target must be a positive number');
            return;
        }

        if (isNaN(periodNum) || periodNum <= 0) {
            setError('Duration must be a positive number');
            return;
        }

        setLoading(true);
        setError(null);

        const result = await createGoal(userId, groupId, {
            title: title.trim(),
            type: 'steps',
            target_value: targetNum,
            unit: 'steps',
            period_days: periodNum,
        });

        setLoading(false);

        if (result.success) {
            setTitle('');
            setTargetValue('10000');
            setPeriodDays('7');
            setOpen(false);
            onGoalCreated?.();
        } else {
            setError(result.error || 'Failed to create goal');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center gap-2">
                    <Plus size={20} />
                    Create Goal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create a New Goal</DialogTitle>
                        <DialogDescription>
                            Set a goal for your group to track together. All members will be added automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Goal Title */}
                        <div className="grid gap-2">
                            <Label htmlFor="title">Goal Title</Label>
                            <Input
                                id="title"
                                placeholder="e.g., Walk 10K steps daily"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={loading}
                                maxLength={100}
                            />
                        </div>

                        {/* Metric Type - Currently fixed to steps */}
                        <div className="grid gap-2">
                            <Label htmlFor="metric">Metric</Label>
                            <Select disabled value="steps">
                                <SelectTrigger id="metric">
                                    <SelectValue placeholder="Select metric" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="steps">Step Count</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                More metrics coming soon!
                            </p>
                        </div>

                        {/* Target Value */}
                        <div className="grid gap-2">
                            <Label htmlFor="target">Target (total steps)</Label>
                            <Input
                                id="target"
                                type="number"
                                placeholder="10000"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                disabled={loading}
                                min="1"
                            />
                        </div>

                        {/* Duration */}
                        <div className="grid gap-2">
                            <Label htmlFor="duration">Duration (days)</Label>
                            <Input
                                id="duration"
                                type="number"
                                placeholder="7"
                                value={periodDays}
                                onChange={(e) => setPeriodDays(e.target.value)}
                                disabled={loading}
                                min="1"
                                max="365"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Goal will start today and last for {periodDays} day{periodDays !== '1' ? 's' : ''}
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        )}
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
                            disabled={loading || !title.trim()}
                            className="bg-violet-600 hover:bg-violet-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Goal'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}