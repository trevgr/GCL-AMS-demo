// app/players/[id]/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import PlayerRadarClient from "./PlayerRadarClient";

export const dynamic = "force-dynamic";

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

type CategoryKey =
  | "ball_control"
  | "passing"
  | "shooting"
  | "fitness"
  | "attitude"
  | "coachability"
  | "positioning"
  | "speed_agility";

const categoryMeta: { key: CategoryKey; label: string }[] = [
  { key: "ball_control", label: "Ball Control" },
  { key: "passing", label: "Passing" },
  { key: "shooting", label: "Shooting" },
  { key: "fitness", label: "Fitness" },
  { key: "attitude", label: "Attitude" },
  { key: "coachability", label: "Coachability" },
  { key: "positioning", label: "Positioning" },
  { key: "speed_agility", label: "Speed / Agility" },
];

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
function relativeAgeQuartile(
  iso: string
): { code: "Q1" | "Q2" | "Q3" | "Q4"; description: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const monthIndex = d.getMonth(); // 0–11

  if (monthIndex <= 2) return { code: "Q1", description: "oldest (Jan–Mar)" };
  if (monthIndex <= 5) return { code: "Q2", description: "early-mid (Apr–Jun)" };
  if (monthIndex <= 8) return { code: "Q3", description: "mid-younger (Jul–Sep)" };
  return { code: "Q4", description: "youngest (Oct–Dec)" };
}

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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

  const teams: TeamAssignment[] =
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

  // Load attendance (include session_date so we can sort)
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

  // ✅ FIX: Count overall + training using case-insensitive session_type
  let totalMarked = 0;
  let totalPresent = 0;

  let trainingSessions = 0;
  let trainingAttended = 0;

  for (const row of typedAttendance) {
    if (!row.session) continue;

    totalMarked += 1;
    if (row.status === "present") totalPresent += 1;

    const type = (row.session.session_type || "").toLowerCase().trim();
    if (type === "training" || type === "train") {
      trainingSessions += 1;
      if (row.status === "present") trainingAttended += 1;
    }
  }

  // ✅ FIX: actually show the most recent 5 sessions
  const recentSessions = typedAttendance
    .filter((r) => r.session)
    .sort((a, b) => {
      const ad = a.session?.session_date ?? "";
      const bd = b.session?.session_date ?? "";
      return bd.localeCompare(ad); // newest first
    })
    .slice(0, 5);

  /* ---------------------------------------------------------
     Development snapshot (across ALL feedback for this player)
     - ignore 0 = not assessed
     - strongest = highest avg
     - improve = two lowest avgs
  ----------------------------------------------------------*/
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("coach_feedback")
    .select(
      `
      player_id,
      ball_control,
      passing,
      shooting,
      fitness,
      attitude,
      coachability,
      positioning,
      speed_agility
    `
    )
    .eq("player_id", playerId);

  type FeedbackLite = Record<CategoryKey, number> & { player_id: number };

  const typedFeedback = (feedbackRows ?? []) as FeedbackLite[];

  const totals = new Map<CategoryKey, { sum: number; count: number }>();
  for (const c of categoryMeta) totals.set(c.key, { sum: 0, count: 0 });

  if (!feedbackError) {
    for (const row of typedFeedback) {
      for (const c of categoryMeta) {
        const v = row[c.key];
        if (typeof v === "number" && v > 0) {
          const t = totals.get(c.key)!;
          t.sum += v;
          t.count += 1;
        }
      }
    }
  } else {
    console.error("PlayerDetail: feedback error", feedbackError);
  }

  const summary = categoryMeta
    .map((c) => {
      const t = totals.get(c.key)!;
      const avg = t.count > 0 ? t.sum / t.count : null;
      return { key: c.key, label: c.label, avg, count: t.count };
    })
    .filter((x) => x.avg !== null) as {
    key: CategoryKey;
    label: string;
    avg: number;
    count: number;
  }[];

  const sortedByAvgAsc = [...summary].sort((a, b) => a.avg - b.avg);
  const sortedByAvgDesc = [...summary].sort((a, b) => b.avg - a.avg);

  const strongest = sortedByAvgDesc[0] ?? null;
  const improve = sortedByAvgAsc.slice(0, 2);

  const radarData = categoryMeta.map((m) => {
    const found = summary.find((s) => s.key === m.key);
    return {
      label: m.label,
      avg: found ? found.avg : 0,
      count: found ? found.count : 0,
    };
  });

  return (
    <main className="min-h-screen space-y-6">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-bold mb-2">{player.name}</h1>

        <div className="space-y-1 text-sm text-gray-700">
          <p>
            Birth month: <span className="font-semibold">{birthMonth}</span>
          </p>

          {raq && (
            <p className="flex items-center gap-2">
              Relative age quartile:{" "}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-900 text-white">
                {raq.code}
                <span className="font-normal text-[0.7rem]">{raq.description}</span>
              </span>
            </p>
          )}

          {approxYears != null && (
            <p>
              Approx age: <span className="font-semibold">{approxYears}</span>
            </p>
          )}

          <p>Status: {player.active ? "Active" : "Inactive"}</p>
        </div>
      </section>

      {/* Attendance summary */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Attendance summary</h2>

        {totalMarked === 0 ? (
          <p>No attendance records yet.</p>
        ) : (
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              Overall present:{" "}
              <span className="font-semibold">
                {totalPresent} / {totalMarked}
              </span>
            </p>

            {/* Keep training-specific too, but now it’s accurate */}
            <p className="text-xs text-gray-600">
              Training present:{" "}
              <span className="font-semibold">
                {trainingAttended} / {trainingSessions}
              </span>
            </p>
          </div>
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
                        {formatDateDDMMYYYY(s.session_date)} · {s.session_type}
                      </div>
                      {s.theme && (
                        <div className="text-xs text-gray-500">Theme: {s.theme}</div>
                      )}
                      <div className="text-xs mt-1">
                        Status:{" "}
                        <span className="font-semibold capitalize">{row.status}</span>
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

      {/* Development snapshot */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Development snapshot</h2>

        {feedbackError ? (
          <p className="text-sm text-gray-600">Failed to load development ratings.</p>
        ) : summary.length === 0 ? (
          <p className="text-sm text-gray-600">No ratings recorded yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Strongest */}
              <div className="border rounded px-3 py-2 bg-white">
                <div className="text-xs text-gray-500 mb-1">Strongest</div>
                {strongest ? (
                  <>
                    <div className="font-medium">{strongest.label}</div>
                    <div className="text-xs text-gray-600">
                      Avg: <span className="font-semibold">{strongest.avg.toFixed(1)}</span> / 5
                      <span className="text-gray-400"> · </span>
                      {strongest.count} samples
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-600">—</div>
                )}
              </div>

              {/* Areas to improve (top 2) */}
              <div className="border rounded px-3 py-2 bg-white sm:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Areas to improve</div>
                {improve.length > 0 ? (
                  <ul className="space-y-1">
                    {improve.map((x) => (
                      <li key={x.key} className="flex justify-between text-sm">
                        <span className="font-medium">{x.label}</span>
                        <span className="text-gray-700">
                          {x.avg.toFixed(1)} / 5{" "}
                          <span className="text-xs text-gray-500">({x.count})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-600">—</div>
                )}
              </div>
            </div>

            {/* Radar chart */}
            <PlayerRadarClient data={radarData} />
          </>
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
                    <li key={t.team_id} className="border rounded px-3 py-2 bg-white">
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
                    <li key={t.team_id} className="border rounded px-3 py-2 bg-white">
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

      {/* Back link */}
      <section className="text-xs">
        <Link href="/teams" className="text-blue-600 hover:underline">
          ← Back to teams
        </Link>
      </section>
    </main>
  );
}
