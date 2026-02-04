export type MatchEvent = {
  id: number | string;
  session_id: number;
  event_type: "goal" | "yellow_card" | "red_card" | "substitution";
  player_id: number;
  player_name: string;
  team_id: number;
  minute: number;
  assisting_player_id?: number | null;
  assisting_player_name?: string | null;
  is_own_goal: boolean;
  notes: string | null;
  created_at: string;
};