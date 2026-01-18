// app/teams/page.tsx
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Team = {
  id: number;
  name: string;
  age_group: string;
  season: string;
  active: boolean;
};

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading teams:", error);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Grassroots CoachLab</h1>
        <p>Failed to load teams.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Grassroots CoachLab</h1>

      <h2 className="text-xl mb-2">Teams</h2>

      {teams && teams.length > 0 ? (
        <ul className="space-y-2">
          {teams.map((team: Team) => (
            <li
              key={team.id}
              className="border rounded px-3 py-2 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  <Link
                    href={`/teams/${team.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {team.name}
                  </Link>
                </div>
                <div className="text-sm text-gray-600">
                  {team.age_group} · {team.season}
                </div>
              </div>
              {!team.active && (
                <span className="text-xs px-2 py-1 rounded bg-gray-200">
                  Inactive
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No teams found</p>
      )}
    </main>
  );
}
