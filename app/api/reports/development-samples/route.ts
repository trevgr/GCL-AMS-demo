// app/api/reports/development-samples/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

async function getAllowedTeamIds() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let allowedTeamIds: number[] | null = [];

  if (!user) {
    allowedTeamIds = [];
  } else {
    const { data: directorRow } = await supabase
      .from("directors")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (directorRow) {
      allowedTeamIds = null;
    } else {
      const { data: coachRow } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!coachRow) {
        allowedTeamIds = [];
      } else {
        const { data: assignments } = await supabase
          .from("coach_team_assignments")
          .select("team_id")
          .eq("coach_id", coachRow.id);

        allowedTeamIds = (assignments ?? []).map(
          (row: { team_id: number }) => row.team_id
        );
      }
    }
  }

  return { supabase, allowedTeamIds };
}

export async function GET() {
  const { supabase, allowedTeamIds } = await getAllowedTeamIds();

  // CSV header – changed coach column to `coach_username`
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
    "coach_username",
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

  // If user has no allowed teams, return empty CSV with header
  if (Array.isArray(allowedTeamIds) && allowedTeamIds.length === 0) {
    const csv = header.join(",") + "\n";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="development-samples.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // Lookup coaches so we can map auth_user_id (coach_id) -> username
  const { data: coaches, error: coachesError } = await supabase
    .from("coaches")
    .select("auth_user_id, username");

  if (coachesError) {
    console.error("Error loading coaches for samples CSV:", coachesError);
    return new NextResponse("Failed to load data", { status: 500 });
  }

  const coachNameByAuthId = new Map<string, string>();
  for (const c of coaches ?? []) {
    const row = c as any;
    if (row.auth_user_id && row.username) {
      coachNameByAuthId.set(row.auth_user_id, row.username);
    }
  }

  // Load coach_feedback joined to players + sessions + teams
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
    console.error("Error loading coach_feedback for samples CSV:", {
      message: (error as any).message,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
    });
    return new NextResponse("Failed to load data", { status: 500 });
  }

  const rows = (data ?? []) as any[];

  const escape = (value: unknown): string => {
    if (value == null) return "";
    const s = String(value);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const filteredRows =
    allowedTeamIds === null
      ? rows
      : rows.filter((row) => {
          const teamId = row.session?.team_id as number | undefined;
          if (!teamId) return false;
          return allowedTeamIds!.includes(teamId);
        });

  const csvLines = [
    header.join(","), // header row
    ...filteredRows.map((row: any) => {
      const team = row.session?.team;
      const player = row.player;

      const coachId: string | null = row.coach_id ?? null;
      const coachUsername =
        (coachId && coachNameByAuthId.get(coachId)) || coachId || "";

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
        coachUsername, // 👈 username instead of raw UUID
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
