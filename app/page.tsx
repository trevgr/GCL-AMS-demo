// app/page.tsx
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

export default async function Home() {
  const { data: players, error } = await supabase
    .from("players")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error loading players:", error);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Grassroots AMS</h1>
        <p>Failed to load players.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Grassroots AMS</h1>
      <h2 className="text-xl mb-2">Players</h2>

      {players && players.length > 0 ? (
        <ul className="space-y-2">
          {players.map((p: Player) => (
            <li
              key={p.id}
              className="border rounded px-3 py-2 flex justify-between"
            >
              <Link href={`/players/${p.id}`} className="font-medium text-blue-600">
                {p.name}
              </Link>
              <span className="text-sm text-gray-500">
                {new Date(p.dob).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No players found</p>
      )}
    </main>
  );
}
