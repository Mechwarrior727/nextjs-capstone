'use server';

import { withAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Load word list from file on server startup
let WORD_LIST: string[] = [];

function loadWordList(): string[] {
    if (WORD_LIST.length > 0) {
        return WORD_LIST;
    }

    try {
        // Read from public/wordlist.txt or lib/wordlist.txt
        // Adjust the path based on where you place your file
        const filePath = path.join(process.cwd(), 'lib', 'dictionary.txt');
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Split by lines and filter out empty lines
        WORD_LIST = fileContent
            .split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 0);

        if (WORD_LIST.length === 0) {
            throw new Error('Word list is empty');
        }

        console.log(`Loaded ${WORD_LIST.length} words from dictionary.txt`);
        return WORD_LIST;
    } catch (error) {
        console.error('Error loading word list:', error);
        // Fallback to a small list if file can't be read
        WORD_LIST = [
            'apple', 'banana', 'cherry', 'dragon', 'elephant', 'falcon',
            'giraffe', 'hammer', 'island', 'jungle', 'kitten', 'ladder'
        ];
        console.warn('Using fallback word list');
        return WORD_LIST;
    }
}

/**
 * Generates a random 3-word invite code
 */
function generateInviteCode(): string {
    const wordList = loadWordList();
    console.log(`Generating invite code from ${wordList.length} words`);
    const words: string[] = [];
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * wordList.length);
        words.push(wordList[randomIndex]);
    }
    const code = words.join('-');
    console.log(`Generated invite code: ${code}`);
    return code;
}

/**
 * Generates a unique invite code for a group
 * Checks database to ensure uniqueness
 */
export async function createInviteCodeForGroup(groupId: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            // Verify user is owner
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .select('owner_id, invite_code')
                .eq('id', groupId)
                .single();

            if (groupError || !group) {
                return { success: false, error: 'Group not found' };
            }

            if (group.owner_id !== userId) {
                return { success: false, error: 'Only the owner can generate invite codes' };
            }

            // If group already has an invite code, return it
            if (group.invite_code) {
                return { success: true, inviteCode: group.invite_code };
            }

            // Generate unique code
            let inviteCode = generateInviteCode();
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                // Check if code exists
                const { data: existing } = await supabase
                    .from('groups')
                    .select('id')
                    .eq('invite_code', inviteCode)
                    .single();

                if (!existing) {
                    // Code is unique, assign it
                    const { error: updateError } = await supabase
                        .from('groups')
                        .update({ invite_code: inviteCode })
                        .eq('id', groupId);

                    if (updateError) {
                        console.error('Error updating group with invite code:', updateError);
                        return { success: false, error: updateError.message };
                    }

                    return { success: true, inviteCode };
                }

                // Code exists, generate new one
                inviteCode = generateInviteCode();
                attempts++;
            }

            return { success: false, error: 'Failed to generate unique invite code' };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Regenerates invite code for a group
 */
export async function regenerateInviteCode(groupId: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            // Verify user is owner
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .select('owner_id')
                .eq('id', groupId)
                .single();

            if (groupError || !group) {
                return { success: false, error: 'Group not found' };
            }

            if (group.owner_id !== userId) {
                return { success: false, error: 'Only the owner can regenerate invite codes' };
            }

            // Generate new unique code
            let inviteCode = generateInviteCode();
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                const { data: existing } = await supabase
                    .from('groups')
                    .select('id')
                    .eq('invite_code', inviteCode)
                    .single();

                if (!existing) {
                    const { error: updateError } = await supabase
                        .from('groups')
                        .update({ invite_code: inviteCode })
                        .eq('id', groupId);

                    if (updateError) {
                        return { success: false, error: updateError.message };
                    }

                    return { success: true, inviteCode };
                }

                inviteCode = generateInviteCode();
                attempts++;
            }

            return { success: false, error: 'Failed to generate unique invite code' };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Joins a group using an invite code
 */
export async function joinGroupWithCode(inviteCode: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            // Normalize the code
            const normalizedCode = inviteCode.toLowerCase().trim();

            // Find group by invite code
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .select('id, name, is_private')
                .eq('invite_code', normalizedCode)
                .single();

            if (groupError || !group) {
                return { success: false, error: 'Invalid invite code' };
            }

            // Check if user is already a member
            const { data: existingMember } = await supabase
                .from('group_members')
                .select('user_id')
                .eq('group_id', group.id)
                .eq('user_id', userId)
                .single();

            if (existingMember) {
                return { success: false, error: 'You are already a member of this group' };
            }

            // Add user to group
            const { error: memberError } = await supabase
                .from('group_members')
                .insert({
                    group_id: group.id,
                    user_id: userId,
                    role: 'member',
                });

            if (memberError) {
                console.error('Error adding member:', memberError);
                return { success: false, error: memberError.message };
            }

            return { success: true, group };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Gets the invite code for a group (owner only)
 */
export async function getGroupInviteCode(groupId: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            const { data: group, error } = await supabase
                .from('groups')
                .select('owner_id, invite_code')
                .eq('id', groupId)
                .single();

            if (error || !group) {
                return { success: false, error: 'Group not found' };
            }

            if (group.owner_id !== userId) {
                return { success: false, error: 'Only the owner can view invite codes' };
            }

            // Generate code if it doesn't exist
            if (!group.invite_code) {
                return await createInviteCodeForGroup(groupId, userId);
            }

            return { success: true, inviteCode: group.invite_code };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}