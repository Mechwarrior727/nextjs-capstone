export type UserHealthData = {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  calories: number | null;
  source: string;
  created_at: string;
};
