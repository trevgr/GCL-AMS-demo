// app/api/reports/development/route.ts
import { NextRequest } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(_req: NextRequest) {
  // Load all coach_feedback with player + session + team information
  const { data, error } = await supabase
    .from("coach_feedback")
    .select(
      `
      session_id,
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
        dob
      ),
      session:sessions (
        session_date,
        session_type,
        team:teams (
          name,
          age_group,
          season
        )
      )
    `
    )
    .order("session_id", { ascending: true });

  if (error) {
    console.error("Error loading development report:", error);
    return new Response("Failed to load development report", {
      status: 500,
    });
  }

  const rows = data ?? [];

  const header = [
    "Session Date",
    "Session Type",
    "Team",
    "Age Group",
    "Season",
    "Player Name",
    "DOB",
    "Ball Control",
    "Passing",
    "Shooting",
    "Fitness",
    "Attitude",
    "Coachability",
    "Positioning",
    "Speed/Agility",
    "Comments",
  ].map(csvEscape);

  const lines: string[] = [header.join(",")];

  for (const row of rows as any[]) {
    const player = row.player ?? {};
    const session = row.session ?? {};
    const team = session.team ?? {};

    lines.push(
      [
        csvEscape(session.session_date ?? ""),
        csvEscape(session.session_type ?? ""),
        csvEscape(team.name ?? ""),
        csvEscape(team.age_group ?? ""),
        csvEscape(team.season ?? ""),
        csvEscape(player.name ?? ""),
        csvEscape(player.dob ?? ""),
        csvEscape(row.ball_control),
        csvEscape(row.passing),
        csvEscape(row.shooting),
        csvEscape(row.fitness),
        csvEscape(row.attitude),
        csvEscape(row.coachability),
        csvEscape(row.positioning),
        csvEscape(row.speed_agility),
        csvEscape(row.comments ?? ""),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");

  const filename = `development-report-all-sessions.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
