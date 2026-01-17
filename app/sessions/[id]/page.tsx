// app/sessions/[id]/page.tsx
import { supabase } from "../../../lib/supabaseClient";
import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";

type Team = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

type SessionRow = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: Team | null;
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

export default async function SessionAttendancePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const sessionId = Number(id);

  if (Number.isNaN(sessionId)) {
    console.error("Invalid session id:", id);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Invalid session ID</h1>
      </main>
    );
  }

  // Load session + team
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

  // Load players in this team
  const { data: assignments, error: playersError } = await supabase
    .from("player_team_assignments")
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
    .eq("team_id", session.team_id);

  if (playersError) {
    console.error("Error loading players for team:", playersError);
  }

  const players: Player[] =
    assignments?.map((row: any) => row.player).filter(Boolean) ?? [];

  // Load attendance for this session
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("player_id, status")
    .eq("session_id", sessionId);

  if (attendanceError) {
    console.error("Error loading attendance:", attendanceError);
  }

  const attendance = (attendanceRows ?? []) as AttendanceRow[];

  // Load feedback for this session
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
    console.error("Error loading feedback for session:", feedbackError);
  }

  const feedback = (feedbackRows ?? []) as FeedbackRow[];

  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-1">
          {session.team?.name ?? "Session"}
        </h1>
        <p className="text-gray-600 text-sm">
          {formatDateDDMMYYYY(session.session_date)} ·{" "}
          {session.session_type}
        </p>
        {session.theme && (
          <p className="text-gray-600 text-sm">Theme: {session.theme}</p>
        )}
      </section>

      <AttendanceClient
        sessionId={sessionId}
        players={players}
        initialAttendance={attendance}
        initialFeedback={feedback}
      />
    </main>
  );
}
