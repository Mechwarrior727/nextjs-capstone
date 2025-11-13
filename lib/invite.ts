'use server';

import { withAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

let WORD_LIST: string[] = [];

function loadWordList(): string[] {
    if (WORD_LIST.length > 0) {
        return WORD_LIST;
    }
    try {
        const filePath = path.join(process.cwd(), 'lib', 'dictionary.txt');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
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
        throw new Error('Failed to load word list');
    }
}


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

export async function createInviteCodeForGroup(groupId: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {

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

            if (group.invite_code) {
                return { success: true, inviteCode: group.invite_code };
            }


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
                        console.error('Error updating group with invite code:', updateError);
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


export async function regenerateInviteCode(groupId: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {

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

export async function joinGroupWithCode(inviteCode: string, userId: string) {
    try {
        return await withAdmin(async (supabase) => {
            const normalizedCode = inviteCode.toLowerCase().trim();

            const { data: group, error: groupError } = await supabase
                .from('groups')
                .select('id, name, is_private')
                .eq('invite_code', normalizedCode)
                .single();

            if (groupError || !group) {
                return { success: false, error: 'Invalid invite code' };
            }

            const { data: existingMember } = await supabase
                .from('group_members')
                .select('user_id')
                .eq('group_id', group.id)
                .eq('user_id', userId)
                .single();

            if (existingMember) {
                return { success: false, error: 'You are already a member of this group' };
            }

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