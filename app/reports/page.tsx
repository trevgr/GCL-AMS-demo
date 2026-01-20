// app/reports/page.tsx
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: {
    name: string;
    age_group: string;
    season: string;
  } | null;
};

type AttendanceRow = {
  session_id: number;
  status: "present" | "absent";
};

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
  active: boolean;
};

type FeedbackJoined = {
  player_id: number;
  ball_control: number;
  passing: number;
  shooting: number;
  fitness: number;
  attitude: number;
  coachability: number;
  positioning: number;
  speed_agility: number;
  comments: string | null;
  player: {
    id: number;
    name: string;
    dob: string;
    active: boolean;
  } | null;
  session: {
    id: number;
    session_date: string;
    team_id: number;
    team: {
      id: number;
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

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/* -----------------------------------------------------------
   Category-level labels for AVERAGES (development tab)
------------------------------------------------------------*/
function ratingLabel(value: number) {
  if (value === 0) return "Not assessed";
  if (value < 2) return "Needs significant support"; // 0–1.9
  if (value < 3) return "Needs focused work"; // 2.0–2.9
  if (value < 3.75) return "Developing well"; // 3.0–3.74
  if (value < 4.5) return "Strong area"; // 3.75–4.49
  return "Key strength"; // 4.5–5.0
}

function ratingBadgeClass(value: number) {
  if (value === 0) return "bg-gray-200 text-gray-800";
  if (value < 2) return "bg-red-600 text-white"; // big support needed
  if (value < 3) return "bg-orange-500 text-white"; // focused work needed
  if (value < 3.75) return "bg-amber-400 text-slate-900"; // developing well
  if (value < 4.5) return "bg-green-500 text-white"; // strong area
  return "bg-emerald-700 text-white"; // key strength
}

export default async function ReportsPage(props: {
  searchParams: Promise<{ view?: string; team_id?: string }>;
}) {
  const sp = await props.searchParams;
  const { view, team_id } = sp;

  const activeTab: "sessions" | "development" =
    view === "development" ? "development" : "sessions";

  // ---- Load teams (active only) ----
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, age_group, season, active")
    .eq("active", true)
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  const typedTeams = (teams ?? []) as TeamRow[];

  let selectedTeamId: number | null = null;
  if (typedTeams.length > 0) {
    if (team_id) {
      const parsed = Number(team_id);
      selectedTeamId = Number.isNaN(parsed) ? typedTeams[0].id : parsed;
    } else {
      selectedTeamId = typedTeams[0].id;
    }
  }

  const selectedTeam = typedTeams.find((t) => t.id === selectedTeamId) ?? null;

  // Dev CSV URL (aggregated per team in /api/reports/development)
  const devCsvUrl =
    selectedTeamId != null
      ? `/api/reports/development?team_id=${selectedTeamId}`
      : "/api/reports/development";

  // ---- Sessions (attendance overview) ----
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      `
      id,
      team_id,
      session_date,
      session_type,
      theme,
      team:teams (
        name,
        age_group,
        season
      )
    `
    )
    .order("session_date", { ascending: false });

  const typedSessions = (sessions ?? []) as SessionRow[];

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("session_id, status");

  const typedAttendance = (attendance ?? []) as AttendanceRow[];

  const counts = new Map<number, { present: number; totalMarked: number }>();
  for (const row of typedAttendance) {
    const entry =
      counts.get(row.session_id) ?? { present: 0, totalMarked: 0 };
    entry.totalMarked += 1;
    if (row.status === "present") entry.present += 1;
    counts.set(row.session_id, entry);
  }

  // ---- Development (category summary only) ----
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
      speed_agility,
      comments,
      player:players ( id, name, dob, active ),
      session:sessions (
        id,
        session_date,
        team_id,
        team:teams ( id, name, age_group, season )
      )
    `
    );

  const typedFeedback = (feedbackRows ?? []) as FeedbackJoined[];

  const filteredFeedback =
    selectedTeamId == null
      ? []
      : typedFeedback.filter((row) => row.session?.team_id === selectedTeamId);

  const categoryTotals = new Map<CategoryKey, { sum: number; count: number }>();
  for (const meta of categoryMeta) {
    categoryTotals.set(meta.key, { sum: 0, count: 0 });
  }

  for (const row of filteredFeedback) {
    for (const meta of categoryMeta) {
      const value = row[meta.key];
      if (typeof value === "number" && value > 0) {
        const totals = categoryTotals.get(meta.key)!;
        totals.sum += value;
        totals.count += 1;
      }
    }
  }

  const categorySummary = categoryMeta
    .map((meta) => {
      const totals = categoryTotals.get(meta.key)!;
      const avg = totals.count > 0 ? totals.sum / totals.count : null;
      return { key: meta.key, label: meta.label, avg, count: totals.count };
    })
    .filter((c) => c.avg !== null)
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Reports</h1>
        <p className="text-sm text-gray-600">
          Switch between session attendance and a team-wide overview of
          development ratings by category.
        </p>
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 text-sm mb-3">
          <Link
            href="/reports?view=sessions"
            className={`px-3 py-1 rounded border ${
              activeTab === "sessions"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Session attendance
          </Link>
          <Link
            href="/reports?view=development"
            className={`px-3 py-1 rounded border ${
              activeTab === "development"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Development dashboard
          </Link>
        </div>

        {/* Attendance tab */}
        {activeTab === "sessions" && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold">All sessions overview</h2>
              <a
                href="/api/reports/attendance"
                className="text-xs px-3 py-1 rounded border border-slate-400 bg-white hover:bg-slate-100"
              >
                Download sessions CSV
              </a>
            </div>

            {sessionsError ? (
              <p>Failed to load sessions.</p>
            ) : typedSessions.length === 0 ? (
              <p>No sessions recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {typedSessions.map((s) => {
                  const count = counts.get(s.id) ?? {
                    present: 0,
                    totalMarked: 0,
                  };

                  return (
                    <li
                      key={s.id}
                      className="border rounded px-3 py-2 bg-white space-y-1"
                    >
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium">
                            {formatDateDDMMYYYY(s.session_date)} ·{" "}
                            {s.session_type}
                          </div>
                          <div className="text-sm text-gray-600">
                            {s.team
                              ? `${s.team.name} · ${s.team.age_group} · ${s.team.season}`
                              : "Unknown team"}
                          </div>
                          {s.theme && (
                            <div className="text-xs text-gray-500">
                              Theme: {s.theme}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div>
                            <span className="font-semibold">
                              {count.present}
                            </span>{" "}
                            present
                          </div>
                          <div className="text-xs text-gray-500">
                            {count.totalMarked} marked
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2 text-xs">
                        <Link
                          href={`/sessions/${s.id}`}
                          className="px-3 py-1 rounded border border-slate-400 hover:bg-slate-100"
                        >
                          Open session details
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Development tab */}
        {activeTab === "development" && (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  Category overview by team
                </h2>
                <p className="text-xs text-gray-600">
                  This view shows average ratings for the selected team across
                  all its sessions (ignoring{" "}
                  <span className="font-mono">0</span> = not assessed). The CSV
                  export is aggregated by session for that team (one row per
                  session).
                </p>
              </div>
              <a
                href={devCsvUrl}
                className="text-xs px-3 py-1 rounded border border-blue-500 text-blue-700 bg-white hover:bg-blue-50"
              >
                Download development CSV
              </a>
            </div>

            {/* Team filter */}
            {teamsError ? (
              <p>Failed to load teams.</p>
            ) : typedTeams.length === 0 ? (
              <p>No active teams available.</p>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs mb-2">
                {typedTeams.map((t) => {
                  const isActive = t.id === selectedTeamId;
                  const params = new URLSearchParams();
                  params.set("view", "development");
                  params.set("team_id", String(t.id));
                  const href = `/reports?${params.toString()}`;
                  return (
                    <Link
                      key={t.id}
                      href={href}
                      className={`px-3 py-1 rounded-full border ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {t.name} · {t.age_group}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Category list */}
            {feedbackError ? (
              <p>Failed to load development data.</p>
            ) : selectedTeamId == null ? (
              <p>No team selected.</p>
            ) : categorySummary.length === 0 ? (
              <p>
                No development ratings recorded yet for{" "}
                {selectedTeam
                  ? `${selectedTeam.name} (${selectedTeam.age_group})`
                  : "this team"}
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {categorySummary.map((c) => (
                  <li
                    key={c.key}
                    className="border rounded px-3 py-2 bg-white flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{c.label}</div>
                      <div className="text-xs text-gray-500">
                        Samples: {c.count}
                      </div>
                    </div>

                    <div className="text-right text-sm flex flex-col items-end gap-1">
                      <div>
                        <span className="font-semibold">
                          {c.avg?.toFixed(1)}
                        </span>{" "}
                        / 5
                      </div>
                      {c.avg != null && (
                        <span
                          className={`px-2 py-0.5 rounded text-[0.65rem] ${ratingBadgeClass(
                            c.avg
                          )}`}
                        >
                          {ratingLabel(c.avg)}
                        </span>
                      )}
                    </div>
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
