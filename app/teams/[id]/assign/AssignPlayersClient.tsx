// app/teams/[id]/assign/AssignPlayersClient.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Team = {
  id: number;
  name: string;
  age_group: string;
  season_id: number | null;
};

type Season = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
} | null;

type SuggestedRow = {
  player_id: number;
  player_name: string;
  player_dob: string;
};

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type Props = {
  team: Team;
  season: Season;
  suggested: SuggestedRow[];
  allPlayers: Player[];
};

export function AssignPlayersClient({
  team,
  season,
  suggested,
  allPlayers,
}: Props) {
  const [addingIds, setAddingIds] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddToTeam = async (playerId: number) => {
    setError(null);
    setMessage(null);
    setAddingIds((prev) => [...prev, playerId]);

    const { error } = await supabase.from("team_players").insert({
      team_id: team.id,
      player_id: playerId,
      active: true,
    });

    if (error) {
      console.error("Error adding player to team:", error);
      setError("Failed to add player. Please try again.");
    } else {
      setMessage("Player added to team.");
      // In a real app you might use router.refresh() instead:
      // but here we just leave it and let a manual reload pick it up.
    }

    setAddingIds((prev) => prev.filter((id) => id !== playerId));
  };

  return (
    <div className="space-y-4 text-sm">
      {message && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Suggested players for {team.age_group}
          {season ? ` (${season.name})` : ""}
        </h2>
        {suggested.length === 0 ? (
          <p className="text-xs text-gray-600">
            No obvious matches by DOB for this team.
          </p>
        ) : (
          <ul className="space-y-1">
            {suggested.map((row) => (
              <li
                key={row.player_id}
                className="flex justify-between items-center border rounded px-2 py-1 bg-white"
              >
                <div>
                  <div className="font-medium text-sm">{row.player_name}</div>
                  <div className="text-xs text-gray-500">
                    DOB {row.player_dob}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddToTeam(row.player_id)}
                  disabled={addingIds.includes(row.player_id)}
                  className="text-xs px-3 py-1 rounded bg-slate-900 text-slate-50 disabled:opacity-60"
                >
                  {addingIds.includes(row.player_id)
                    ? "Adding..."
                    : "Add to team"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Optional: list all players for manual override */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">All players</h2>
        <p className="text-xs text-gray-600">
          Use this list if you need to override the suggested age group.
        </p>
        <ul className="space-y-1 max-h-64 overflow-auto border rounded bg-white">
          {allPlayers.map((p) => (
            <li
              key={p.id}
              className="flex justify-between items-center px-2 py-1 border-b last:border-b-0"
            >
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-500">DOB {p.dob}</div>
              </div>
              <button
                type="button"
                onClick={() => handleAddToTeam(p.id)}
                disabled={addingIds.includes(p.id)}
                className="text-xs px-3 py-1 rounded border border-slate-400 bg-white hover:bg-slate-100 disabled:opacity-60"
              >
                {addingIds.includes(p.id) ? "Adding..." : "Add"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
