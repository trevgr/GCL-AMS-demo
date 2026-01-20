// app/teams/[id]/AssignPlayersClient.tsx (example)

import { getAgeGroupForSeason, playerMatchesTeamAgeGroup, SeasonInfo } from "@/lib/ageGroups";

type Player = {
  id: number;
  name: string;
  dob: string;
};

type Team = {
  id: number;
  name: string;
  age_group: string; // "U11"
  season_id: number;
};

type Props = {
  team: Team;
  season: SeasonInfo;    // from Supabase: seasons row
  allPlayers: Player[];  // all club players
};

export function AssignPlayersClient({ team, season, allPlayers }: Props) {
  const suggested = allPlayers.filter((p) =>
    playerMatchesTeamAgeGroup(p.dob, team.age_group, season)
  );

  const others = allPlayers.filter(
    (p) => !playerMatchesTeamAgeGroup(p.dob, team.age_group, season)
  );

  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold">
        Assign players to {team.name} ({team.age_group} · {season.name})
      </h2>

      <section>
        <h3 className="font-medium mb-1">
          Suggested for {team.age_group} this season
        </h3>
        {suggested.length === 0 ? (
          <p className="text-xs text-gray-600">No obvious matches by DOB.</p>
        ) : (
          <ul className="space-y-1">
            {suggested.map((p) => (
              <li key={p.id} className="flex justify-between items-center border rounded px-2 py-1 bg-white">
                <span>
                  {p.name}{" "}
                  <span className="text-xs text-gray-500">
                    (DOB {p.dob}, {getAgeGroupForSeason(p.dob, season.startDate)})
                  </span>
                </span>
                {/* Here you’d add a button/checkbox to add/remove from team_players */}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-1">Other players</h3>
        <ul className="space-y-1">
          {others.map((p) => (
            <li key={p.id} className="flex justify-between items-center border rounded px-2 py-1 bg-white">
              <span>
                {p.name}{" "}
                <span className="text-xs text-gray-500">
                  (DOB {p.dob},{" "}
                  {getAgeGroupForSeason(p.dob, season.startDate) ?? "No U-band"})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
