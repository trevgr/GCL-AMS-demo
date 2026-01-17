// app/development/page.tsx
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

type FeedbackWithPlayer = {
  player_id: number;
  ball_control: number;
  passing: number;
  shooting: number;
  fitness: number;
  attitude: number;
  coachability: number;
  positioning: number;
  speed_agility: number;
  created_at: string;
  player: {
    id: number;
    name: string;
    dob: string;
    active: boolean;
  } | null;
};

type PlayerAggregate = {
  player_id: number;
  name: string;
  dob: string;
  active: boolean;
  avg_ball_control: number;
  avg_attitude: number;
  avg_overall: number;
  sample_count: number;
  feedbacks: FeedbackWithPlayer[];
};

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function DevelopmentDashboard() {
  const { data, error } = await supabase
    .from("coach_feedback")
    .select(
      `
      player_id,
      ball_control,
      passing,
      shooting,
      fitness,
      attitude,
      coachability,
      positioning,
      speed_agility,
      created_at,
      player:players (
        id,
        name,
        dob,
        active
      )
    `
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading coach feedback for dashboard:", error);
  }

  const rows = (data ?? []) as FeedbackWithPlayer[];

  // Aggregate by player
  const byPlayer = new Map<number, PlayerAggregate>();

  for (const row of rows) {
    if (!row.player) continue;
    const existing = byPlayer.get(row.player_id);
    if (!existing) {
      byPlayer.set(row.player_id, {
        player_id: row.player.id,
        name: row.player.name,
        dob: row.player.dob,
        active: row.player.active,
        avg_ball_control: row.ball_control,
        avg_attitude: row.attitude,
        avg_overall:
          (row.ball_control +
            row.passing +
            row.shooting +
            row.fitness +
            row.attitude +
            row.coachability +
            row.positioning +
            row.speed_agility) /
          8,
        sample_count: 1,
        feedbacks: [row],
      });
    } else {
      const n = existing.sample_count + 1;
      existing.avg_ball_control =
        (existing.avg_ball_control * existing.sample_count +
          row.ball_control) /
        n;
      existing.avg_attitude =
        (existing.avg_attitude * existing.sample_count + row.attitude) /
        n;
      const newOverall =
        (row.ball_control +
          row.passing +
          row.shooting +
          row.fitness +
          row.attitude +
          row.coachability +
          row.positioning +
          row.speed_agility) /
        8;
      existing.avg_overall =
        (existing.avg_overall * existing.sample_count + newOverall) /
        n;
      existing.sample_count = n;
      existing.feedbacks.push(row);
    }
  }

  const aggregates = Array.from(byPlayer.values());

  // Sort by strongest development need:
  // worst avg_overall first, but emphasise Ball Control + Attitude.
  aggregates.sort((a, b) => {
    const aScore = a.avg_overall + a.avg_ball_control + a.avg_attitude;
    const bScore = b.avg_overall + b.avg_ball_control + b.avg_attitude;
    return aScore - bScore; // lower first
  });

  const topNeeds = aggregates.slice(0, 8);

  return (
    <main className="min-h-screen space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-2">Development dashboard</h1>
        <p className="text-gray-600 text-sm">
          Highlights players with the most room for improvement based on coach
          feedback (ball control, attitude, and overall scores).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Players needing focus</h2>
        {topNeeds.length === 0 ? (
          <p>No feedback recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {topNeeds.map((p) => (
              <li
                key={p.player_id}
                className="border rounded px-3 py-2 bg-white"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <Link
                      href={`/players/${p.player_id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="text-sm text-gray-600">
                      DOB: {formatDateDDMMYYYY(p.dob)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Samples: {p.sample_count}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      Ball Control:{" "}
                      <span className="font-semibold">
                        {p.avg_ball_control.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      Attitude:{" "}
                      <span className="font-semibold">
                        {p.avg_attitude.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Overall: {p.avg_overall.toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* Simple "trend" – list last few feedbacks with date & quick impression */}
                {p.feedbacks.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <div className="font-medium mb-1">Recent trend:</div>
                    <ul className="space-y-1">
                      {p.feedbacks
                        .slice(-3)
                        .reverse()
                        .map((f) => (
                          <li key={f.created_at}>
                            {formatDateDDMMYYYY(f.created_at)} – BC{" "}
                            {f.ball_control}, A {f.attitude}, overall{" "}
                            {(
                              (f.ball_control +
                                f.passing +
                                f.shooting +
                                f.fitness +
                                f.attitude +
                                f.coachability +
                                f.positioning +
                                f.speed_agility) /
                              8
                            ).toFixed(1)}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
