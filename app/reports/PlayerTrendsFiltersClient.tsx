"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerTrendsClient from "./PlayerTrendsClient";

type TeamOption = { id: number; name: string };

type CategoryKey =
  | "ball_control"
  | "passing"
  | "shooting"
  | "fitness"
  | "attitude"
  | "coachability"
  | "positioning"
  | "speed_agility";

type SessionSummary = {
  session_id: number;
  session_date: string; // YYYY-MM-DD
  theme: string | null;
  team_name: string;

  present_count: number;
  rated_slots: number;
  possible_slots: number;

  overall: number | null;

  category_avgs: Record<CategoryKey, number | null>;
  category_rated_counts: Record<CategoryKey, number>;
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

export default function PlayerTrendsFiltersClient() {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [themes, setThemes] = useState<string[]>([]);

  const [teamId, setTeamId] = useState<number | null>(null);
  const [theme, setTheme] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<SessionSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch("/api/teams/available", { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load teams");
        }
        const list = (await res.json()) as TeamOption[];
        setTeams(list);

        if (list.length > 0 && !teamId) {
          setTeamId(list[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load teams");
      }
    };

    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load themes
  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const response = await fetch("/api/sessions/themes", { cache: "no-store" });
        if (!response.ok) return;
        const t = await response.json();
        const list = Array.isArray(t) ? (t as string[]) : [];
        setThemes(list);

        // optional: default to first theme once loaded
        if (!theme && list.length > 0) {
          setTheme(list[0]);
        }
      } catch (err) {
        console.error("Failed to load themes:", err);
      }
    };
    fetchThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTeam = useMemo(() => {
    return teams.find((t) => t.id === teamId) ?? null;
  }, [teams, teamId]);

  const canLoad = !!teamId && !!theme && theme.trim().length > 0;

  const handleLoad = async () => {
    if (!canLoad) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("team_id", String(teamId));
      params.set("theme", theme);

      // NEW: theme-based session summaries (all sessions for team+theme)
      params.set("format", "session_summary_json");

      const response = await fetch(`/api/reports/player-trends?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to load player trends");
      }

      const result = (await response.json()) as SessionSummaryResponse;
      setPayload(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Filters */}
      <div className="border rounded bg-white p-4 space-y-3">
        <h3 className="font-semibold text-sm">Player trends (by theme)</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Team */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Team</span>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
              className="border rounded px-2 py-1 text-sm"
            >
              {teams.length === 0 && <option value="">Loading teams…</option>}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {/* Theme (required) */}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium">Theme (required)</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {themes.length === 0 && <option value="">Loading themes…</option>}
              {themes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {/* Load */}
          <div className="flex flex-col gap-1 justify-end">
            <button
              onClick={handleLoad}
              disabled={loading || !canLoad}
              className="px-3 py-1 rounded bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>

        {!theme && (
          <div className="text-xs text-red-700">Please select a theme.</div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {payload && selectedTeam && teamId && theme && (
        <PlayerTrendsClient payload={payload} teamId={teamId} teamName={selectedTeam.name} theme={theme} />
      )}
    </section>
  );
}
