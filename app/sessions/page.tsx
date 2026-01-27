// app/sessions/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabaseServer";

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

export default async function SessionsPage() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
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

  const sessions = (data ?? []) as SessionRow[];

  return (
    <main className="min-h-screen space-y-4">
      <section className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Sessions</h1>
          <p className="text-sm text-gray-600">
            See planned sessions and open details for attendance &amp; ratings.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sessions/import"
            className="text-xs sm:text-sm px-3 py-1.5 rounded border border-slate-400 bg-white hover:bg-slate-100"
          >
            Import sessions (CSV)
          </Link>
          <Link
            href="/sessions/new"
            className="text-xs sm:text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800"
          >
            + Plan new session
          </Link>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600">
          Failed to load sessions. Please try again.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-700">
          No sessions yet. Use &quot;Plan new session&quot; or &quot;Import
          sessions (CSV)&quot; to add your first ones.
        </p>
      ) : (
        <section>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="border rounded px-3 py-2 bg-white space-y-1"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">
                      {formatDateDDMMYYYY(s.session_date)} · {s.session_type}
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
                  <div className="text-right text-xs flex flex-col gap-1">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="px-3 py-1 rounded border border-slate-400 hover:bg-slate-100"
                    >
                      Session details
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
