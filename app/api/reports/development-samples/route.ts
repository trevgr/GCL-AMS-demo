// app/api/reports/development-samples/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must NOT be exposed on the client.
// It should only live in server-side env (e.g. .env.local, no NEXT_PUBLIC).

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  // Pull all samples with joins
  const { data, error } = await supabase
    .from("coach_feedback")
    .select(
      `
      id,
      player_id,
      session_id,
      coach_id,
      ball_control,
      passing,
      shooting,
      fitness,
      attitude,
      coachability,
      positioning,
      speed_agility,
      comments,
      created_at,
      player:players (
        name,
        dob
      ),
      session:sessions (
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
    .order("session_id", { ascending: true });

  if (error) {
    console.error("Error generating development samples CSV:", error);
    return NextResponse.json(
      { error: "Failed to generate CSV" },
      { status: 500 }
    );
  }

  const rows = data ?? [];

  const header = [
    "sample_id",
    "player_id",
    "player_name",
    "player_dob",
    "session_id",
    "session_date",
    "session_type",
    "session_theme",
    "team_name",
    "team_age_group",
    "team_season",
    "coach_id",
    "ball_control",
    "passing",
    "shooting",
    "fitness",
    "attitude",
    "coachability",
    "positioning",
    "speed_agility",
    "comments",
    "created_at",
  ];

  const lines: string[] = [];
  lines.push(header.join(","));

  for (const row of rows as any[]) {
    const player = row.player ?? {};
    const session = row.session ?? {};
    const team = (session as any).team ?? {};

    const lineValues = [
      row.id,
      row.player_id,
      player.name ?? "",
      player.dob ?? "",
      row.session_id,
      session.session_date ?? "",
      session.session_type ?? "",
      session.theme ?? "",
      team.name ?? "",
      team.age_group ?? "",
      team.season ?? "",
      row.coach_id ?? "",
      row.ball_control,
      row.passing,
      row.shooting,
      row.fitness,
      row.attitude,
      row.coachability,
      row.positioning,
      row.speed_agility,
      row.comments ?? "",
      row.created_at ?? "",
    ].map(csvEscape);

    lines.push(lineValues.join(","));
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="development_samples.csv"',
    },
  });
}
