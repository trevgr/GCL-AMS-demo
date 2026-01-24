// app/sessions/new/page.tsx
import { supabase } from "../../../lib/supabaseClient";
import NewSessionClient from "./NewSessionClient";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

export default async function NewSessionPage() {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, season")
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  const teams = (data ?? []) as TeamRow[];

  if (error) {
    console.error("Error loading teams for new session:", error);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-3">Plan new session</h1>
        <p className="text-sm text-red-600">
          Failed to load teams. You need at least one team to plan a
          session.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Plan new session</h1>
      <p className="text-sm text-gray-600">
        Choose a team, date, type, and an optional theme or focus for the
        session.
      </p>

      <NewSessionClient teams={teams} />
    </main>
  );
}
