// app/teams/[id]/page.tsx
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export const dynamic = "force-dynamic";

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

type AttendanceRow = {
  player_id: number;
  status: "present" | "absent";
  session: {
    session_type: string;
    team_id: number;
  } | null;
};

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function TeamDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await props.params;
  const { view } = await props.searchParams;
  const teamId = Number(id);

  const activeTab: "players" | "sessions" =
    view === "sessions" ? "sessions" : "players";

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

  const typedSessions = (sessions ?? []) as Session[];

  // Load attendance for all players, joined with sessions to filter by team
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select(
      `
      player_id,
      status,
      session:sessions (
        session_type,
        team_id
      )
    `
    );

  if (attendanceError) {
    console.error("Error loading attendance for team players:", attendanceError);
  }

  const typedAttendance = (attendanceRows ?? []) as AttendanceRow[];

  // Build per-player training attendance stats for THIS team
  const attendanceByPlayer = new Map<
    number,
    {
      trainingSessions: number;
      trainingAttended: number;
    }
  >();

  for (const row of typedAttendance) {
    if (!row.session) continue;
    if (row.session.team_id !== teamId) continue;
    if (row.session.session_type !== "training") continue;

    const entry =
      attendanceByPlayer.get(row.player_id) ?? {
        trainingSessions: 0,
        trainingAttended: 0,
      };

    entry.trainingSessions += 1;
    if (row.status === "present") {
      entry.trainingAttended += 1;
    }

    attendanceByPlayer.set(row.player_id, entry);
  }

  return (
    <main className="min-h-screen space-y-4">
      {/* Team header */}
      <section>
        <h1 className="text-2xl font-bold mb-1">{team.name}</h1>
        <p className="text-gray-600">
          {team.age_group} · {team.season}
        </p>
        {!team.active && (
          <p className="text-sm text-red-600 mt-1">Team marked inactive</p>
        )}
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 text-sm mb-3">
          <Link
            href={`/teams/${teamId}?view=players`}
            className={`px-3 py-1 rounded border ${
              activeTab === "players"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Players
          </Link>
          <Link
            href={`/teams/${teamId}?view=sessions`}
            className={`px-3 py-1 rounded border ${
              activeTab === "sessions"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Sessions
          </Link>
        </div>

        {/* Players tab */}
        {activeTab === "players" && (
          <section>
            {players.length === 0 ? (
              <p>No players assigned to this team.</p>
            ) : (
              <ul className="space-y-2">
                {players.map((p) => {
                  const stats =
                    attendanceByPlayer.get(p.id) ?? {
                      trainingSessions: 0,
                      trainingAttended: 0,
                    };

                  return (
                    <li
                      key={p.id}
                      className="border rounded px-3 py-2 hover:bg-slate-50"
                    >
                      <Link href={`/players/${p.id}`} className="block">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-sm text-gray-600">
                              DOB: {formatDateDDMMYYYY(p.dob)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Status: {p.active ? "Active" : "Inactive"}
                            </div>
                          </div>
                          {!p.active && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-200">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {stats.trainingSessions === 0 ? (
                            <>No training sessions recorded yet.</>
                          ) : (
                            <>
                              Training attended:{" "}
                              <span className="font-semibold">
                                {stats.trainingAttended} /{" "}
                                {stats.trainingSessions}
                              </span>
                            </>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Sessions tab */}
        {activeTab === "sessions" && (
          <section>
            {typedSessions.length === 0 ? (
              <p>No sessions for this team yet.</p>
            ) : (
              <ul className="space-y-2 mt-2">
                {typedSessions.map((s) => (
                  <li
                    key={s.id}
                    className="border rounded px-3 py-2 flex justify-between items-center bg-white"
                  >
                    <div>
                      <div className="font-medium">
                        {formatDateDDMMYYYY(s.session_date)} ·{" "}
                        {s.session_type}
                      </div>
                      <div className="text-sm text-gray-600">
                        {s.theme ? `Theme: ${s.theme}` : ""}
                      </div>
                    </div>
                    <Link
                      href={`/sessions/${s.id}?view=attendance`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Session Details →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
