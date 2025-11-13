'use server';

import { withAdmin } from '@/lib/supabase';

export async function getOrCreateGroupChatRoom(groupId: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            // Check if chat room already exists for this group
            const { data: existingRoom, error: fetchError } = await supabase
                .from('chat_rooms')
                .select('*')
                .eq('group_id', groupId)
                .single();

            if (existingRoom) {
                return { success: true, room: existingRoom };
            }

            // Create new chat room
            const { data: newRoom, error: createError } = await supabase
                .from('chat_rooms')
                .insert({
                    group_id: groupId,
                    created_by: userId,
                    name: 'Group Chat',
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating chat room:', createError);
                return { success: false, error: createError.message };
            }

            // Add all group members to the chat room
            const { data: members } = await supabase
                .from('group_members')
                .select('user_id')
                .eq('group_id', groupId);

            if (members && members.length > 0) {
                const chatMembers = members.map(m => ({
                    room_id: newRoom.id,
                    user_id: m.user_id,
                }));

                await supabase.from('chat_members').insert(chatMembers);
            }

            return { success: true, room: newRoom };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function getChatMessages(roomId: string, limit: number = 50) {
    try {
        return await withAdmin(async (supabase) => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select(`
                    *,
                    users (
                        id,
                        display_name,
                        email
                    )
                `)
                .eq('room_id', roomId)
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) {
                console.error('Error fetching messages:', error);
                return { success: false, error: error.message, data: [] };
            }

            return { success: true, data };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}

export async function sendChatMessage(roomId: string, userId: string, message: string) {
    try {
        return await withAdmin(async (supabase) => {
            if (!message.trim()) {
                return { success: false, error: 'Message cannot be empty' };
            }

            const { data, error } = await supabase
                .from('chat_messages')
                .insert({
                    room_id: roomId,
                    user_id: userId,
                    body: message.trim(),
                })
                .select(`
                    *,
                    users (
                        id,
                        display_name,
                        email
                    )
                `)
                .single();

            if (error) {
                console.error('Error sending message:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}