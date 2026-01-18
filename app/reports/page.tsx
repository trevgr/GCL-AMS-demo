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
};

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function ReportsPage(props: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await props.searchParams;
  const activeTab: "sessions" | "development" =
    view === "development" ? "development" : "sessions";

  // ---- Sessions & attendance summary ----
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

  const counts = new Map<
    number,
    { present: number; totalMarked: number }
  >();
  for (const row of typedAttendance) {
    const entry =
      counts.get(row.session_id) ?? { present: 0, totalMarked: 0 };
    entry.totalMarked += 1;
    if (row.status === "present") {
      entry.present += 1;
    }
    counts.set(row.session_id, entry);
  }

  // ---- Development summary ----
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
      player:players (
        id,
        name,
        dob,
        active
      )
    `
    );

  const typedFeedback = (feedbackRows ?? []) as FeedbackJoined[];

  type DevSummary = {
    player_id: number;
    name: string;
    dob: string;
    active: boolean;
    avgBallControl: number;
    avgAttitude: number;
    sampleCount: number;
  };

  const devByPlayer = new Map<number, DevSummary>();

  for (const row of typedFeedback) {
    if (!row.player) continue;

    const hasBall = row.ball_control > 0;
    const hasAtt = row.attitude > 0;

    // If there are no meaningful scores on this row, skip it
    if (!hasBall && !hasAtt) continue;

    const existing = devByPlayer.get(row.player_id);
    if (!existing) {
      devByPlayer.set(row.player_id, {
        player_id: row.player_id,
        name: row.player.name,
        dob: row.player.dob,
        active: row.player.active,
        avgBallControl: hasBall ? row.ball_control : 0,
        avgAttitude: hasAtt ? row.attitude : 0,
        sampleCount: 1,
      });
    } else {
      const n = existing.sampleCount;

      const nextBall = hasBall
        ? (existing.avgBallControl * n + row.ball_control) / (n + 1)
        : existing.avgBallControl;

      const nextAtt = hasAtt
        ? (existing.avgAttitude * n + row.attitude) / (n + 1)
        : existing.avgAttitude;

      devByPlayer.set(row.player_id, {
        ...existing,
        avgBallControl: nextBall,
        avgAttitude: nextAtt,
        sampleCount: n + 1,
      });
    }
  }

  // Filter players needing focus: low ball control or attitude
  const focusPlayers = Array.from(devByPlayer.values())
    .filter(
      (p) => p.avgBallControl < 3 || p.avgAttitude < 3
    )
    .sort((a, b) => {
      const aScore = Math.min(a.avgBallControl, a.avgAttitude);
      const bScore = Math.min(b.avgBallControl, b.avgAttitude);
      return aScore - bScore;
    });

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Reports</h1>
        <p className="text-sm text-gray-600">
          Switch between attendance overview and player development focus.
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
              <h2 className="text-sm font-semibold">
                All sessions overview
              </h2>
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
                          Open Session Details
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
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold">
                Players needing development focus
              </h2>
              <a
                href="/api/reports/development"
                className="text-xs px-3 py-1 rounded border border-blue-500 text-blue-700 bg-white hover:bg-blue-50"
              >
                Download development CSV
              </a>
            </div>

            {feedbackError ? (
              <p>Failed to load development data.</p>
            ) : focusPlayers.length === 0 ? (
              <p>
                No players currently flagged for low Ball Control or
                Attitude.
              </p>
            ) : (
              <ul className="space-y-2">
                {focusPlayers.map((p) => (
                  <li
                    key={p.player_id}
                    className="border rounded px-3 py-2 bg-white"
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-gray-600">
                          DOB: {formatDateDDMMYYYY(p.dob)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Samples: {p.sampleCount}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>
                          Ball Control:{" "}
                          <span className="font-semibold">
                            {p.avgBallControl.toFixed(1)}
                          </span>
                        </div>
                        <div>
                          Attitude:{" "}
                          <span className="font-semibold">
                            {p.avgAttitude.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Click player via{" "}
                      <span className="font-semibold">Teams</span> to
                      view context and session history.
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
