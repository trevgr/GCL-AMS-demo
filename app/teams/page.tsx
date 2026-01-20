// app/teams/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabaseServer";

export const dynamic = "force-dynamic";

type Team = {
  id: number;
  name: string;
  age_group: string;
  season: string;
  active: boolean;
};

export default async function TeamsPage() {
  const supabase = await createServerSupabaseClient();

  // 🔍 Debug: who does Supabase think this is?
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("TeamsPage: auth user", {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    userError,
  });

  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .eq("active", true)
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  console.log("TeamsPage: teams query result", {
    error,
    count: teams?.length ?? 0,
  });

  if (error) {
    console.error("Error loading teams:", error);
  }

  const typedTeams = (teams ?? []) as Team[];

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-1">Teams</h1>
        <p className="text-sm text-gray-600">
          Teams you can access based on your role (coach or director).
        </p>
      </section>

      {error ? (
        <p className="text-sm text-red-600">
          Failed to load teams. Check server logs for details.
        </p>
      ) : typedTeams.length === 0 ? (
        <p className="text-sm text-gray-700">
          No teams found for your account.
          <br />
          If you expect to see teams here, make sure your user is added to{" "}
          <span className="font-mono text-xs">directors</span> or{" "}
          <span className="font-mono text-xs">team_coaches</span> in Supabase.
        </p>
      ) : (
        <section>
          <ul className="space-y-2">
            {typedTeams.map((t) => (
              <li
                key={t.id}
                className="border rounded px-3 py-2 bg-white hover:bg-slate-50"
              >
                <Link href={`/teams/${t.id}`} className="block">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm text-gray-600">
                        {t.age_group} · {t.season}
                      </div>
                    </div>
                    {!t.active && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

