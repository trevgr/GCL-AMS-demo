// app/sessions/[id]/page.tsx
import { supabase } from "../../../lib/supabaseClient";
import AttendanceClient from "./AttendanceClient";

type Team = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

type Session = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
};

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type AttendanceRecord = {
  player_id: number;
  status: "present" | "absent";
};

export default async function SessionAttendancePage(props: {
  params: Promise<{ id: string }>;
}) {
  // Next 16: params is a Promise in async components
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

  // Load session with basic fields
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single<Session>();

  if (sessionError || !session) {
    console.error("Error loading session:", sessionError);
    return (
      <main className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Session not found</h1>
      </main>
    );
  }

  // Load team info for context
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", session.team_id)
    .single<Team>();

  if (teamError || !team) {
    console.error("Error loading team:", teamError);
  }

  // Load players assigned to this team
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

  // Load existing attendance for this session
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("player_id, status")
    .eq("session_id", sessionId);

  if (attendanceError) {
    console.error("Error loading attendance:", attendanceError);
  }

  const initialAttendance: AttendanceRecord[] =
    (attendance as AttendanceRecord[]) ?? [];

  return (
    <main className="min-h-screen p-4 space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-1">
          {team ? team.name : "Session"}
        </h1>
        <p className="text-gray-600">
          {team ? `${team.age_group} · ${team.season}` : ""}
        </p>
        <p className="text-gray-600">
          {new Date(session.session_date).toLocaleDateString()} ·{" "}
          {session.session_type}
          {session.theme ? ` · ${session.theme}` : ""}
        </p>
      </section>

      <AttendanceClient
        sessionId={sessionId}
        players={players}
        initialAttendance={initialAttendance}
      />
    </main>
  );
}
