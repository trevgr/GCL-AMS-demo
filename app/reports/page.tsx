// app/reports/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { getCoachAccessForUser } from "../../lib/coachAccess";

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

function monthYearLabel(year: number, monthIndex: number) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function weekdayShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short" }); // Mon, Tue, etc.
}

/* -----------------------------------------------------------
   Category-level labels for AVERAGES
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

/* -----------------------------------------------------------
   Relative Age Quartile helpers
   Simple model: Jan–Mar = Q1, Apr–Jun = Q2, Jul–Sep = Q3, Oct–Dec = Q4
------------------------------------------------------------*/
type RAQ = "Q1" | "Q2" | "Q3" | "Q4";

function getRelativeAgeQuartile(dobIso: string | null | undefined): RAQ | null {
  if (!dobIso) return null;
  const d = new Date(dobIso);
  if (Number.isNaN(d.getTime())) return null;
  const monthIndex = d.getMonth(); // 0–11
  if (monthIndex <= 2) return "Q1";
  if (monthIndex <= 5) return "Q2";
  if (monthIndex <= 8) return "Q3";
  return "Q4";
}

export default async function ReportsPage(props: {
  searchParams: Promise<{ view?: string; team_id?: string; mode?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const sp = await props.searchParams;
  const { view, team_id, mode } = sp;

  const activeTab: "sessions" | "development" =
    view === "development" ? "development" : "sessions";

  const sessionsMode: "recent" | "history" =
    mode === "history" ? "history" : "recent";

  /* ---------------------------------------------------------
     1) Figure out which teams this user can see
        Reuse the same logic as Teams page via getCoachAccessForUser
  ----------------------------------------------------------*/
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("ReportsPage: error getting auth user:", userError);
  }

  let allowedTeamIds: number[] = [];

  if (user) {
    const access = await getCoachAccessForUser(supabase as any, user.id);

    if (!access) {
      console.warn(
        "ReportsPage: no coach access record found for user",
        user.id
      );
    } else {
      allowedTeamIds = access.teamIds;
    }
  } else {
    console.warn(
      "ReportsPage: no Supabase user, so no teams visible for reports."
    );
  }

  console.log("ReportsPage auth + access", {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    allowedTeamIds,
  });

  /* ---------------------------------------------------------
     2) Load teams, limited by allowedTeamIds
  ----------------------------------------------------------*/
  let typedTeams: TeamRow[] = [];
  let teamsError: any = null;

  if (allowedTeamIds.length === 0) {
    // No visible teams
    typedTeams = [];
  } else {
    let teamsQuery = supabase
      .from("teams")
      .select("id, name, age_group, season, active")
      .eq("active", true)
      .in("id", allowedTeamIds)
      .order("age_group", { ascending: true })
      .order("name", { ascending: true });

    const { data: teams, error } = await teamsQuery;
    typedTeams = (teams ?? []) as TeamRow[];
    teamsError = error;
  }

  // Shared team_id parsing from query string
  const parsedTeamId = team_id ? Number(team_id) : NaN;

  // For Sessions tab: optional filter (null => all allowed teams)
  const sessionTeamFilterId = Number.isNaN(parsedTeamId)
    ? null
    : parsedTeamId;

  // For Development tab: must always be a team the coach can see
  let devSelectedTeamId: number | null = null;
  if (typedTeams.length > 0) {
    const candidate = !Number.isNaN(parsedTeamId)
      ? parsedTeamId
      : typedTeams[0].id;

    devSelectedTeamId = typedTeams.some((t) => t.id === candidate)
      ? candidate
      : typedTeams[0].id;
  }

  const selectedTeam =
    typedTeams.find((t) => t.id === devSelectedTeamId) ?? null;

  /* ---------------------------------------------------------
     3) Sessions & attendance summary
        Sessions are limited by allowedTeamIds
  ----------------------------------------------------------*/
  let sessionsError: any = null;
  let typedSessions: SessionRow[] = [];

  if (allowedTeamIds.length === 0) {
    typedSessions = [];
  } else {
    let sessionsQuery = supabase
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
      .in("team_id", allowedTeamIds)
      .order("session_date", { ascending: false });

    const { data: sessions, error } = await sessionsQuery;
    sessionsError = error;
    typedSessions = (sessions ?? []) as SessionRow[];
  }

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("session_id, status");

  if (attendanceError) {
    console.error("ReportsPage: attendance error", attendanceError);
  }

  const typedAttendance = (attendance ?? []) as AttendanceRow[];

  const counts = new Map<number, { present: number; totalMarked: number }>();
  for (const row of typedAttendance) {
    const entry =
      counts.get(row.session_id) ?? { present: 0, totalMarked: 0 };
    entry.totalMarked += 1;
    if (row.status === "present") entry.present += 1;
    counts.set(row.session_id, entry);
  }

  // Filter sessions by selected team (for Sessions tab)
  const sessionsForFilter =
    sessionTeamFilterId == null
      ? typedSessions
      : typedSessions.filter((s) => s.team_id === sessionTeamFilterId);

  // Recent = most recent 4 sessions (after filter)
  const recentSessions = sessionsForFilter.slice(0, 4);

  // History = past sessions grouped by month (after filter)
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const historySessions = sessionsForFilter.filter(
    (s) => s.session_date < todayIso
  );

  type MonthKey = string; // "YYYY-MM"
  const historyByMonth = new Map<
    MonthKey,
    { label: string; items: SessionRow[] }
  >();

  for (const s of historySessions) {
    const d = new Date(s.session_date);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const label = monthYearLabel(year, monthIndex);

    if (!historyByMonth.has(key)) {
      historyByMonth.set(key, { label, items: [] });
    }
    historyByMonth.get(key)!.items.push(s);
  }

  const sortedHistoryMonths = Array.from(historyByMonth.entries()).sort(
    ([aKey], [bKey]) => (aKey < bKey ? 1 : -1) // newest month first
  );

  /* ---------------------------------------------------------
     4) Development (category summary per selected team)
        We only aggregate for devSelectedTeamId, which is clamped
        to teams the user is allowed to see.
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

  if (feedbackError) {
    console.error("ReportsPage: feedback error", feedbackError);
  }

  const typedFeedback = (feedbackRows ?? []) as FeedbackJoined[];

  const filteredFeedback =
    devSelectedTeamId == null
      ? []
      : typedFeedback.filter(
          (row) => row.session?.team_id === devSelectedTeamId
        );

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

  // ---- RAQ summary per team (based on team_players + players.dob) ----
  type TeamPlayerRow = {
    player: {
      id: number;
      name: string;
      dob: string;
      active: boolean;
    } | null;
  };

  let raqSummary:
    | {
        total: number;
        Q1: number;
        Q2: number;
        Q3: number;
        Q4: number;
      }
    | null = null;

  if (devSelectedTeamId != null) {
    const { data: teamPlayers, error: teamPlayersError } = await supabase
      .from("team_players")
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
      .eq("team_id", devSelectedTeamId);

    if (teamPlayersError) {
      console.error("ReportsPage: RAQ team_players error", teamPlayersError);
    } else {
      const typedTeamPlayers = (teamPlayers ?? []) as TeamPlayerRow[];
      let total = 0;
      let Q1 = 0;
      let Q2 = 0;
      let Q3 = 0;
      let Q4 = 0;

      for (const row of typedTeamPlayers) {
        const p = row.player;
        if (!p || !p.active) continue;
        const raq = getRelativeAgeQuartile(p.dob);
        if (!raq) continue;
        total += 1;
        if (raq === "Q1") Q1 += 1;
        else if (raq === "Q2") Q2 += 1;
        else if (raq === "Q3") Q3 += 1;
        else if (raq === "Q4") Q4 += 1;
      }

      if (total > 0) {
        raqSummary = { total, Q1, Q2, Q3, Q4 };
      }
    }
  }

  const raqPercent = (count: number, total: number) =>
    total === 0 ? "0%" : `${Math.round((count / total) * 100)}%`;

  /* ---------------------------------------------------------
     5) Render
  ----------------------------------------------------------*/
  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Reports</h1>
        <p className="text-sm text-gray-600">
          Switch between session attendance and a team-wide overview of
          development ratings by category.
        </p>
      </section>

      <section>
        {/* Main tabs: Sessions vs Development */}
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

        {/* ----------------------- SESSION TAB ----------------------- */}
        {activeTab === "sessions" && (
          <section className="space-y-4">
            {/* Header row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Sessions overview</h2>
                <p className="text-xs text-gray-600">
                  Default view shows the last 4 sessions. Use History to browse
                  older sessions grouped by month.
                </p>
              </div>
              <a
                href="/api/reports/attendance"
                className="text-xs px-3 py-1 rounded border border-slate-400 bg-white hover:bg-slate-100"
              >
                Download sessions CSV
              </a>
            </div>

            {/* Team filter for sessions */}
            {!teamsError && typedTeams.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs mb-1">
                {/* All teams pill (within allowed set) */}
                {(() => {
                  const params = new URLSearchParams();
                  params.set("view", "sessions");
                  params.set("mode", sessionsMode);
                  const href = `/reports?${params.toString()}`;
                  const isActive = sessionTeamFilterId == null;

                  return (
                    <Link
                      href={href}
                      className={`px-3 py-1 rounded-full border ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      All teams
                    </Link>
                  );
                })()}

                {typedTeams.map((t) => {
                  const params = new URLSearchParams();
                  params.set("view", "sessions");
                  params.set("mode", sessionsMode);
                  params.set("team_id", String(t.id));
                  const href = `/reports?${params.toString()}`;
                  const isActive = sessionTeamFilterId === t.id;

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

            {/* Sub-tabs: Recent vs History */}
            <div className="flex gap-2 text-xs mb-2">
              {(() => {
                const params = new URLSearchParams();
                params.set("view", "sessions");
                params.set("mode", "recent");
                if (sessionTeamFilterId != null) {
                  params.set("team_id", String(sessionTeamFilterId));
                }
                const href = `/reports?${params.toString()}`;
                return (
                  <Link
                    href={href}
                    className={`px-3 py-1 rounded border ${
                      sessionsMode === "recent"
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-800 border-slate-300"
                    }`}
                  >
                    Recent (last 4)
                  </Link>
                );
              })()}
              {(() => {
                const params = new URLSearchParams();
                params.set("view", "sessions");
                params.set("mode", "history");
                if (sessionTeamFilterId != null) {
                  params.set("team_id", String(sessionTeamFilterId));
                }
                const href = `/reports?${params.toString()}`;
                return (
                  <Link
                    href={href}
                    className={`px-3 py-1 rounded border ${
                      sessionsMode === "history"
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-800 border-slate-300"
                    }`}
                  >
                    History (by month)
                  </Link>
                );
              })()}
            </div>

            {/* Attendance data */}
            {sessionsError ? (
              <p>Failed to load sessions.</p>
            ) : sessionsMode === "recent" ? (
              // RECENT VIEW
              recentSessions.length === 0 ? (
                <p>No recent sessions found.</p>
              ) : (
                <ul className="space-y-2">
                  {recentSessions.map((s) => {
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
                              {weekdayShort(s.session_date)}{" "}
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
              )
            ) : (
              // HISTORY VIEW
              (historySessions.length === 0 && (
                <p>No past sessions recorded yet.</p>
              )) || (
                <div className="space-y-4">
                  {sortedHistoryMonths.map(([key, group]) => (
                    <section key={key} className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700">
                        {group.label}
                      </h3>
                      <ul className="space-y-2">
                        {group.items.map((s) => {
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
                                    {weekdayShort(s.session_date)}{" "}
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
                    </section>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {/* -------------------- DEVELOPMENT TAB --------------------- */}
        {activeTab === "development" && (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  Category overview by team
                </h2>
                <p className="text-xs text-gray-600">
                  Averages ignore <span className="font-mono">0</span> scores.
                  Individual player and coach samples remain available in the
                  CSV exports.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <a
                  href="/api/reports/development"
                  className="text-xs px-3 py-1 rounded border border-blue-500 text-blue-700 bg-white hover:bg-blue-50"
                >
                  Download development CSV
                </a>
                <a
                  href="/api/reports/development-samples"
                  className="text-xs px-3 py-1 rounded border border-emerald-500 text-emerald-700 bg-white hover:bg-emerald-50"
                >
                  Download all samples CSV
                </a>
              </div>
            </div>

            {/* Team filter for development */}
            {!teamsError && typedTeams.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs mb-2">
                {typedTeams.map((t) => {
                  const params = new URLSearchParams();
                  params.set("view", "development");
                  params.set("team_id", String(t.id));
                  const href = `/reports?${params.toString()}`;
                  const isActive = devSelectedTeamId === t.id;

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

            {/* RAQ summary card */}
            {devSelectedTeamId != null && raqSummary && (
              <div className="border rounded px-3 py-2 bg-white text-xs mb-2">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-semibold">Relative Age Quartiles</div>
                  {selectedTeam && (
                    <div className="text-[0.7rem] text-gray-500">
                      {selectedTeam.name} · {selectedTeam.season}
                    </div>
                  )}
                </div>
                <p className="text-[0.7rem] text-gray-600 mb-1">
                  Based on month of birth for active players in this team.
                </p>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div className="border rounded px-2 py-1 text-center">
                    <div className="text-[0.65rem] font-medium">Q1</div>
                    <div className="text-[0.7rem]">
                      {raqSummary.Q1} (
                      {raqPercent(raqSummary.Q1, raqSummary.total)})
                    </div>
                  </div>
                  <div className="border rounded px-2 py-1 text-center">
                    <div className="text-[0.65rem] font-medium">Q2</div>
                    <div className="text-[0.7rem]">
                      {raqSummary.Q2} (
                      {raqPercent(raqSummary.Q2, raqSummary.total)})
                    </div>
                  </div>
                  <div className="border rounded px-2 py-1 text-center">
                    <div className="text-[0.65rem] font-medium">Q3</div>
                    <div className="text-[0.7rem]">
                      {raqSummary.Q3} (
                      {raqPercent(raqSummary.Q3, raqSummary.total)})
                    </div>
                  </div>
                  <div className="border rounded px-2 py-1 text-center">
                    <div className="text-[0.65rem] font-medium">Q4</div>
                    <div className="text-[0.7rem]">
                      {raqSummary.Q4} (
                      {raqPercent(raqSummary.Q4, raqSummary.total)})
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category list */}
            {feedbackError ? (
              <p>Failed to load development data.</p>
            ) : devSelectedTeamId == null ? (
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
                        Samples (non-zero ratings): {c.count}
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
