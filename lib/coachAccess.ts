// lib/coachAccess.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type CoachWithTeams = {
  coachId: number;
  role: "coach" | "director" | "admin";
  teamIds: number[];
};

/**
 * Given a Supabase *server* client and the current auth user id,
 * return which teams this coach can see.
 */
export async function getCoachAccessForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CoachWithTeams | null> {
  // 1) Find the coach row linked to this auth user
  const { data: coachRows, error: coachError } = await supabase
    .from("coaches")
    .select("id, role")
    .eq("auth_user_id", userId)
    .limit(1);

  if (coachError || !coachRows || coachRows.length === 0) {
    console.error("Coach not found for auth user:", userId, coachError);
    return null;
  }

  const coach = coachRows[0] as { id: number; role: string };

  // 2) Director/admin → can see all teams
  if (coach.role === "director" || coach.role === "admin") {
    const { data: allTeams, error: teamsError } = await supabase
      .from("teams")
      .select("id");

    if (teamsError || !allTeams) {
      console.error("Error loading all teams for director/admin:", teamsError);
      return null;
    }

    return {
      coachId: coach.id,
      role: coach.role as "director" | "admin" | "coach",
      teamIds: allTeams.map((t: any) => t.id as number),
    };
  }

  // 3) Normal coach → only teams in coach_team_assignments
  const { data: assignments, error: assignError } = await supabase
    .from("coach_team_assignments")
    .select("team_id")
    .eq("coach_id", coach.id);

  if (assignError || !assignments) {
    console.error("Error loading coach assignments:", assignError);
    return null;
  }

  return {
    coachId: coach.id,
    role: coach.role as "coach",
    teamIds: assignments.map((a: any) => a.team_id as number),
  };
}
