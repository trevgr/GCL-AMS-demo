// app/calendar/page.tsx
import Link from "next/link";
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
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }); // e.g. "Wed, 21 Jan"
}

export default async function CalendarPage() {
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

  const allDates = Array.from(byDate.keys());

  // Work out this week (Mon–Sun)
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = (dayOfWeek + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const thisWeekDates: string[] = [];
  const upcomingDates: string[] = [];
  const pastDates: string[] = [];

  for (const dateStr of allDates) {
    const d = new Date(dateStr + "T00:00:00");
    if (d >= weekStart && d <= weekEnd) {
      thisWeekDates.push(dateStr);
    } else if (d > weekEnd) {
      upcomingDates.push(dateStr);
    } else {
      pastDates.push(dateStr);
    }
  }

  thisWeekDates.sort();
  upcomingDates.sort();
  pastDates.sort().reverse();

  const renderDateBlock = (label: string, dates: string[]) => {
    if (dates.length === 0) return null;

    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <ul className="space-y-3">
          {dates.map((date) => {
            const daySessions = byDate.get(date)!;
            return (
              <li key={date} className="border rounded px-3 py-2 bg-white">
                <div className="font-semibold mb-1">
                  {formatDateLong(date)}
                </div>
                <ul className="space-y-1 text-sm">
                  {daySessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/sessions/${s.id}?view=attendance`}
                        className="hover:underline"
                      >
                        <span className="font-medium">
                          {s.team?.name ?? "Team"} – {s.session_type}
                        </span>
                        {s.theme && (
                          <span className="text-gray-600">
                            {" "}
                            · {s.theme}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Calendar</h1>
        <p className="text-sm text-gray-600">
          This week first, then upcoming sessions by date.
        </p>
      </section>

      {thisWeekDates.length === 0 &&
      upcomingDates.length === 0 &&
      pastDates.length === 0 ? (
        <p>No sessions scheduled.</p>
      ) : (
        <div className="space-y-6">
          {renderDateBlock("This week", thisWeekDates)}
          {renderDateBlock("Upcoming", upcomingDates)}
          {/* Uncomment for past if needed */}
          {/* {renderDateBlock("Past sessions", pastDates)} */}
        </div>
      )}
    </main>
  );
}
