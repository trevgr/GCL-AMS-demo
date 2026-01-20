// app/teams/[id]/assign/page.tsx
import { supabase } from "@/lib/supabaseClient";
import { AssignPlayersClient } from "./AssignPlayersClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default async function AssignPlayersPage({ params }: PageProps) {
  const teamId = Number(params.id);

  // Load basic team info (for heading)
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, age_group, season_id")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return <main className="p-4 text-sm">Team not found.</main>;
  }

  // Load season info (optional, but nice for context)
  const { data: season } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date")
    .eq("id", team.season_id)
    .single();

  // Suggested players (from view that uses player_age_group_for_season)
  const { data: suggested, error: suggestedError } = await supabase
    .from("suggested_team_players")
    .select("player_id, player_name, player_dob")
    .eq("team_id", teamId)
    .order("player_name", { ascending: true });

  if (suggestedError) {
    console.error("Error loading suggestions", suggestedError);
  }

  // You might also want "all other players" to fill from
  const { data: allPlayers } = await supabase
    .from("players")
    .select("id, name, dob, active")
    .order("name", { ascending: true });

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">
        Assign players to {team.name}
      </h1>
      {season && (
        <p className="text-xs text-gray-600">
          Age group {team.age_group} · Season {season.name}
        </p>
      )}
      <AssignPlayersClient
        team={team}
        season={season ?? null}
        suggested={suggested ?? []}
        allPlayers={allPlayers ?? []}
      />
    </main>
  );
}
