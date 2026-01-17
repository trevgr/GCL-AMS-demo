// app/sessions/page.tsx
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type SessionRow = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: {
    name: string;
    age_group: string;
    season: string;
  } | null;
};

type AttendanceRow = {
  session_id: number;
  status: "present" | "absent";
};

// Deterministic date formatting
function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function SessionsSummaryPage() {
  // Load sessions with their team info
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      `
      id,
      team_id,
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
    .order("session_date", { ascending: false });

  if (sessionsError) {
    console.error("Error loading sessions:", sessionsError);
    return (
      <main className="min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Session attendance</h1>
        <p>Failed to load sessions.</p>
      </main>
    );
  }

  const typedSessions = (sessions ?? []) as SessionRow[];

  // Load all attendance rows
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("session_id, status");

  if (attendanceError) {
    console.error("Error loading attendance:", attendanceError);
  }

  const typedAttendance = (attendance ?? []) as AttendanceRow[];

  // Build per-session attendance counts
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

  return (
    <main className="min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Session attendance</h1>

      {typedSessions.length === 0 ? (
        <p>No sessions recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {typedSessions.map((s) => {
            const count = counts.get(s.id) ?? {
              present: 0,
              totalMarked: 0,
            };

            return (
              <li
                key={s.id}
                className="border rounded px-3 py-2 flex flex-col gap-1"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">
                      {formatDateDDMMYYYY(s.session_date)} ·{" "}
                      {s.session_type}
                    </div>
                    <div className="text-sm text-gray-600">
                      {s.team
                        ? `${s.team.name} · ${s.team.age_group} · ${s.team.season}`
                        : "Unknown team"}
                    </div>
                    {s.theme && (
                      <div className="text-xs text-gray-500">
                        Theme: {s.theme}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="block hover:underline"
                    >
                      <div>
                        <span className="font-semibold">
                          {count.present}
                        </span>{" "}
                        present
                      </div>
                      <div className="text-xs text-gray-500">
                        {count.totalMarked} marked
                      </div>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}