'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, MessageCircle, X } from 'lucide-react';
import { getOrCreateGroupChatRoom, getChatMessages, sendChatMessage } from '@/lib/chat';

interface GroupChatProps {
    groupId: string;
    userId: string;
    userName: string;
}

export default function GroupChat({ groupId, userId, userName }: GroupChatProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        initializeChat();
    }, [groupId]);

    useEffect(() => {
        if (roomId && isOpen) {
            fetchMessages();
            // Set up polling for new messages every 3 seconds
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [roomId, isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const initializeChat = async () => {
        setLoading(true);
        const result = await getOrCreateGroupChatRoom(groupId, userId);
        
        if (result.success && result.room) {
            setRoomId(result.room.id);
        }
        setLoading(false);
    };

    const fetchMessages = async () => {
        if (!roomId) return;

        const result = await getChatMessages(roomId);
        if (result.success && result.data) {
            setMessages(result.data);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newMessage.trim() || !roomId || sending) return;

        setSending(true);
        const result = await sendChatMessage(roomId, userId, newMessage);

        if (result.success) {
            setNewMessage('');
            await fetchMessages();
        }
        setSending(false);
    };

    const getMessageDisplayName = (msg: any) => {
        if (msg.user_id === userId) return 'You';
        return msg.users?.display_name || msg.users?.email || 'Unknown';
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-40 bg-violet-600 hover:bg-violet-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110"
                aria-label="Toggle chat"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {/* Chat Panel */}
            <div
                className={`fixed bottom-0 right-0 z-30 w-full sm:w-96 h-[500px] bg-white dark:bg-gray-950 border-l border-t border-gray-200 dark:border-gray-800 shadow-2xl transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-gray-400" size={24} />
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Chat Header */}
                        <div className="bg-violet-600 text-white px-4 py-3 font-semibold">
                            Group Chat
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-black">
                            {messages.length === 0 ? (
                                <div className="text-center text-gray-500 dark:text-gray-500 py-8">
                                    No messages yet. Start the conversation!
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isOwn = msg.user_id === userId;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                                                    isOwn
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-200 dark:border-gray-800'
                                                }`}
                                            >
                                                {!isOwn && (
                                                    <div className="text-xs font-semibold mb-1 opacity-75">
                                                        {getMessageDisplayName(msg)}
                                                    </div>
                                                )}
                                                <div className="break-words">{msg.body}</div>
                                                <div className={`text-xs mt-1 ${isOwn ? 'opacity-75' : 'opacity-50'}`}>
                                                    {formatTime(msg.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                            <form onSubmit={handleSend} className="flex gap-2">
                                <Input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    disabled={sending}
                                    className="flex-1"
                                    maxLength={1000}
                                />
                                <Button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="bg-violet-600 hover:bg-violet-700"
                                >
                                    {sending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 sm:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}