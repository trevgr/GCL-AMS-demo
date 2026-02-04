// This is a Server Component - no "use client"

import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import SessionContent from "./SessionContent";

type SessionRow = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: {
    id: number;
    name: string;
    age_group: string;
    season: string;
  } | null;
};

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
  team_id?: number;
};

type AttendanceRow = {
  player_id: number;
  status: "present" | "absent";
};

type FeedbackRow = {
  id: number;
  player_id: number;
  session_id: number;
  coach_id: string | null;
  ball_control: number;
  passing: number;
  shooting: number;
  fitness: number;
  attitude: number;
  coachability: number;
  positioning: number;
  speed_agility: number;
  comments: string | null;
};

type MatchDetails = {
  session_id: number;
  opposition: string;
  venue_type: string;
  venue_name: string | null;
  competition: string | null;
  formation: string | null;
  goals_for: number;
  goals_against: number;
};

type MatchLineupRow = {
  player_id: number;
  role: "starter" | "sub";
  position: string | null;
  shirt_number: number | null;
  is_captain: boolean;
};

export default async function SessionLoader({ sessionId }: { sessionId: number }) {
  const supabase = await createServerSupabaseClient();

  // Load session with team
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select(
      `
      id,
      team_id,
      session_date,
      session_type,
      theme,
      team:teams (
        id,
        name,
        age_group,
        season
      )
    `
    )
    .eq("id", sessionId)
    .single<SessionRow>();

  if (sessionError || !sessionRow) {
    return <div className="p-4">Session not found</div>;
  }

  // Load players for this session's team
  let players: Player[] = [];
  if (sessionRow.team) {
    const { data: teamPlayersRows, error: teamPlayersError } = await supabase
      .from("team_players")
      .select(
        `
        player:players (
          id,
          name,
          dob,
          active
        )
      `
      )
      .eq("team_id", sessionRow.team.id)
      .eq("active", true);

    if (!teamPlayersError && teamPlayersRows) {
      players = teamPlayersRows
        .map((row: any) => ({
          ...(row.player as Player),
          team_id: sessionRow.team?.id,
        }))
        .filter((p: Player | null) => p != null);
    }
  }

  return (
    <SessionContent
      sessionData={sessionRow}
      initialPlayers={players}
      sessionId={sessionId}
    />
  );
}