// app/players/[id]/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type TeamAssignment = {
  team_id: number;
  team_name: string;
  age_group: string;
  season: string;
  team_active: boolean;
  link_active: boolean;
};

type AttendanceRow = {
  status: "present" | "absent";
  session: {
    id: number;
    session_date: string;
    session_type: string;
    theme: string | null;
    team?: {
      name: string;
      age_group: string;
      season: string;
    } | null;
  } | null;
};

// Convert DOB → "Jan-2015"
function formatMonthYear(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${month}-${d.getFullYear()}`;
}

// Approx years old (still useful for rough age)
function yearsFromDOB(iso: string): number | null {
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();

  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) years -= 1;

  return years;
}

// Relative age quartile (Q1–Q4) assuming 1 Jan cut-off
function relativeAgeQuartile(iso: string):
  | { code: "Q1" | "Q2" | "Q3" | "Q4"; description: string }
  | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const monthIndex = d.getMonth(); // 0–11

  if (monthIndex <= 2) {
    // Jan, Feb, Mar
    return { code: "Q1", description: "oldest (Jan–Mar)" };
  } else if (monthIndex <= 5) {
    // Apr, May, Jun
    return { code: "Q2", description: "early-mid (Apr–Jun)" };
  } else if (monthIndex <= 8) {
    // Jul, Aug, Sep
    return { code: "Q3", description: "mid-younger (Jul–Sep)" };
  } else {
    // Oct, Nov, Dec
    return { code: "Q4", description: "youngest (Oct–Dec)" };
  }
}

export default async function PlayerDetail(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const playerId = Number(id);

  if (Number.isNaN(playerId)) {
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid player ID</h1>
      </main>
    );
  }

  // 🔑 Server-side Supabase client
  const supabase = await createServerSupabaseClient();

  // Load player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single<Player>();

  if (playerError || !player) {
    console.error("Player error:", playerError);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Player not found</h1>
      </main>
    );
  }

  const birthMonth = formatMonthYear(player.dob);
  const approxYears = yearsFromDOB(player.dob);
  const raq = relativeAgeQuartile(player.dob);

  // Load team assignments via team_players
  const { data: teamLinks } = await supabase
    .from("team_players")
    .select(
      `
      active,
      team:teams (
        id,
        name,
        age_group,
        season,
        active
      )
    `
    )
    .eq("player_id", playerId);

  let teams: TeamAssignment[] =
    teamLinks
      ?.map((row: any) => {
        if (!row.team) return null;
        return {
          team_id: row.team.id,
          team_name: row.team.name,
          age_group: row.team.age_group,
          season: row.team.season,
          team_active: row.team.active,
          link_active: row.active ?? true,
        };
      })
      .filter(Boolean) ?? [];

  // Current team logic
  const isCurrent = (t: TeamAssignment) => t.team_active && t.link_active;

  const currentTeams = teams.filter(isCurrent);
  const previousTeams = teams.filter((t) => !isCurrent(t));

  currentTeams.sort((a, b) => a.team_name.localeCompare(b.team_name));
  previousTeams.sort((a, b) => a.team_name.localeCompare(b.team_name));

  // Load attendance
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select(
      `
      status,
      session:sessions (
        id,
        session_date,
        session_type,
        theme,
        team:teams (
          name,
          age_group,
          season
        )
      )
    `
    )
    .eq("player_id", playerId);

  const typedAttendance = (attendanceRows ?? []) as AttendanceRow[];

  let trainingSessions = 0;
  let trainingAttended = 0;

  for (const row of typedAttendance) {
    if (row.session?.session_type === "training") {
      trainingSessions++;
      if (row.status === "present") trainingAttended++;
    }
  }

  const recentSessions = typedAttendance
    .filter((r) => r.session)
    .slice(0, 5);

  return (
    <main className="min-h-screen space-y-6">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-bold mb-2">{player.name}</h1>

        <div className="space-y-1 text-sm text-gray-700">
          <p>
            Birth month:{" "}
            <span className="font-semibold">{birthMonth}</span>
          </p>

          {raq && (
            <p className="flex items-center gap-2">
              Relative age quartile:{" "}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-900 text-white">
                {raq.code}
                <span className="font-normal text-[0.7rem]">
                  {raq.description}
                </span>
              </span>
            </p>
          )}

          {approxYears != null && (
            <p>
              Approx age:{" "}
              <span className="font-semibold">{approxYears}</span>
            </p>
          )}

          <p>
            Status: {player.active ? "Active" : "Inactive"}
          </p>
        </div>
      </section>

      {/* Attendance summary */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Attendance summary</h2>

        {trainingSessions === 0 ? (
          <p>No training sessions recorded yet.</p>
        ) : (
          <p>
            Training attended:{" "}
            <span className="font-semibold">
              {trainingAttended} / {trainingSessions}
            </span>
          </p>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div className="mt-3">
            <h3 className="text-sm font-semibold mb-1">Recent sessions</h3>
            <ul className="space-y-1 text-sm">
              {recentSessions.map((row, idx) => {
                const s = row.session!;
                return (
                  <li
                    key={`${s.id}-${idx}`}
                    className="border rounded px-2 py-1 bg-white flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">
                        {new Date(s.session_date).toLocaleDateString("en-GB")} ·{" "}
                        {s.session_type}
                      </div>
                      {s.theme && (
                        <div className="text-xs text-gray-500">
                          Theme: {s.theme}
                        </div>
                      )}
                      <div className="text-xs mt-1">
                        Status:{" "}
                        <span className="font-semibold capitalize">
                          {row.status}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/sessions/${s.id}?view=attendance`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Team assignments */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Teams</h2>

        {currentTeams.length === 0 && previousTeams.length === 0 ? (
          <p>No team assignments.</p>
        ) : (
          <>
            {currentTeams.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Current squad(s)</h3>
                <ul className="space-y-1">
                  {currentTeams.map((t) => (
                    <li
                      key={t.team_id}
                      className="border rounded px-3 py-2 bg-white"
                    >
                      <Link href={`/teams/${t.team_id}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{t.team_name}</div>
                            <div className="text-sm text-gray-600">
                              {t.age_group} · {t.season}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-green-600 text-white">
                            Current
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previousTeams.length > 0 && (
              <>
                {currentTeams.length > 0 && (
                  <div className="border-t pt-2 mt-2 text-xs text-gray-500">
                    Previous squads
                  </div>
                )}
                <ul className="space-y-1">
                  {previousTeams.map((t) => (
                    <li
                      key={t.team_id}
                      className="border rounded px-3 py-2 bg-white"
                    >
                      <Link href={`/teams/${t.team_id}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{t.team_name}</div>
                            <div className="text-sm text-gray-600">
                              {t.age_group} · {t.season}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-gray-300 text-gray-800">
                            Previous
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
