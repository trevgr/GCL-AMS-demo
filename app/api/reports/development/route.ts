// app/api/reports/development/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

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

const categoryKeys: CategoryKey[] = [
  "ball_control",
  "passing",
  "shooting",
  "fitness",
  "attitude",
  "coachability",
  "positioning",
  "speed_agility",
];

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("team_id");
  const teamId = teamIdParam ? Number(teamIdParam) : null;

  const { supabase, allowedTeamIds } = await getAllowedTeamIds();

  // If user has no access to any team, return empty CSV with header
  if (Array.isArray(allowedTeamIds) && allowedTeamIds.length === 0) {
    const header = [
      "Team",
      "Age group",
      "Season",
      "Session ID",
      "Session date",
      "Session type",
      "Theme",
      "Ball control avg",
      "Passing avg",
      "Shooting avg",
      "Fitness avg",
      "Attitude avg",
      "Coachability avg",
      "Positioning avg",
      "Speed / agility avg",
      "Samples (non-zero ratings)",
    ];

    const csv = header.join(",") + "\n";
    const filename = teamId
      ? `team-development-${teamId}.csv`
      : "team-development.csv";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // 1) Load feedback joined to sessions + teams
  const { data, error } = await supabase
    .from("coach_feedback")
    .select(
      `
      session_id,
      ball_control,
      passing,
      shooting,
      fitness,
      attitude,
      coachability,
      positioning,
      speed_agility,
      session:sessions (
        id,
        session_date,
        session_type,
        theme,
        team_id,
        team:teams (
          id,
          name,
          age_group,
          season
        )
      )
    `
    );

  if (error) {
    console.error("Development CSV – error loading feedback:", error);
    return NextResponse.json(
      { error: "Failed to load development data" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as any[];

  type AggRow = {
    sessionId: number;
    sessionDate: string;
    sessionType: string;
    theme: string | null;
    teamId: number;
    teamName: string;
    ageGroup: string;
    season: string;
    sums: Record<CategoryKey, number>;
    counts: Record<CategoryKey, number>;
    totalSamples: number;
  };

  const bySession = new Map<number, AggRow>();

  for (const row of rows) {
    const session = row.session;
    if (!session || !session.team) continue;

    // Enforce optional team filter from query param
    if (teamId != null && session.team_id !== teamId) {
      continue;
    }

    // Enforce allowedTeamIds filter for this user
    if (
      Array.isArray(allowedTeamIds) &&
      !allowedTeamIds.includes(session.team_id)
    ) {
      continue;
    }

    const sessId = session.id as number;

    let agg = bySession.get(sessId);
    if (!agg) {
      agg = {
        sessionId: sessId,
        sessionDate: session.session_date,
        sessionType: session.session_type,
        theme: session.theme,
        teamId: session.team.id,
        teamName: session.team.name,
        ageGroup: session.team.age_group,
        season: session.team.season,
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
        totalSamples: 0,
      };
      bySession.set(sessId, agg);
    }

    for (const key of categoryKeys) {
      const value = row[key] as number | null;
      if (typeof value === "number" && value > 0) {
        agg.sums[key] += value;
        agg.counts[key] += 1;
        agg.totalSamples += 1;
      }
    }
  }

  const header = [
    "Team",
    "Age group",
    "Season",
    "Session ID",
    "Session date",
    "Session type",
    "Theme",
    "Ball control avg",
    "Passing avg",
    "Shooting avg",
    "Fitness avg",
    "Attitude avg",
    "Coachability avg",
    "Positioning avg",
    "Speed / agility avg",
    "Samples (non-zero ratings)",
  ];

  const lines: string[] = [];
  lines.push(header.join(","));

  const sortedAgg = Array.from(bySession.values()).sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate)
  );

  for (const agg of sortedAgg) {
    const avgValues: (string | number)[] = [];

    for (const key of categoryKeys) {
      const count = agg.counts[key];
      if (count === 0) {
        avgValues.push("");
      } else {
        const avg = agg.sums[key] / count;
        avgValues.push(avg.toFixed(2));
      }
    }

    const themeSafe =
      agg.theme?.includes(",") || agg.theme?.includes('"')
        ? `"${String(agg.theme).replace(/"/g, '""')}"`
        : agg.theme ?? "";

    const row = [
      agg.teamName,
      agg.ageGroup,
      agg.season,
      agg.sessionId,
      agg.sessionDate,
      agg.sessionType,
      themeSafe,
      ...avgValues,
      agg.totalSamples,
    ];

    lines.push(row.join(","));
  }

  const csv = lines.join("\n");

  const filename = teamId
    ? `team-development-${teamId}.csv`
    : "team-development.csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
