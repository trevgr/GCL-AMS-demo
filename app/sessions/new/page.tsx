// app/sessions/new/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import { getCoachAccessForUser } from "../../../lib/coachAccess";
import NewSessionClient from "./NewSessionClient";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
  active: boolean;
};

export default async function NewSessionPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) console.error("NewSessionPage: auth user error", userError);

  if (!user) {
    return (
      <main className="min-h-screen space-y-4">
        <section>
          <h1 className="text-2xl font-bold mb-1">Plan new session</h1>
          <p className="text-sm text-red-600">
            You must be logged in to plan a session.
          </p>
        </section>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Go to login →
        </Link>
      </main>
    );
  }

  // Apply the same access model as Teams/Reports
  const access = await getCoachAccessForUser(supabase as any, user.id);
  const teamIdsFilter = access?.teamIds ?? null;

  let query = supabase
    .from("teams")
    .select("id, name, age_group, season, active")
    .eq("active", true)
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  if (teamIdsFilter && teamIdsFilter.length > 0) {
    query = query.in("id", teamIdsFilter);
  }

  const { data: teams, error } = await query;

  if (error) console.error("NewSessionPage: teams load error", error);

  const typedTeams = (teams ?? []) as TeamRow[];

  return (
    <main className="min-h-screen space-y-4">
      <section className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold mb-1">Plan new session</h1>
          <p className="text-sm text-gray-600">
            Create a training session or match.
          </p>
        </div>
        <Link
          href="/sessions"
          className="text-xs sm:text-sm px-3 py-1.5 rounded border border-slate-400 bg-white hover:bg-slate-100"
        >
          ← Back to sessions
        </Link>
      </section>

      {typedTeams.length === 0 ? (
        <p className="text-sm text-gray-700">
          No teams available for your account.
          <br />
          Ask an admin/director to assign you to a team.
        </p>
      ) : (
        <NewSessionClient teams={typedTeams} />
      )}
    </main>
  );
}
