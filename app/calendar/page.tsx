// app/calendar/page.tsx
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

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

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function weekdayShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short" }); // Mon, Tue, etc.
}

function monthYearLabel(year: number, monthIndex: number) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  }); // e.g. "January 2026"
}

function sessionTypeBadge(
  sessionType: string | null | undefined
): { label: string; className: string } {
  const type = (sessionType || "").toLowerCase().trim();

  if (type === "training" || type === "train") {
    return {
      label: "Training",
      className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  }
  if (type === "match" || type === "game" || type === "fixture") {
    return {
      label: "Match",
      className: "bg-blue-100 text-blue-800 border-blue-300",
    };
  }
  if (type === "tournament" || type === "cup") {
    return {
      label: "Tournament",
      className: "bg-purple-100 text-purple-800 border-purple-300",
    };
  }
  if (type === "friendly") {
    return {
      label: "Friendly",
      className: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }

  return {
    label: sessionType || "Other",
    className: "bg-gray-100 text-gray-800 border-gray-300",
  };
}

export default async function CalendarPage(props: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await props.searchParams;
  const activeTab: "upcoming" | "history" =
    view === "history" ? "history" : "upcoming";

  // Load all sessions (you can later filter by team/coach if needed)
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
    .order("session_date", { ascending: true });

  if (sessionsError) {
    console.error("Error loading calendar sessions:", sessionsError);
  }

  const typedSessions = (sessions ?? []) as SessionRow[];

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10); // yyyy-mm-dd

  const upcoming = typedSessions.filter((s) => s.session_date >= todayIso);
  const history = typedSessions.filter((s) => s.session_date < todayIso);

  // Group history by month/year
  type MonthKey = string; // "YYYY-MM"
  const historyByMonth = new Map<
    MonthKey,
    { label: string; items: SessionRow[] }
  >();

  for (const s of history) {
    const d = new Date(s.session_date);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getFullYear();
    const monthIndex = d.getMonth(); // 0–11
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const label = monthYearLabel(year, monthIndex);

    if (!historyByMonth.has(key)) {
      historyByMonth.set(key, { label, items: [] });
    }
    historyByMonth.get(key)!.items.push(s);
  }

  // Sort months descending (most recent month first)
  const sortedHistoryMonths = Array.from(historyByMonth.entries()).sort(
    ([aKey], [bKey]) => (aKey < bKey ? 1 : -1)
  );

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Calendar</h1>
        <p className="text-sm text-gray-600">
          See upcoming sessions at a glance, or browse the full history by
          month.
        </p>
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 text-sm mb-3">
          <Link
            href="/calendar?view=upcoming"
            className={`px-3 py-1 rounded border ${
              activeTab === "upcoming"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Upcoming
          </Link>
          <Link
            href="/calendar?view=history"
            className={`px-3 py-1 rounded border ${
              activeTab === "history"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            History
          </Link>
        </div>

        {/* UPCOMING TAB */}
        {activeTab === "upcoming" && (
          <section className="space-y-2">
            {sessionsError ? (
              <p>Failed to load sessions.</p>
            ) : upcoming.length === 0 ? (
              <p>No upcoming sessions scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s) => {
                  const badge = sessionTypeBadge(s.session_type);

                  return (
                    <li
                      key={s.id}
                      className="border rounded px-3 py-2 bg-white flex justify-between items-start gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {weekdayShort(s.session_date)}{" "}
                            {formatDateDDMMYYYY(s.session_date)}
                          </span>
                          <span
                            className={`text-[0.65rem] px-2 py-0.5 rounded-full border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {s.team
                            ? `${s.team.name} · ${s.team.age_group} · ${s.team.season}`
                            : "Unknown team"}
                        </div>
                        {s.theme && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Theme: {s.theme}
                          </div>
                        )}
                      </div>
                      <div className="text-xs flex flex-col items-end gap-1">
                        <Link
                          href={`/sessions/${s.id}?view=attendance`}
                          className="px-3 py-1 rounded border border-slate-400 hover:bg-slate-100"
                        >
                          Session details
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <section className="space-y-4">
            {sessionsError ? (
              <p>Failed to load sessions.</p>
            ) : history.length === 0 ? (
              <p>No past sessions recorded yet.</p>
            ) : (
              sortedHistoryMonths.map(([key, group]) => (
                <section key={key} className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {group.label}
                  </h2>
                  <ul className="space-y-2">
                    {group.items.map((s) => {
                      const badge = sessionTypeBadge(s.session_type);
                      return (
                        <li
                          key={s.id}
                          className="border rounded px-3 py-2 bg-white flex justify-between items-start gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">
                                {weekdayShort(s.session_date)}{" "}
                                {formatDateDDMMYYYY(s.session_date)}
                              </span>
                              <span
                                className={`text-[0.65rem] px-2 py-0.5 rounded-full border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {s.team
                                ? `${s.team.name} · ${s.team.age_group} · ${s.team.season}`
                                : "Unknown team"}
                            </div>
                            {s.theme && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                Theme: {s.theme}
                              </div>
                            )}
                          </div>
                          <div className="text-xs flex flex-col items-end gap-1">
                            <Link
                              href={`/sessions/${s.id}?view=attendance`}
                              className="px-3 py-1 rounded border border-slate-400 hover:bg-slate-100"
                            >
                              Session details
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </section>
        )}
      </section>
    </main>
  );
}

