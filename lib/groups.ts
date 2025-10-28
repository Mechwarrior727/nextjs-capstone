'use server';

import { withAdmin } from '@/lib/supabase';
import type { Group, GroupMemberWithGroup } from '@/lib/supabase-types';

export async function createGroup(userId: string, groupName: string) {
    try {
        return await withAdmin(async (supabase) => {
            // Create the group
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    name: groupName,
                    owner_id: userId,
                    is_private: true,
                    allow_staking: false,
                })
                .select()
                .single();

            if (groupError) {
                console.error('Error creating group:', groupError);
                return { success: false, error: groupError.message };
            }

            // Automatically add the creator as a member with 'owner' role
            const { error: memberError } = await supabase
                .from('group_members')
                .insert({
                    group_id: group.id,
                    user_id: userId,
                    role: 'owner',
                });

            if (memberError) {
                console.error('Error adding creator as member:', memberError);
                // Rollback: delete the group if we couldn't add the member
                await supabase.from('groups').delete().eq('id', group.id);
                return { success: false, error: memberError.message };
            }

            return { success: true, group };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function getUserGroups(userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            const { data, error } = await supabase
                .from('group_members')
                .select(`
          *,
          groups (
            id,
            name,
            description,
            owner_id,
            is_private,
            allow_staking,
            created_at,
            updated_at
          )
        `)
                .eq('user_id', userId)
                .order('joined_at', { ascending: false });

            if (error) {
                console.error('Error fetching user groups:', error);
                return { success: false, error: error.message, data: [] };
            }

            return { success: true, data: data as GroupMemberWithGroup[] };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}

export async function getGroupById(groupId: string) {
    try {
        return await withAdmin(async (supabase) => {
            const { data, error } = await supabase
                .from('groups')
                .select(`
          *,
          group_members (
            user_id,
            role,
            joined_at,
            users (
              id,
              display_name,
              email,
              google_id
            )
          )
        `)
                .eq('id', groupId)
                .single();

            if (error) {
                console.error('Error fetching group:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function updateGroup(
    groupId: string,
    userId: string,
    updates: {
        name?: string;
        description?: string;
        is_private?: boolean;
        allow_staking?: boolean;
    }
) {
    try {
        return await withAdmin(async (supabase) => {
            // First check if user is the owner
            const { data: group, error: checkError } = await supabase
                .from('groups')
                .select('owner_id')
                .eq('id', groupId)
                .single();

            if (checkError || !group) {
                return { success: false, error: 'Group not found' };
            }

            if (group.owner_id !== userId) {
                return { success: false, error: 'Only the owner can update group settings' };
            }

            // Update the group
            const { data, error } = await supabase
                .from('groups')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', groupId)
                .select()
                .single();

            if (error) {
                console.error('Error updating group:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}