// app/api/reports/player-trends/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";
import { getCoachAccessForUser } from "../../../../lib/coachAccess";

export const dynamic = "force-dynamic";

type CategoryKey =
  | "ball_control"
  | "passing"
  | "shooting"
  | "fitness"
  | "attitude"
  | "coachability"
  | "positioning"
  | "speed_agility";

const CATEGORIES: CategoryKey[] = [
  "ball_control",
  "passing",
  "shooting",
  "fitness",
  "attitude",
  "coachability",
  "positioning",
  "speed_agility",
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const teamIdParam = url.searchParams.get("team_id");
    const theme = url.searchParams.get("theme");
    const format = (url.searchParams.get("format") || "session_summary_json").toLowerCase();

    const allowedFormats = new Set(["snapshot_csv", "session_summary_json"]);
    if (!allowedFormats.has(format)) {
      return NextResponse.json(
        { error: "format must be snapshot_csv or session_summary_json" },
        { status: 400 }
      );
    }

    const teamId = teamIdParam ? Number(teamIdParam) : null;
    if (!teamId || !Number.isFinite(teamId) || teamId <= 0) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    if (!theme || theme.trim() === "") {
      return NextResponse.json({ error: "theme is required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const access = await getCoachAccessForUser(supabase as any, user.id);
    const allowedTeamIds: number[] = access?.teamIds ?? [];

    if (!allowedTeamIds || allowedTeamIds.length === 0) {
      if (format === "snapshot_csv") return csvResponse("", `player-trends-snapshot-${teamId}.csv`);
      return NextResponse.json({ meta: { team_id: teamId, theme, session_count: 0 }, sessions: [] });
    }

    if (!allowedTeamIds.includes(teamId)) {
      return NextResponse.json({ error: "Forbidden (team access)" }, { status: 403 });
    }

    // 1) sessions for team + theme (ALL sessions)
    const { data: sessions, error: sessionsErr } = await supabase
      .from("sessions")
      .select("id, session_date, theme, team_id, team:teams(id,name)")
      .eq("team_id", teamId)
      .eq("theme", theme)
      .order("session_date", { ascending: true });

    if (sessionsErr) {
      return NextResponse.json({ error: sessionsErr.message }, { status: 500 });
    }

    const header = [
      "session_date",
      "theme",
      "team_name",
      "player_id",
      "player_name",
      "ball_control",
      "passing",
      "shooting",
      "fitness",
      "attitude",
      "coachability",
      "positioning",
      "speed_agility",
    ].join(",");

    if (!sessions || sessions.length === 0) {
      if (format === "snapshot_csv") {
        return csvResponse(header + "\n", `player-trends-snapshot-${teamId}.csv`);
      }
      return NextResponse.json(
        {
          meta: {
            team_id: teamId,
            team_name: "",
            theme,
            session_count: 0,
            first_session_date: null,
            last_session_date: null,
          },
          sessions: [],
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const teamName = (sessions[0] as any)?.team?.name ?? "";
    const sessionIds = (sessions as any[]).map((s) => s.id);

    // 2) present players via attendance
    const { data: presentRows, error: presentErr } = await supabase
      .from("attendance")
      .select("session_id, player_id, player:players(id,name)")
      .in("session_id", sessionIds)
      .eq("status", "present");

    if (presentErr) {
      return NextResponse.json({ error: presentErr.message }, { status: 500 });
    }

    const presentBySession = new Map<number, { id: number; name: string }[]>();
    for (const r of (presentRows ?? []) as any[]) {
      if (!r.player) continue;
      const list = presentBySession.get(r.session_id) ?? [];
      list.push({ id: Number(r.player.id), name: String(r.player.name) });
      presentBySession.set(r.session_id, list);
    }
    for (const [sid, list] of presentBySession.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
      presentBySession.set(sid, list);
    }

    // 3) feedback rows aggregate per (session_id, player_id)
    const { data: feedbackRows, error: feedbackErr } = await supabase
      .from("coach_feedback")
      .select(
        `
        session_id,
        player_id,
        coach_id,
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
      .in("session_id", sessionIds);

    if (feedbackErr) {
      return NextResponse.json({ error: feedbackErr.message }, { status: 500 });
    }

    type Agg = {
      sums: Record<CategoryKey, number>;
      counts: Record<CategoryKey, number>;
    };
    const initAgg = (): Agg => ({
      sums: {
        ball_control: 0,
        passing: 0,
        shooting: 0,
        fitness: 0,
        attitude: 0,
        coachability: 0,
        positioning: 0,
        speed_agility: 0,
      },
      counts: {
        ball_control: 0,
        passing: 0,
        shooting: 0,
        fitness: 0,
        attitude: 0,
        coachability: 0,
        positioning: 0,
        speed_agility: 0,
      },
    });

    const aggMap = new Map<string, Agg>(); // session_id|player_id
    for (const row of (feedbackRows ?? []) as any[]) {
      const key = `${row.session_id}|${row.player_id}`;
      const a = aggMap.get(key) ?? initAgg();
      for (const cat of CATEGORIES) {
        const v = row[cat];
        if (typeof v === "number" && v > 0) {
          a.sums[cat] += v;
          a.counts[cat] += 1;
        }
      }
      aggMap.set(key, a);
    }

    // ----------------------------
    // SNAPSHOT CSV (unchanged format)
    // ----------------------------
    if (format === "snapshot_csv") {
      const lines: string[] = [header];

      for (const s of sessions as any[]) {
        const sessionDate = s.session_date;
        const sessionTheme = s.theme ?? "";
        const players = presentBySession.get(s.id) ?? [];

        for (const p of players) {
          const key = `${s.id}|${p.id}`;
          const a = aggMap.get(key);

          const avg = (cat: CategoryKey) => {
            if (!a) return "";
            const c = a.counts[cat];
            if (!c) return "";
            return String(round2(a.sums[cat] / c));
          };

          lines.push(
            [
              csvEscape(sessionDate),
              csvEscape(sessionTheme),
              csvEscape(teamName),
              csvEscape(p.id),
              csvEscape(p.name),
              csvEscape(avg("ball_control")),
              csvEscape(avg("passing")),
              csvEscape(avg("shooting")),
              csvEscape(avg("fitness")),
              csvEscape(avg("attitude")),
              csvEscape(avg("coachability")),
              csvEscape(avg("positioning")),
              csvEscape(avg("speed_agility")),
            ].join(",")
          );
        }

        lines.push("");
      }

      return csvResponse(lines.join("\n"), `player-trends-snapshot-${teamId}.csv`);
    }

    // ----------------------------
    // SESSION SUMMARY JSON (Option A UI)
    // ----------------------------
    const sessionSummaries = (sessions as any[]).map((s) => {
      const presentPlayers = presentBySession.get(s.id) ?? [];
      const presentCount = presentPlayers.length;

      const categoryAvgs: Record<CategoryKey, number | null> = {
        ball_control: null,
        passing: null,
        shooting: null,
        fitness: null,
        attitude: null,
        coachability: null,
        positioning: null,
        speed_agility: null,
      };

      const ratedCounts: Record<CategoryKey, number> = {
        ball_control: 0,
        passing: 0,
        shooting: 0,
        fitness: 0,
        attitude: 0,
        coachability: 0,
        positioning: 0,
        speed_agility: 0,
      };

      const sums: Record<CategoryKey, number> = {
        ball_control: 0,
        passing: 0,
        shooting: 0,
        fitness: 0,
        attitude: 0,
        coachability: 0,
        positioning: 0,
        speed_agility: 0,
      };

      for (const p of presentPlayers) {
        const key = `${s.id}|${p.id}`;
        const a = aggMap.get(key);

        for (const cat of CATEGORIES) {
          if (!a) continue;
          if (a.counts[cat] > 0) {
            sums[cat] += a.sums[cat] / a.counts[cat]; // per-player avg within session
            ratedCounts[cat] += 1;
          }
        }
      }

      for (const cat of CATEGORIES) {
        categoryAvgs[cat] = ratedCounts[cat] > 0 ? round2(sums[cat] / ratedCounts[cat]) : null;
      }

      const overallVals = CATEGORIES.map((c) => categoryAvgs[c]).filter(
        (v): v is number => v !== null
      );
      const overall =
        overallVals.length > 0
          ? round2(overallVals.reduce((a, b) => a + b, 0) / overallVals.length)
          : null;

      const ratedSlots = CATEGORIES.reduce((sum, c) => sum + ratedCounts[c], 0);
      const possibleSlots = presentCount * CATEGORIES.length;

      return {
        session_id: s.id,
        session_date: s.session_date as string,
        theme: (s.theme ?? null) as string | null,
        team_name: teamName,
        present_count: presentCount,
        rated_slots: ratedSlots,
        possible_slots: possibleSlots,
        overall,
        category_avgs: categoryAvgs,
        category_rated_counts: ratedCounts,
      };
    });

    const firstDate = sessionSummaries[0]?.session_date ?? null;
    const lastDate = sessionSummaries[sessionSummaries.length - 1]?.session_date ?? null;

    return NextResponse.json(
      {
        meta: {
          team_id: teamId,
          team_name: teamName,
          theme,
          session_count: sessionSummaries.length,
          first_session_date: firstDate,
          last_session_date: lastDate,
        },
        sessions: sessionSummaries,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
