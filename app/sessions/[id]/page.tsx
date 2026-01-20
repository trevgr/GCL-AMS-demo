// app/sessions/[id]/page.tsx
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
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
  player_id: number;
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

export default async function SessionDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await props.params;
  const { view } = await props.searchParams;
  const sessionId = Number(id);

  const activeTab: "attendance" | "development" =
    view === "development" ? "development" : "attendance";

  if (Number.isNaN(sessionId)) {
    console.error("Invalid session id:", id);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid session ID</h1>
      </main>
    );
  }

  // ---- Load session with team info ----
  const { data: session, error: sessionError } = await supabase
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

  if (sessionError || !session) {
    console.error("Error loading session:", sessionError);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Session not found</h1>
      </main>
    );
  }

  const teamId = session.team_id;

  // ---- Load players via team_players for this team ----
  const { data: teamPlayerLinks, error: teamPlayersError } = await supabase
    .from("team_players")
    .select(
      `
      player_id,
      active,
      player:players (
        id,
        name,
        dob,
        active
      )
    `
    )
    .eq("team_id", teamId)
    .or("active.is.null,active.eq.true"); // treat null active as true

  if (teamPlayersError) {
    console.error("Error loading team_players:", teamPlayersError);
  }

  const players: Player[] =
    teamPlayerLinks
      ?.map((row: any) => row.player)
      .filter((p: Player | null) => !!p) ?? [];

  // ---- Load attendance for this session ----
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("player_id, status")
    .eq("session_id", sessionId);

  if (attendanceError) {
    console.error("Error loading attendance:", attendanceError);
  }

  const initialAttendance = (attendanceRows ?? []) as AttendanceRow[];

  // ---- Load feedback for this session ----
  const { data: feedbackRows, error: feedbackError } = await supabase
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
      comments
    `
    )
    .eq("session_id", sessionId);

  if (feedbackError) {
    console.error("Error loading coach_feedback:", feedbackError);
  }

  const initialFeedback = (feedbackRows ?? []) as FeedbackRow[];

  return (
    <main className="min-h-screen space-y-4">
      {/* Header */}
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {session.team
            ? session.team.name
            : "Unknown team"}
        </h1>
        <p className="text-sm text-gray-600">
          {formatDateDDMMYYYY(session.session_date)} ·{" "}
          {session.session_type}
          {session.team && (
            <>
              {" "}
              · {session.team.age_group} · {session.team.season}
            </>
          )}
        </p>
        {session.theme && (
          <p className="text-xs text-gray-500">
            Theme: {session.theme}
          </p>
        )}

        <div className="flex gap-2 mt-2 text-xs">
          <a
            href={`/api/reports/attendance?session_id=${sessionId}`}
            className="px-3 py-1 rounded border border-slate-400 bg-white hover:bg-slate-100"
          >
            Download attendance CSV
          </a>
          <a
            href={`/api/reports/development?session_id=${sessionId}`}
            className="px-3 py-1 rounded border border-slate-400 bg-white hover:bg-slate-100"
          >
            Download development CSV
          </a>
        </div>
      </section>

      {/* Tabs (for future expansion – right now AttendanceClient handles ratings too) */}
      <section className="space-y-3">
        <div className="flex gap-2 text-sm mb-1">
          <Link
            href={`/sessions/${sessionId}?view=attendance`}
            className={`px-3 py-1 rounded border ${
              activeTab === "attendance"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Attendance & Ratings
          </Link>
          {/* you can add a separate "Development view" later if you like */}
        </div>

        <AttendanceClient
          sessionId={sessionId}
          players={players}
          initialAttendance={initialAttendance}
          initialFeedback={initialFeedback}
        />
      </section>
    </main>
  );
}
