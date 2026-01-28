// app/sessions/new/page.tsx
import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import NewSessionClient from "./NewSessionClient";

export const dynamic = "force-dynamic";

type TeamOption = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

export default async function NewSessionPage() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, season")
    .eq("active", true)
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("NewSessionPage: error loading teams", error);
  }

  const teams: TeamOption[] = (data ?? []) as TeamOption[];

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">Plan new session</h1>
        <p className="text-sm text-gray-600">
          Choose a team, date and type to add a new session to your calendar.
        </p>
      </section>

      <section className="border rounded bg-white p-3">
        <NewSessionClient teams={teams} />
      </section>
    </main>
  );
}
