"use client";

import { useMemo } from "react";

type CategoryKey =
  | "ball_control"
  | "passing"
  | "shooting"
  | "fitness"
  | "attitude"
  | "coachability"
  | "positioning"
  | "speed_agility";

const CATEGORY_ORDER: CategoryKey[] = [
  "ball_control",
  "passing",
  "shooting",
  "fitness",
  "attitude",
  "coachability",
  "positioning",
  "speed_agility",
];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  ball_control: "Ball Control",
  passing: "Passing",
  shooting: "Shooting",
  fitness: "Fitness",
  attitude: "Attitude",
  coachability: "Coachability",
  positioning: "Positioning",
  speed_agility: "Speed / Agility",
};

type SessionSummary = {
  session_id: number;
  session_date: string;
  theme: string | null;
  team_name: string;

  present_count: number;

  overall: number | null;
  category_avgs: Record<CategoryKey, number | null>;
  category_rated_counts: Record<CategoryKey, number>; // kept for header totals, not shown in table
};

type SessionSummaryResponse = {
  meta: {
    team_id: number;
    team_name: string;
    theme: string;
    session_count: number;
    first_session_date: string | null;
    last_session_date: string | null;
  };
  sessions: SessionSummary[];
};

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2).replace(/\.00$/, "");
}

function deltaFirstLast(values: Array<number | null>) {
  const firstIdx = values.findIndex((v) => typeof v === "number");
  const lastIdx = (() => {
    for (let i = values.length - 1; i >= 0; i--) {
      if (typeof values[i] === "number") return i;
    }
    return -1;
  })();

  if (firstIdx === -1 || lastIdx === -1) return null;
  const first = values[firstIdx] as number;
  const last = values[lastIdx] as number;
  return Math.round((last - first) * 100) / 100;
}

function arrow(delta: number | null) {
  if (delta === null) return "—";
  if (delta > 0.1) return "⬆️";
  if (delta < -0.1) return "⬇️";
  return "➡️";
}

function sumPresentPlayers(sessions: SessionSummary[]) {
  return sessions.reduce((sum, s) => sum + (s.present_count ?? 0), 0);
}

function sumRatedPlayersForAnyCategoryApprox(sessions: SessionSummary[]) {
  // Approx “players with any rating” = max(category_rated_counts) per session
  // (safe, simple, and matches the earlier UI badge concept)
  return sessions.reduce((sum, s) => {
    const maxRated = CATEGORY_ORDER.reduce((m, cat) => {
      const v = s.category_rated_counts?.[cat] ?? 0;
      return Math.max(m, v);
    }, 0);
    return sum + maxRated;
  }, 0);
}

export default function PlayerTrendsClient({
  payload,
  teamId,
  teamName,
  theme,
}: {
  payload: SessionSummaryResponse;
  teamId: number;
  teamName: string;
  theme: string;
}) {
  const sessions = payload.sessions ?? [];

  const firstDate = payload.meta.first_session_date ?? null;
  const lastDate = payload.meta.last_session_date ?? null;

  const sessionCount = sessions.length;

  const headerLine = useMemo(() => {
    const range = firstDate && lastDate ? `${firstDate} → ${lastDate}` : "—";
    return `Theme: ${theme} • ${range} • Team: ${teamName}`;
  }, [firstDate, lastDate, theme, teamName]);

  const overallValues = useMemo(() => sessions.map((s) => s.overall), [sessions]);
  const overallDelta = useMemo(() => deltaFirstLast(overallValues), [overallValues]);

  const totalPresent = useMemo(() => sumPresentPlayers(sessions), [sessions]);
  const totalRatedPlayersApprox = useMemo(
    () => sumRatedPlayersForAnyCategoryApprox(sessions),
    [sessions]
  );

  const handleDownloadSnapshotCSV = () => {
    const params = new URLSearchParams();
    params.set("team_id", String(teamId));
    params.set("theme", theme);
    params.set("format", "snapshot_csv");
    window.location.href = `/api/reports/player-trends?${params.toString()}`;
  };

  if (!sessions.length) {
    return (
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Player trends</h2>
            <p className="text-xs text-gray-600">{headerLine}</p>
          </div>
          <button
            onClick={handleDownloadSnapshotCSV}
            className="px-3 py-1 rounded border bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
          >
            📥 Download Snapshot CSV
          </button>
        </div>

        <div className="border rounded p-4 bg-gray-50 text-sm text-gray-700">
          No sessions found for this team + theme.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Player trends</h2>
          <p className="text-xs text-gray-600">{headerLine}</p>

          {/* Badges */}
          <div className="mt-2 flex flex-wrap gap-2 text-[0.72rem] text-gray-800">
            <span className="px-2 py-1 rounded bg-indigo-50 border border-indigo-200">
              Sessions: <span className="font-semibold">{sessionCount}</span>
            </span>

            <span className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200">
              Rated players (approx):{" "}
              <span className="font-semibold">
                {totalRatedPlayersApprox}/{totalPresent}
              </span>
            </span>

            <span className="px-2 py-1 rounded bg-gray-100 border">
              Overall Δ (first→last):{" "}
              <span className="font-semibold">
                {overallDelta === null ? "—" : `${overallDelta > 0 ? "+" : ""}${overallDelta}`}
              </span>{" "}
              {arrow(overallDelta)}
            </span>
          </div>

          <p className="mt-2 text-[0.7rem] text-gray-500">
            Rated players (approx) uses the maximum rated count among categories per session.
          </p>
        </div>

        <button
          onClick={handleDownloadSnapshotCSV}
          className="px-3 py-1 rounded border bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
        >
          📥 Download Snapshot CSV
        </button>
      </div>

      {/* Timeline table (clean) */}
      <div className="border rounded bg-white overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-700">
            Session timeline (Overall + categories)
          </div>
          <div className="text-[0.7rem] text-gray-500">Scroll horizontally if needed.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-white">
              <tr className="border-b">
                <th className="text-left text-xs font-semibold px-3 py-2 sticky left-0 bg-white z-10">
                  Metric
                </th>

                {sessions.map((s) => (
                  <th
                    key={s.session_id}
                    className="text-center text-[0.7rem] font-semibold px-2 py-2"
                    title={`Present: ${s.present_count}`}
                  >
                    <div>{s.session_date}</div>
                  </th>
                ))}

                <th className="text-center text-xs font-semibold px-3 py-2">Δ</th>
              </tr>
            </thead>

            <tbody>
              {/* Overall row */}
              <tr className="border-b bg-gray-50">
                <td className="px-3 py-2 font-semibold sticky left-0 bg-gray-50 z-10">
                  Overall
                </td>

                {sessions.map((s) => (
                  <td key={s.session_id} className="text-center px-2 py-2">
                    <span className="font-semibold">{fmt(s.overall)}</span>
                  </td>
                ))}

                <td className="text-center px-3 py-2 font-semibold">
                  {overallDelta === null ? "—" : `${overallDelta > 0 ? "+" : ""}${overallDelta}`}{" "}
                  {arrow(overallDelta)}
                </td>
              </tr>

              {/* Category rows */}
              {CATEGORY_ORDER.map((cat) => {
                const values = sessions.map((s) => s.category_avgs[cat]);
                const d = deltaFirstLast(values);

                return (
                  <tr key={cat} className="border-b">
                    <td className="px-3 py-2 text-xs font-medium sticky left-0 bg-white z-10">
                      {CATEGORY_LABELS[cat]}
                    </td>

                    {sessions.map((s) => (
                      <td key={s.session_id} className="text-center px-2 py-2">
                        {fmt(s.category_avgs[cat])}
                      </td>
                    ))}

                    <td className="text-center px-3 py-2 text-xs font-semibold">
                      {d === null ? "—" : `${d > 0 ? "+" : ""}${d}`} {arrow(d)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 bg-white text-[0.72rem] text-gray-600">
          Tip: hover a session date header to see how many players were marked present.
        </div>
      </div>
    </section>
  );
}
