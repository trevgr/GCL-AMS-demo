// app/calendar/page.tsx
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: {
    name: string;
    age_group: string;
    season: string;
  } | null;
};

function formatDateLong(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return day; // e.g. "Wed, 21 Jan"
}

export default async function CalendarPage() {
  // Fetch upcoming and recent sessions (last week + next month)
  const { data, error } = await supabase
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

  if (error) {
    console.error("Error loading sessions for calendar:", error);
    return (
      <main className="min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Calendar</h1>
        <p>Failed to load sessions.</p>
      </main>
    );
  }

  const sessions = (data ?? []) as SessionRow[];

  // Group by date
  const byDate = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const key = s.session_date;
    const list = byDate.get(key) ?? [];
    list.push(s);
    byDate.set(key, list);
  }

  const sortedDates = Array.from(byDate.keys()).sort();

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Calendar</h1>
        <p className="text-sm text-gray-600">
          Upcoming and recent sessions by date.
        </p>
      </section>

      {sortedDates.length === 0 ? (
        <p>No sessions scheduled.</p>
      ) : (
        <ul className="space-y-3">
          {sortedDates.map((date) => {
            const daySessions = byDate.get(date)!;
            return (
              <li key={date} className="border rounded px-3 py-2 bg-white">
                <div className="font-semibold mb-1">
                  {formatDateLong(date)}
                </div>
                <ul className="space-y-1 text-sm">
                  {daySessions.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">
                        {s.team?.name ?? "Team"} – {s.session_type}
                      </span>
                      {s.theme && (
                        <span className="text-gray-600">
                          {" "}
                          · {s.theme}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
