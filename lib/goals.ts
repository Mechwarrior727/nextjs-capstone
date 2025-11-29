'use server';

import { withAdmin } from '@/lib/supabase';

export async function createGoal(
    userId: string,
    groupId: string,
    data: {
        title: string;
        type: string;
        target_value: number;
        unit: string;
        period_days: number;
        staking_opt_in?: boolean;
    }
) {
    try {
        return await withAdmin(async (supabase) => {
            const { data: membership, error: memberError } = await supabase
                .from('group_members')
                .select('*')
                .eq('group_id', groupId)
                .eq('user_id', userId)
                .single();

            if (memberError || !membership) {
                return { success: false, error: 'You must be a member of this group to create goals' };
            }

            const startsOn = new Date();
            const endsOn = new Date();
            endsOn.setDate(endsOn.getDate() + data.period_days);

            // Create the goal
            const { data: goal, error: goalError } = await supabase
                .from('goals')
                .insert({
                    creator_id: userId,
                    group_id: groupId,
                    title: data.title,
                    type: data.type,
                    target_value: data.target_value,
                    unit: data.unit,
                    period_days: data.period_days,
                    starts_on: startsOn.toISOString().split('T')[0],
                    ends_on: endsOn.toISOString().split('T')[0],
                    staking_opt_in: data.staking_opt_in ?? false,
                })
                .select()
                .single();

            if (goalError) {
                console.error('Error creating goal:', goalError);
                return { success: false, error: goalError.message };
            }

            // Add all group members to the goal
            const { data: members } = await supabase
                .from('group_members')
                .select('user_id')
                .eq('group_id', groupId);

            if (members && members.length > 0) {
                const userGoals = members.map(m => ({
                    user_id: m.user_id,
                    goal_id: goal.id,
                }));

                await supabase.from('user_goals').insert(userGoals);
            }

            return { success: true, data: goal };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function getGroupGoals(groupId: string) {
    try {
        return await withAdmin(async (supabase) => {
            const { data, error } = await supabase
                .from('goals')
                .select(`
                    *,
                    users!goals_creator_id_fkey (
                        id,
                        display_name,
                        email
                    )
                `)
                .eq('group_id', groupId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching goals:', error);
                return { success: false, error: error.message, data: [] };
            }

            return { success: true, data };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}

export async function getGoalProgress(goalId: string) {
    try {
        return await withAdmin(async (supabase) => {
            const { data: goal, error: goalError } = await supabase
                .from('goals')
                .select('*, user_goals(user_id)')
                .eq('id', goalId)
                .single();

            if (goalError || !goal) {
                return { success: false, error: 'Goal not found', data: null };
            }


            const userIds = goal.user_goals.map((ug: any) => ug.user_id);

            const { data: healthData, error: healthError } = await supabase
                .from('user_health_data')
                .select(`
                    *,
                    users (
                        id,
                        display_name,
                        email
                    )
                `)
                .in('user_id', userIds)
                .gte('date', goal.starts_on)
                .lte('date', goal.ends_on)
                .order('date', { ascending: true });

            if (healthError) {
                console.error('Error fetching health data:', healthError);
                return { success: false, error: healthError.message, data: null };
            }

            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, display_name, email')
                .in('id', userIds);

            if (usersError) {
                console.error('Error fetching users:', usersError);
                return { success: false, error: usersError.message, data: null };
            }

            const progressByUser = users?.map(user => {
                const userHealthData = healthData?.filter(d => d.user_id === user.id) || [];

                let totalSteps = 0;
                const dailyData: { date: string; steps: number }[] = [];

                userHealthData.forEach(d => {
                    totalSteps += d.steps || 0;
                    dailyData.push({
                        date: d.date,
                        steps: d.steps || 0,
                    });
                });

                return {
                    user_id: user.id,
                    display_name: user.display_name || user.email || user.id,
                    total: totalSteps,
                    daily: dailyData,
                    percentage: goal.target_value > 0 ? (totalSteps / goal.target_value) * 100 : 0,
                };
            }) || [];

            return {
                success: true,
                data: {
                    goal,
                    progress: progressByUser,
                },
            };
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred', data: null };
    }
}