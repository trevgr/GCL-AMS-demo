// app/sessions/[id]/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: {
    id: number;
    name: string;
    age_group: string;
    season: string;
  } | null;
};

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type AttendanceRow = {
  player_id: number;
  status: "present" | "absent";
};

type FeedbackRow = {
  id: number;
  player_id: number;
  session_id: number;
  coach_id: string | null;
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

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function SessionDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const supabase = await createServerSupabaseClient(); // ✅ server-side client

  const { id } = await props.params;
  const { view } = await props.searchParams;

  const sessionId = Number(id);
  if (Number.isNaN(sessionId)) {
    console.error("Invalid session id:", id);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid session ID</h1>
      </main>
    );
  }

  const activeTab: "attendance" | "development" =
    view === "development" ? "development" : "attendance";

  // ---- Load session with team ----
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select(
      `
      id,
      team_id,
      session_date,
      session_type,
      theme,
      team:teams (
        id,
        name,
        age_group,
        season
      )
    `
    )
    .eq("id", sessionId)
    .single<SessionRow>();

  if (sessionError || !sessionRow) {
    console.error("Error loading session:", sessionError);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Session not found</h1>
      </main>
    );
  }

  const team = sessionRow.team;

  // ---- Load players for this session's team via team_players ----
  let players: Player[] = [];
  if (team) {
    const { data: teamPlayersRows, error: teamPlayersError } = await supabase
      .from("team_players")
      .select(
        `
        player:players (
          id,
          name,
          dob,
          active
        )
      `
      )
      .eq("team_id", team.id)
      .eq("active", true);

    if (teamPlayersError) {
      console.error("Error loading players for team:", teamPlayersError);
    }

    players =
      teamPlayersRows
        ?.map((row: any) => row.player as Player | null)
        .filter((p: Player | null) => p != null) ?? [];
  }

  // ---- Attendance rows for this session ----
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("player_id, status")
    .eq("session_id", sessionId);

  if (attendanceError) {
    console.error("Error loading attendance:", attendanceError);
  }

  const typedAttendance = (attendanceRows ?? []) as AttendanceRow[];

  // ---- Coach feedback for this session (all coaches) ----
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("coach_feedback")
    .select(
      `
      id,
      player_id,
      session_id,
      coach_id,
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
    .eq("session_id", sessionId);

  if (feedbackError) {
    console.error("Error loading coach feedback:", feedbackError);
  }

  const initialFeedback = (feedbackRows ?? []) as FeedbackRow[];

  // ---- Build "how many coaches have rated this player" map ----
  const coachCounts: Record<number, number> = {};
  const seenPerPlayer = new Map<number, Set<string>>();

  for (const row of initialFeedback) {
    if (!row.coach_id) continue; // old rows without coach_id
    if (!seenPerPlayer.has(row.player_id)) {
      seenPerPlayer.set(row.player_id, new Set());
    }
    seenPerPlayer.get(row.player_id)!.add(row.coach_id);
  }

  for (const [playerId, set] of seenPerPlayer.entries()) {
    coachCounts[playerId] = set.size;
  }

  return (
    <main className="min-h-screen space-y-4">
      {/* Header */}
      <section className="border-b pb-2">
        <h1 className="text-2xl font-bold mb-1">
          {team ? team.name : "Unknown team"}
        </h1>
        <p className="text-gray-700 text-sm">
          {formatDateDDMMYYYY(sessionRow.session_date)} ·{" "}
          {sessionRow.session_type}
        </p>
        {team && (
          <p className="text-gray-600 text-xs">
            {team.age_group} · {team.season}
          </p>
        )}
        {sessionRow.theme && (
          <p className="text-gray-500 text-xs mt-1">
            Theme: {sessionRow.theme}
          </p>
        )}
        <div className="mt-2 text-xs">
          <Link href="/sessions" className="text-blue-600 hover:underline">
            ← Back to sessions
          </Link>
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 text-sm mb-3">
          <Link
            href={`/sessions/${sessionId}?view=attendance`}
            className={`px-3 py-1 rounded border ${
              activeTab === "attendance"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Attendance &amp; ratings
          </Link>
          <Link
            href={`/sessions/${sessionId}?view=development`}
            className={`px-3 py-1 rounded border ${
              activeTab === "development"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Development summary
          </Link>
        </div>

        {activeTab === "attendance" && (
          <AttendanceClient
            sessionId={sessionId}
            players={players}
            initialAttendance={typedAttendance}
            initialFeedback={initialFeedback}
            coachCounts={coachCounts}
          />
        )}

        {activeTab === "development" && (
          <section className="text-sm text-gray-600">
            <p>
              Development summary for this session will use all coach ratings
              and is visible on the main{" "}
              <Link
                href="/reports?view=development"
                className="text-blue-600 hover:underline"
              >
                Reports &raquo; Development dashboard
              </Link>{" "}
              page.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
