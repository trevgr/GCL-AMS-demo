// app/api/reports/development-samples/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars for development-samples export", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    return new NextResponse("Supabase not configured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Keep the select conservative so it won't break if a column name changes
  const { data, error } = await supabase
    .from("coach_feedback")
    .select(
      `
      id,
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
      speed_agility,
      comments,
      player:players (
        name,
        dob
      ),
      session:sessions (
        session_date,
        session_type,
        team_id,
        team:teams (
          name,
          age_group,
          season
        )
      )
    `
    );

  if (error) {
    console.error(
      "Error loading coach_feedback for samples CSV:",
      {
        message: (error as any).message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      }
    );
    return new NextResponse("Failed to load data", { status: 500 });
  }

  const rows = data ?? [];

  // CSV header (no inserted_at now)
  const header = [
    "sample_id",
    "session_id",
    "session_date",
    "session_type",
    "team_id",
    "team_name",
    "team_age_group",
    "team_season",
    "player_id",
    "player_name",
    "player_dob",
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
  ];

  const escape = (value: unknown): string => {
    if (value == null) return "";
    const s = String(value);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvLines = [
    header.join(","), // header row
    ...rows.map((row: any) => {
      const team = row.session?.team;
      const player = row.player;

      return [
        row.id,
        row.session_id,
        row.session?.session_date ?? "",
        row.session?.session_type ?? "",
        row.session?.team_id ?? "",
        team?.name ?? "",
        team?.age_group ?? "",
        team?.season ?? "",
        row.player_id,
        player?.name ?? "",
        player?.dob ?? "",
        row.coach_id ?? "",
        row.ball_control ?? "",
        row.passing ?? "",
        row.shooting ?? "",
        row.fitness ?? "",
        row.attitude ?? "",
        row.coachability ?? "",
        row.positioning ?? "",
        row.speed_agility ?? "",
        row.comments ?? "",
      ]
        .map(escape)
        .join(",");
    }),
  ].join("\n");

  return new NextResponse(csvLines, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="development-samples.csv"',
      "Cache-Control": "no-store",
    },
  });
}
