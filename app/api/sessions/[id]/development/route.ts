// app/api/sessions/[id]/development/route.ts
import { NextRequest } from "next/server";
import { supabase } from "../../../../../lib/supabaseClient";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sessionId = Number(id);

  if (Number.isNaN(sessionId)) {
    return new Response("Invalid session ID", { status: 400 });
  }

  // Load session (optional, for filename)
  const { data: session } = await supabase
    .from("sessions")
    .select("session_date")
    .eq("id", sessionId)
    .maybeSingle();

  // Load coach feedback joined with player
  const { data, error } = await supabase
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
        dob
      )
    `
    )
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error exporting development:", error);
    return new Response("Failed to export development", { status: 500 });
  }

  const rows = data ?? [];

  const header = [
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
    lines.push(
      [
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

  const datePart = session?.session_date ?? "";
  const filename = `session-${sessionId}-${datePart}-development.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
