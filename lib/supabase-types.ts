


export type User = {
  id: string;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  email: string | null;
  twitter_handle: string | null;
  google_id: string | null;
  wallet_address: string | null;
  metadata: Record<string, any>;
};

export type Group = {
    id: string;
    created_at: string;
    updated_at: string;
    owner_id: string;
    name: string;
    description: string | null;
    is_private: boolean;
    allow_staking: boolean;
    invite_code: string | null;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: string; // 'member' by default
  joined_at: string;
};

export type Goal = {
  id: string;
  created_at: string;
  updated_at: string;
  creator_id: string;
  group_id: string | null;
  title: string;
  type: string; 
  target_value: number;
  unit: string;
  period_days: number;
  starts_on: string; // date
  ends_on: string; // date
  staking_opt_in: boolean;
};

export type GoalProgress = {
  id: string;
  user_id: string;
  goal_id: string;
  day: string; // date
  value: number;
  source: string;
  created_at: string;
};

export type Stake = {
  id: string;
  created_at: string;
  user_id: string;
  goal_id: string;
  status: 'pending' | 'active' | 'settled' | 'refunded'; // Assuming these values
  amount_minor: number;
  currency: string;
  chain: string | null;
  escrow_account: string | null;
  tx_init_sig: string | null;
  tx_settle_sig: string | null;
  resolved_at: string | null;
};

export type ChatRoom = {
  id: string;
  group_id: string | null;
  created_at: string;
  created_by: string;
  name: string | null;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

// Joined types for common queries
export type GroupWithMembers = Group & {
  group_members: GroupMember[];
};

export type GroupMemberWithGroup = GroupMember & {
  groups: Group;
};

export type GoalWithProgress = Goal & {
  goal_progress: GoalProgress[];
};