// app/players/[id]/page.tsx
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import FeedbackClient from "./FeedbackClient";

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type TeamAssignment = {
  team_id: number;
  team_name: string;
  age_group: string;
  season: string;
};

type AttendanceRow = {
  status: "present" | "absent";
  session: {
    session_date: string;
    session_type: string;
  } | null;
};

type FeedbackRow = {
  id: number;
  created_at: string;
  ball_control: number;
  passing: number;
  shooting: number;
  fitness: number;
  attitude: number;
  coachability: number;
  positioning: number;
  speed_agility: number;
  comments: string | null;
};

type FeedbackSummary = {
  avg_ball_control: number | null;
  avg_passing: number | null;
  avg_shooting: number | null;
  avg_fitness: number | null;
  avg_attitude: number | null;
  avg_coachability: number | null;
  avg_positioning: number | null;
  avg_speed_agility: number | null;
};

// Deterministic date formatting
function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function PlayerDetail(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const playerId = Number(id);

  if (Number.isNaN(playerId)) {
    console.error("Invalid player id:", id);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid player ID</h1>
      </main>
    );
  }

  // Load player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single<Player>();

  if (playerError || !player) {
    console.error(playerError);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Player not found</h1>
      </main>
    );
  }

  // Load teams this player is/was assigned to
  const { data: assignments, error: assignmentsError } = await supabase
    .from("player_team_assignments")
    .select(
      `
      team:teams (
        id,
        name,
        age_group,
        season
      )
    `
    )
    .eq("player_id", playerId);

  if (assignmentsError) {
    console.error(assignmentsError);
  }

  const teams: TeamAssignment[] =
    assignments
      ?.map((row: any) => ({
        team_id: row.team?.id,
        team_name: row.team?.name,
        age_group: row.team?.age_group,
        season: row.team?.season,
      }))
      .filter((t) => t.team_id != null) ?? [];

  // Load attendance for this player, joined with sessions
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select(
      `
      status,
      session:sessions (
        session_date,
        session_type
      )
    `
    )
    .eq("player_id", playerId);

  if (attendanceError) {
    console.error("Error loading attendance for player:", attendanceError);
  }

  const typedAttendance = (attendanceRows ?? []) as AttendanceRow[];

  let trainingSessions = 0;
  let trainingAttended = 0;

  for (const row of typedAttendance) {
    if (row.session && row.session.session_type === "training") {
      trainingSessions += 1;
      if (row.status === "present") {
        trainingAttended += 1;
      }
    }
  }

  // Load feedback for this player
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("coach_feedback")
    .select(
      `
      id,
      created_at,
      ball_control,
      passing,
      shooting,
      fitness,
      attitude,
      coachability,
      positioning,
      speed_agility,
      comments
    `
    )
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (feedbackError) {
    console.error("Error loading coach feedback:", feedbackError);
  }

  const typedFeedback = (feedbackRows ?? []) as FeedbackRow[];

  // Compute averages
  const summary: FeedbackSummary = {
    avg_ball_control: null,
    avg_passing: null,
    avg_shooting: null,
    avg_fitness: null,
    avg_attitude: null,
    avg_coachability: null,
    avg_positioning: null,
    avg_speed_agility: null,
  };

  if (typedFeedback.length > 0) {
    const n = typedFeedback.length;
    summary.avg_ball_control =
      typedFeedback.reduce((sum, f) => sum + f.ball_control, 0) / n;
    summary.avg_passing =
      typedFeedback.reduce((sum, f) => sum + f.passing, 0) / n;
    summary.avg_shooting =
      typedFeedback.reduce((sum, f) => sum + f.shooting, 0) / n;
    summary.avg_fitness =
      typedFeedback.reduce((sum, f) => sum + f.fitness, 0) / n;
    summary.avg_attitude =
      typedFeedback.reduce((sum, f) => sum + f.attitude, 0) / n;
    summary.avg_coachability =
      typedFeedback.reduce((sum, f) => sum + f.coachability, 0) / n;
    summary.avg_positioning =
      typedFeedback.reduce((sum, f) => sum + f.positioning, 0) / n;
    summary.avg_speed_agility =
      typedFeedback.reduce((sum, f) => sum + f.speed_agility, 0) / n;

    // Round to 1 decimal for display
    (Object.keys(summary) as (keyof FeedbackSummary)[]).forEach((k) => {
      const v = summary[k];
      if (typeof v === "number") {
        summary[k] = Math.round(v * 10) / 10;
      }
    });
  }

  const recentFeedback = typedFeedback.slice(0, 5);

  return (
    <main className="min-h-screen space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-2">{player.name}</h1>
        <p className="text-gray-600 mb-1">
          Date of birth: {formatDateDDMMYYYY(player.dob)}
        </p>
        <p className="text-gray-600">
          Status: {player.active ? "Active" : "Inactive"}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Attendance summary</h2>
        {trainingSessions === 0 ? (
          <p>No training sessions recorded yet.</p>
        ) : (
          <p>
            Training sessions attended:{" "}
            <span className="font-semibold">
              {trainingAttended} / {trainingSessions}
            </span>
          </p>
        )}
      </section>

      {/* NEW: coach feedback */}
      <FeedbackClient
        playerId={playerId}
        summary={summary}
        recent={recentFeedback}
      />

      <section>
        <h2 className="text-xl font-semibold mb-2">Teams</h2>
        {teams.length === 0 ? (
          <p>No team assignments yet.</p>
        ) : (
          <ul className="space-y-1">
            {teams.map((t) => (
              <li key={t.team_id} className="border rounded px-3 py-2">
                <Link
                  href={`/teams/${t.team_id}`}
                  className="block hover:bg-slate-50"
                >
                  <div className="font-medium">{t.team_name}</div>
                  <div className="text-sm text-gray-600">
                    {t.age_group} · {t.season}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
