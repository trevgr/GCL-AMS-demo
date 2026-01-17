// app/teams/[id]/page.tsx
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type Team = {
  id: number;
  name: string;
  age_group: string;
  season: string;
  active: boolean;
};

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type Session = {
  id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
};

export default async function TeamDetail(props: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 16: params is a Promise in async components
  const { id } = await props.params;
  const teamId = Number(id);

  if (Number.isNaN(teamId)) {
    console.error("Invalid team id:", id);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid team ID</h1>
      </main>
    );
  }

  // Load team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single<Team>();

  if (teamError || !team) {
    console.error("Error loading team:", teamError);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Team not found</h1>
      </main>
    );
  }

  // Load players assigned to this team
  const { data: assignments, error: playersError } = await supabase
    .from("player_team_assignments")
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
    .eq("team_id", teamId);

  if (playersError) {
    console.error("Error loading players for team:", playersError);
  }

  const players: Player[] =
    assignments?.map((row: any) => row.player).filter(Boolean) ?? [];

  // Load sessions for this team
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("team_id", teamId)
    .order("session_date", { ascending: false });

  if (sessionsError) {
    console.error("Error loading sessions for team:", sessionsError);
  }

  return (
    <main className="min-h-screen space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-1">{team.name}</h1>
        <p className="text-gray-600">
          {team.age_group} · {team.season}
        </p>
        {!team.active && (
          <p className="text-sm text-red-600 mt-1">Team marked inactive</p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Players</h2>
        {players.length === 0 ? (
          <p>No players assigned to this team.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="border rounded px-3 py-2 flex justify-between"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  {/* DOB intentionally not shown here */}
                </div>
                {!p.active && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-200">
                    Inactive
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Sessions</h2>
        {sessions && sessions.length > 0 ? (
          <ul className="space-y-2">
            {sessions.map((s: Session) => (
              <li
                key={s.id}
                className="border rounded px-3 py-2 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">
                    {new Date(s.session_date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {s.session_type}
                    {s.theme ? ` · ${s.theme}` : ""}
                  </div>
                </div>
                <span>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Attendance →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No sessions for this team yet.</p>
        )}
      </section>
    </main>
  );
}
