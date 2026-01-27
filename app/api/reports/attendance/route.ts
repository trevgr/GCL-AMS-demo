// app/api/reports/attendance/route.ts
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

// Helper to determine which teams this user can see
async function getAllowedTeamIds() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // null  => director, all teams
  // []    => logged in, but no assignments
  // [ids] => coach, specific teams
  let allowedTeamIds: number[] | null = [];

  if (!user) {
    allowedTeamIds = [];
  } else {
    // Director?
    const { data: directorRow } = await supabase
      .from("directors")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (directorRow) {
      allowedTeamIds = null; // all teams
    } else {
      // Coach?
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

  return { supabase: await createServerSupabaseClient(), allowedTeamIds };
}

export async function GET(_req: NextRequest) {
  const { supabase, allowedTeamIds } = await getAllowedTeamIds();

  const header = [
    "Session Date",
    "Team",
    "Age Group",
    "Season",
    "Session Type",
    "Theme",
    "Present Count",
    "Total Marked",
  ].map(csvEscape);

  // If user has no accessible teams, return header only
  if (Array.isArray(allowedTeamIds) && allowedTeamIds.length === 0) {
    const csv = header.join(",") + "\r\n";
    const filename = `attendance-report-all-sessions.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Load sessions with optional team filter
  let sessionsQuery = supabase
    .from("sessions")
    .select(
      `
      id,
      session_date,
      session_type,
      theme,
      team:teams (
        name,
        age_group,
        season
      )
    `
    )
    .order("session_date", { ascending: true });

  if (Array.isArray(allowedTeamIds)) {
    sessionsQuery = sessionsQuery.in("team_id", allowedTeamIds);
  }

  const { data: sessions, error: sessionsError } = await sessionsQuery;

  if (sessionsError) {
    console.error("Error loading sessions for report:", sessionsError);
    return new Response("Failed to load sessions", { status: 500 });
  }

  // Load all attendance (we’ll only use entries whose session is in our list)
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("session_id, status");

  if (attendanceError) {
    console.error("Error loading attendance for report:", attendanceError);
    return new Response("Failed to load attendance", { status: 500 });
  }

  type AttendanceRow = {
    session_id: number;
    status: "present" | "absent";
  };

  const typedAttendance = (attendance ?? []) as AttendanceRow[];

  const counts = new Map<number, { present: number; totalMarked: number }>();

  for (const row of typedAttendance) {
    const entry =
      counts.get(row.session_id) ?? { present: 0, totalMarked: 0 };
    entry.totalMarked += 1;
    if (row.status === "present") {
      entry.present += 1;
    }
    counts.set(row.session_id, entry);
  }

  const lines: string[] = [header.join(",")];

  for (const s of sessions ?? []) {
    const sess = s as any;
    const count = counts.get(sess.id) ?? {
      present: 0,
      totalMarked: 0,
    };
    const team = sess.team ?? {};

    lines.push(
      [
        csvEscape(sess.session_date),
        csvEscape(team.name ?? ""),
        csvEscape(team.age_group ?? ""),
        csvEscape(team.season ?? ""),
        csvEscape(sess.session_type),
        csvEscape(sess.theme ?? ""),
        csvEscape(count.present),
        csvEscape(count.totalMarked),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");
  const filename = `attendance-report-all-sessions.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
