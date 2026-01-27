// app/teams/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { getCoachAccessForUser } from "../../lib/coachAccess";

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

  // Try to get the Supabase auth user (may be null if auth not wired on server)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("TeamsPage: error getting auth user:", userError);
  }

  // Try to figure out which teams this coach can see.
  // If we can't, we'll just fall back to "all active teams".
  let teamIdsFilter: number[] | null = null;

  if (user) {
    const access = await getCoachAccessForUser(supabase as any, user.id);

    if (!access) {
      console.warn(
        "TeamsPage: no coach access record found for user",
        user.id
      );
    } else {
      teamIdsFilter = access.teamIds;
    }
  } else {
    console.warn(
      "TeamsPage: no Supabase user, falling back to showing all active teams."
    );
  }

  // Build the base query
  let query = supabase
    .from("teams")
    .select("*")
    .eq("active", true)
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  // If we have a teamIdsFilter, enforce it
  if (teamIdsFilter && teamIdsFilter.length > 0) {
    query = query.in("id", teamIdsFilter);
  }

  const { data: teams, error } = await query;

  if (error) {
    console.error("Error loading teams:", error);
  }

  const typedTeams = (teams ?? []) as Team[];

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-1">Teams</h1>
        <p className="text-sm text-gray-600">
          Teams you can access based on your club role and assignments.
        </p>

        {!user && (
          <p className="mt-1 text-xs text-amber-600">
            Note: Supabase auth user is not detected on the server. Showing all
            active teams. Once auth is fully wired, team access will be filtered
            per coach.
          </p>
        )}
      </section>

      {error ? (
        <p className="text-sm text-red-600">
          Failed to load teams. Check server logs for details.
        </p>
      ) : typedTeams.length === 0 ? (
        <p className="text-sm text-gray-700">
          No teams found for your account.
          <br />
          If you expect to see teams here, make sure your user is linked in{" "}
          <span className="font-mono text-xs">coaches</span> and{" "}
          <span className="font-mono text-xs">coach_team_assignments</span>.
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
