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
import { Plus, Loader2, Coins, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { createGoal } from '@/lib/goals';
import { useEscrowActions } from '@/app/hooks/useEscrowActions';
import { usePrivy } from '@privy-io/react-auth';

interface CreateGoalDialogProps {
    groupId: string;
    userId: string;
    onGoalCreated?: () => void;
}

type ViewState = 'form' | 'success' | 'error';

export default function CreateGoalDialog({ groupId, userId, onGoalCreated }: CreateGoalDialogProps) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<ViewState>('form');

    // Form State
    const [title, setTitle] = useState('');
    const [targetValue, setTargetValue] = useState('10000');
    const [periodDays, setPeriodDays] = useState('7');
    const [stakeAmount, setStakeAmount] = useState('0');
    const [isTestMode, setIsTestMode] = useState(false);

    // Status State
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [isInsufficientFunds, setIsInsufficientFunds] = useState(false);

    const { createGoalAndStake } = useEscrowActions();
    const { authenticated } = usePrivy();

    const resetForm = () => {
        setTitle('');
        setTargetValue('10000');
        setPeriodDays('7');
        setStakeAmount('0');
        setIsTestMode(false);
        setView('form');
        setError(null);
        setTxSignature(null);
        setIsInsufficientFunds(false);
    };

    const handleClose = () => {
        setOpen(false);
        // Delay reset to allow animation/transition if needed, or just reset on next open
        setTimeout(resetForm, 300);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            setError('Goal title is required');
            return;
        }

        const targetNum = parseInt(targetValue);
        const periodNum = parseInt(periodDays);
        const stakeNum = parseFloat(stakeAmount);

        if (isNaN(targetNum) || targetNum <= 0) {
            setError('Target must be a positive number');
            return;
        }

        if (isNaN(periodNum) || periodNum <= 0) {
            setError('Duration must be a positive number');
            return;
        }

        if (stakeNum < 0) {
            setError('Stake amount cannot be negative');
            return;
        }

        setLoading(true);
        setLoadingMessage('Creating goal...');
        setError(null);
        setIsInsufficientFunds(false);

        try {
            // 1. Create Goal in Database
            const result = await createGoal(userId, groupId, {
                title: title.trim(),
                type: 'steps',
                target_value: targetNum,
                unit: 'steps',
                period_days: periodNum,
                staking_opt_in: stakeNum > 0,
            });

            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to create goal');
            }

            const goalId = result.data.id;

            // 2. If stake amount > 0, initialize on-chain goal and stake
            if (stakeNum > 0 && authenticated) {
                setLoadingMessage('Initializing & Staking on-chain...');

                // Generate 32-byte hash from goal ID
                const crypto = await import('crypto');
                const goalHash = crypto.createHash('sha256').update(goalId).digest();

                // Duration in minutes = periodDays * 24 * 60
                // If Test Mode is enabled, use 1 minute duration
                const durationMinutes = isTestMode ? 1 : periodNum * 24 * 60;

                // Convert stake amount to raw units (USDC has 6 decimals)
                const rawAmount = Math.floor(stakeNum * 1_000_000);

                // Execute bundled transaction
                const signature = await createGoalAndStake(
                    goalHash,
                    1, // 1 minute start delay
                    durationMinutes,
                    rawAmount
                );

                if (signature) {
                    setTxSignature(signature);
                }
            }

            // Success
            setView('success');
            onGoalCreated?.();

        } catch (err: any) {
            console.error('Goal creation error:', err);
            const message = err.message || 'Failed to create goal';
            setError(message);

            // Check for insufficient funds
            if (
                message.includes('insufficient funds') ||
                message.includes('0x1') ||
                JSON.stringify(err).includes('insufficient funds')
            ) {
                setIsInsufficientFunds(true);
            }

            setView('error');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    const renderSuccess = () => (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">Goal Created Successfully!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    "{title}" has been set for {isTestMode ? '1 minute (Test Mode)' : `${periodDays} days`}.
                </p>
                {parseFloat(stakeAmount) > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Staked Amount
                        </p>
                        <div className="flex items-center justify-center gap-2 text-lg font-bold text-yellow-600 dark:text-yellow-400">
                            <Coins size={20} />
                            {stakeAmount} USDC
                        </div>
                        {txSignature && (
                            <a
                                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-600 mt-2 hover:underline"
                            >
                                View Transaction <ExternalLink size={10} />
                            </a>
                        )}
                    </div>
                )}
            </div>
            <Button onClick={handleClose} className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-black font-bold">
                Done
            </Button>
        </div>
    );

    const renderError = () => (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">Creation Failed</h3>
                <p className="text-sm text-red-600 dark:text-red-400 max-w-[300px] mx-auto break-words">
                    {error}
                </p>

                {isInsufficientFunds && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800 text-left">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    Insufficient Funds
                                </p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                    You need Devnet SOL (for fees) and Devnet USDC (for staking) to create this goal.
                                </p>
                                <div className="flex flex-col gap-1 mt-2">
                                    <a
                                        href="https://faucet.solana.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        Get Devnet SOL <ExternalLink size={10} />
                                    </a>
                                    <a
                                        href="https://spl-token-faucet.com/?token-name=USDC-Dev"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        Get Devnet USDC <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex gap-2 w-full mt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                    Close
                </Button>
                <Button onClick={() => setView('form')} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black font-bold">
                    Try Again
                </Button>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold flex items-center gap-2">
                    <Plus size={20} />
                    Create Goal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                {view === 'success' ? (
                    renderSuccess()
                ) : view === 'error' ? (
                    renderError()
                ) : (
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Create a New Goal</DialogTitle>
                            <DialogDescription>
                                Set a goal for your group to track together.
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

                            {/* Metric Type */}
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
                            </div>

                            {/* Stake Amount */}
                            <div className="grid gap-2">
                                <Label htmlFor="stake" className="flex items-center gap-2">
                                    <Coins size={16} className="text-yellow-500" />
                                    Stake Amount (USDC)
                                </Label>
                                <Input
                                    id="stake"
                                    type="number"
                                    placeholder="0.00"
                                    value={stakeAmount}
                                    onChange={(e) => setStakeAmount(e.target.value)}
                                    disabled={loading}
                                    min="0"
                                    step="0.1"
                                />
                                <p className="text-xs text-gray-500">
                                    Optional. Amount will be returned if you complete the goal.
                                </p>
                            </div>

                            {/* Test Mode Checkbox */}
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="testMode"
                                    checked={isTestMode}
                                    onChange={(e) => setIsTestMode(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                />
                                <Label htmlFor="testMode" className="text-sm text-gray-600 dark:text-gray-400">
                                    Test Mode (1 minute duration)
                                </Label>
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
                                disabled={loading || !title.trim()}
                                className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {loadingMessage || 'Creating...'}
                                    </>
                                ) : (
                                    'Create Goal'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}