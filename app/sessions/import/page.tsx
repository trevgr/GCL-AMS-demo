// app/sessions/import/page.tsx
import { supabase } from "../../../lib/supabaseClient";
import ImportSessionsClient from "./ImportSessionsClient";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

export default async function ImportSessionsPage() {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, season")
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  const teams = (data ?? []) as TeamRow[];

  if (error) {
    console.error("Error loading teams for CSV import:", error);
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-2">
          Import sessions from CSV
        </h1>
        <p className="text-sm text-gray-600">
          Choose a team, then upload a CSV containing your fixtures or
          training block. Each row becomes one session.
        </p>
      </section>

      <ImportSessionsClient teams={teams} />
    </main>
  );
}
