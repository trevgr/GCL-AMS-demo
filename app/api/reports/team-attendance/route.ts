// app/api/reports/team-attendance/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";
import { getCoachAccessForUser } from "../../../../lib/coachAccess";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function pct(n: number, d: number) {
  if (d <= 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();

  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("team_id");
  const teamId = teamIdParam ? Number(teamIdParam) : NaN;

  if (!teamIdParam || Number.isNaN(teamId)) {
    return new NextResponse("Missing or invalid team_id", { status: 400 });
  }

  // ---- Identify user ----
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("team-attendance: auth error", userError);
  }
  if (!user) {
    return new NextResponse("Not authenticated", { status: 401 });
  }

  // ---- Enforce access (coach sees only assigned; director/admin all) ----
  const access = await getCoachAccessForUser(supabase as any, user.id);
  if (!access) {
    return new NextResponse("No coach access record for user", { status: 403 });
  }

  // If you ever change coachAccess to return null for "all teams",
  // you can relax this. Current implementation returns explicit teamIds.
  if (!access.teamIds.includes(teamId)) {
    return new NextResponse("Not allowed to view this team", { status: 403 });
  }

  // ---- Load team info (for filename + header) ----
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, age_group, season, active")
    .eq("id", teamId)
    .maybeSingle();

  if (teamErr) {
    console.error("team-attendance: team load error", teamErr);
    return new NextResponse("Failed to load team", { status: 500 });
  }
  if (!team) {
    return new NextResponse("Team not found", { status: 404 });
  }

  // ---- Load sessions for team (total count) ----
  const { data: sessions, error: sessionsErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("team_id", teamId);

  if (sessionsErr) {
    console.error("team-attendance: sessions load error", sessionsErr);
    return new NextResponse("Failed to load sessions", { status: 500 });
  }

  const totalSessions = (sessions ?? []).length;

  // ---- Load players in team via team_players ----
  const { data: teamPlayers, error: teamPlayersErr } = await supabase
    .from("team_players")
    .select(
      `
      player:players (
        id,
        name,
        active
      )
    `
    )
    .eq("team_id", teamId);

  if (teamPlayersErr) {
    console.error("team-attendance: team_players load error", teamPlayersErr);
    return new NextResponse("Failed to load team players", { status: 500 });
  }

  type TeamPlayerRow = {
    player: { id: number; name: string; active: boolean } | null;
  };

  const players = (teamPlayers ?? [])
    .map((r: TeamPlayerRow) => r.player)
    .filter(Boolean) as { id: number; name: string; active: boolean }[];

  // ---- Load attendance restricted to this team via sessions inner join ----
  const { data: attendanceRows, error: attendanceErr } = await supabase
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

  if (attendanceErr) {
    console.error("team-attendance: attendance load error", attendanceErr);
    return new NextResponse("Failed to load attendance", { status: 500 });
  }

  const attendanceByPlayer = new Map<number, { present: number; marked: number }>();

  for (const row of attendanceRows ?? []) {
    const playerId = (row as any).player_id as number;
    const status = (row as any).status as "present" | "absent";

    const entry = attendanceByPlayer.get(playerId) ?? { present: 0, marked: 0 };
    entry.marked += 1;
    if (status === "present") entry.present += 1;
    attendanceByPlayer.set(playerId, entry);
  }

  const leaderboard = players
    .map((p) => {
      const stats = attendanceByPlayer.get(p.id) ?? { present: 0, marked: 0 };
      return {
        player_id: p.id,
        player_name: p.name,
        player_active: p.active,
        present: stats.present,
        marked: stats.marked,
        total_sessions: totalSessions,
        present_percent: pct(stats.present, totalSessions),
      };
    })
    .sort((a, b) => {
      if (b.present !== a.present) return b.present - a.present;
      if (b.marked !== a.marked) return b.marked - a.marked;
      return a.player_name.localeCompare(b.player_name);
    });

  // ---- Build CSV ----
  const header = [
    "team_id",
    "team_name",
    "age_group",
    "season",
    "player_id",
    "player_name",
    "player_active",
    "present",
    "marked",
    "total_sessions",
    "present_percent",
  ].map(csvEscape);

  const lines: string[] = [header.join(",")];

  for (const row of leaderboard) {
    lines.push(
      [
        csvEscape(team.id),
        csvEscape(team.name),
        csvEscape(team.age_group),
        csvEscape(team.season),
        csvEscape(row.player_id),
        csvEscape(row.player_name),
        csvEscape(row.player_active ? "active" : "inactive"),
        csvEscape(row.present),
        csvEscape(row.marked),
        csvEscape(row.total_sessions),
        csvEscape(row.present_percent),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");

  const safeTeamName = String(team.name).replace(/[^a-z0-9-_]+/gi, "_");
  const filename = `attendance-leaderboard-team-${team.id}-${safeTeamName}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
