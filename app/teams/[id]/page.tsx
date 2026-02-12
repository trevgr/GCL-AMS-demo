// app/teams/[id]/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import AddPlayerClient from "./AddPlayerClient";

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
    id: number;
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

function pct(n: number, d: number) {
  if (d <= 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function TeamDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const supabase = await createServerSupabaseClient();

  const { id } = await props.params;
  const { view } = await props.searchParams;
  const teamId = Number(id);

  const activeTab: "players" | "sessions" | "attendance" =
    view === "sessions"
      ? "sessions"
      : view === "attendance"
      ? "attendance"
      : "players";

  if (Number.isNaN(teamId)) {
    console.error("Invalid team id:", id);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid team ID</h1>
      </main>
    );
  }

  // ---- Load team ----
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

  // ---- Load players assigned to this team ----
  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select(
      `
      id,
      name,
      dob,
      active,
      team_players!inner (
        team_id
      )
    `
    )
    .eq("team_players.team_id", teamId)
    .order("name", { ascending: true });

  if (playersError) {
    console.error("Error loading players for team:", playersError);
  }

  const players: Player[] =
    playersData?.map((p: any) => ({
      id: p.id,
      name: p.name,
      dob: p.dob,
      active: p.active,
    })) ?? [];

  // ---- Load sessions for this team ----
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("team_id", teamId)
    .order("session_date", { ascending: false });

  if (sessionsError) {
    console.error("Error loading sessions for team:", sessionsError);
  }

  const typedSessions = (sessions ?? []) as Session[];
  const totalTeamSessions = typedSessions.length;

  // ---- Load attendance joined with sessions (filter to this team on the server) ----
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select(
      `
      player_id,
      status,
      session:sessions!inner (
        id,
        team_id
      )
    `
    )
    .eq("session.team_id", teamId);

  if (attendanceError) {
    console.error("Error loading attendance for team:", attendanceError);
  }

  const typedAttendance = (attendanceRows ?? []) as AttendanceRow[];

  // Build per-player attendance stats for THIS team
  const attendanceByPlayer = new Map<
    number,
    {
      present: number;
      marked: number;
    }
  >();

  for (const row of typedAttendance) {
    if (!row.session) continue;
    if (row.session.team_id !== teamId) continue;

    const entry =
      attendanceByPlayer.get(row.player_id) ?? {
        present: 0,
        marked: 0,
      };

    entry.marked += 1;
    if (row.status === "present") entry.present += 1;

    attendanceByPlayer.set(row.player_id, entry);
  }

  // Leaderboard rows
  const leaderboard = players
    .map((p) => {
      const stats = attendanceByPlayer.get(p.id) ?? { present: 0, marked: 0 };
      return {
        playerId: p.id,
        name: p.name,
        active: p.active,
        present: stats.present,
        marked: stats.marked,
        total: totalTeamSessions,
        percent: totalTeamSessions > 0 ? stats.present / totalTeamSessions : 0,
      };
    })
    .sort((a, b) => {
      if (b.present !== a.present) return b.present - a.present;
      if (b.marked !== a.marked) return b.marked - a.marked;
      return a.name.localeCompare(b.name);
    });

  return (
    <main className="min-h-screen space-y-4">
      {/* Team header */}
      <section className="space-y-2">
        <div>
          <h1 className="text-2xl font-bold mb-1">{team.name}</h1>
          <p className="text-gray-600">
            {team.age_group} · {team.season}
          </p>
          {!team.active && (
            <p className="text-sm text-red-600 mt-1">Team marked inactive</p>
          )}
        </div>

        {/* Add player */}
        <div className="border rounded bg-white p-3">
          <AddPlayerClient teamId={teamId} />
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 text-sm mb-3 flex-wrap">
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
            href={`/teams/${teamId}?view=attendance`}
            className={`px-3 py-1 rounded border ${
              activeTab === "attendance"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Attendance leaderboard
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
          <section className="space-y-2">
            {players.length === 0 ? (
              <p>No players assigned to this team.</p>
            ) : (
              <>
                <div className="text-xs text-gray-600">
                  Team sessions:{" "}
                  <span className="font-semibold">{totalTeamSessions}</span>
                  {totalTeamSessions === 0 && (
                    <span className="ml-2 text-gray-500">
                      (Plan/import sessions to see meaningful attendance.)
                    </span>
                  )}
                </div>

                <ul className="space-y-2">
                  {players.map((p) => {
                    const stats = attendanceByPlayer.get(p.id) ?? {
                      present: 0,
                      marked: 0,
                    };

                    return (
                      <li
                        key={p.id}
                        className="border rounded px-3 py-2 hover:bg-slate-50 bg-white"
                      >
                        {/* Row header: name + action */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {/* Make name clickable */}
                              <Link
                                href={`/players/${p.id}`}
                                className="font-medium hover:underline truncate"
                                title="Open player profile"
                              >
                                {p.name}
                              </Link>

                              {!p.active && (
                                <span className="text-[0.65rem] px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                                  Inactive
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-gray-600">
                              Status: {p.active ? "Active" : "Inactive"}
                            </div>
                          </div>

                          {/* Details button */}
                          <Link
                            href={`/players/${p.id}`}
                            className="shrink-0 px-3 py-1 rounded border text-xs bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                            aria-label={`Open details for ${p.name}`}
                          >
                            Details →
                          </Link>
                        </div>

                        {/* Attendance summary per player */}
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">Attendance:</span>{" "}
                          <span className="font-semibold">{stats.present}</span>{" "}
                          present ·{" "}
                          <span className="font-semibold">{stats.marked}</span>{" "}
                          marked ·{" "}
                          <span className="font-semibold">{totalTeamSessions}</span>{" "}
                          total sessions{" "}
                          {totalTeamSessions > 0 && (
                            <span className="ml-2 text-gray-500">
                              ({pct(stats.present, totalTeamSessions)} present)
                            </span>
                          )}
                        </div>

                        {/* Optional helper text to make it obvious */}
                        <div className="mt-1 text-[0.7rem] text-gray-500">
                          Tip: click <span className="font-medium">Details</span> to view development snapshot, teams, and recent sessions.
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        )}

        {/* Attendance leaderboard tab */}
        {activeTab === "attendance" && (
          <section className="space-y-2">
            {players.length === 0 ? (
              <p>No players assigned to this team.</p>
            ) : totalTeamSessions === 0 ? (
              <p>No sessions for this team yet — plan/import sessions first.</p>
            ) : (
              <>
                <div className="text-xs text-gray-600">
                  Ranked by <span className="font-semibold">present</span> count.
                  Total sessions for team:{" "}
                  <span className="font-semibold">{totalTeamSessions}</span>
                </div>
                <a
                  href={`/api/reports/team-attendance?team_id=${teamId}`}
                  className="text-xs px-3 py-1 rounded border border-slate-400 bg-white hover:bg-slate-100 inline-flex"
                >
                  Download leaderboard CSV
                </a>

                <ul className="space-y-2">
                  {leaderboard.map((row, idx) => (
                    <li
                      key={row.playerId}
                      className="border rounded px-3 py-2 bg-white flex justify-between items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-6">
                            #{idx + 1}
                          </span>
                          <Link
                            href={`/players/${row.playerId}`}
                            className="font-medium hover:underline"
                          >
                            {row.name}
                          </Link>
                          {!row.active && (
                            <span className="text-[0.65rem] px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Marked: {row.marked} · Total sessions: {row.total}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm">
                          <span className="font-semibold">{row.present}</span>{" "}
                          present
                        </div>
                        <div className="text-xs text-gray-500">
                          {pct(row.present, row.total)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
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
                        {formatDateDDMMYYYY(s.session_date)} · {s.session_type}
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
