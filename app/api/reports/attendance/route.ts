// app/api/reports/attendance/route.ts
import { NextRequest } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(_req: NextRequest) {
  // Load all sessions with team info
  const { data: sessions, error: sessionsError } = await supabase
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

  if (sessionsError) {
    console.error("Error loading sessions for report:", sessionsError);
    return new Response("Failed to load sessions", { status: 500 });
  }

  // Load all attendance
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

  const counts = new Map<
    number,
    { present: number; totalMarked: number }
  >();

  for (const row of typedAttendance) {
    const entry =
      counts.get(row.session_id) ?? { present: 0, totalMarked: 0 };
    entry.totalMarked += 1;
    if (row.status === "present") {
      entry.present += 1;
    }
    counts.set(row.session_id, entry);
  }

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

  const lines: string[] = [header.join(",")];

  for (const s of sessions ?? []) {
    const count = counts.get((s as any).id) ?? {
      present: 0,
      totalMarked: 0,
    };
    const team = (s as any).team ?? {};

    lines.push(
      [
        csvEscape((s as any).session_date),
        csvEscape(team.name ?? ""),
        csvEscape(team.age_group ?? ""),
        csvEscape(team.season ?? ""),
        csvEscape((s as any).session_type),
        csvEscape((s as any).theme ?? ""),
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
