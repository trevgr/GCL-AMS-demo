// app/api/sessions/[id]/attendance/route.ts
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

  // Load session (for nicer filename, optional)
  const { data: session } = await supabase
    .from("sessions")
    .select("session_date")
    .eq("id", sessionId)
    .maybeSingle();

  // Load attendance with player info
  const { data, error } = await supabase
    .from("attendance")
    .select(
      `
      status,
      player:players (
        id,
        name,
        dob
      )
    `
    )
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error exporting attendance:", error);
    return new Response("Failed to export attendance", { status: 500 });
  }

  const rows = data ?? [];

  const header = [
    "Player Name",
    "DOB",
    "Status",
  ].map(csvEscape);

  const lines: string[] = [header.join(",")];

  for (const row of rows as any[]) {
    const player = row.player ?? {};
    lines.push(
      [
        csvEscape(player.name ?? ""),
        csvEscape(player.dob ?? ""),
        csvEscape(row.status ?? ""),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");

  const datePart = session?.session_date ?? "";
  const filename = `session-${sessionId}-${datePart}-attendance.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
