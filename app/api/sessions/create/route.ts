// app/api/sessions/create/route.ts
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

type SupabaseClientLike = any;

async function canCreateForTeam(
  supabase: SupabaseClientLike,
  userId: string,
  teamId: number
): Promise<{ ok: true; reason: string } | { ok: false; reason: string }> {
  console.log("canCreateForTeam:start", { userId, teamId });

  // 1) Global director? (directors table)
  const { data: directorRow, error: directorErr } = await supabase
    .from("directors")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (directorErr) console.error("authz: directors lookup error", directorErr);
  console.log("canCreateForTeam:directorRow", !!directorRow);

  if (directorRow) return { ok: true, reason: "global_director" };

  // 2) Coach row for this auth user?
  const { data: coachRow, error: coachErr } = await supabase
    .from("coaches")
    .select("id, auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (coachErr) console.error("authz: coaches lookup error", coachErr);
  console.log("canCreateForTeam:coachRow", coachRow);

  if (!coachRow) return { ok: false, reason: "no_coach_row" };

  // 3) Team assignment role check (team-scoped director counts as coach permissions too)
  const { data: assignmentRow, error: assignErr } = await supabase
    .from("coach_team_assignments")
    .select("team_id, role")
    .eq("coach_id", coachRow.id)
    .eq("team_id", teamId)
    .maybeSingle();

  if (assignErr)
    console.error("authz: coach_team_assignments lookup error", assignErr);

  console.log("canCreateForTeam:assignmentRow", assignmentRow);

  // Allowed roles for creating sessions/matches
  const allowedRoles = new Set(["coach", "assistant", "admin", "director"]);
  const role = assignmentRow?.role ? String(assignmentRow.role) : null;

  if (!role) return { ok: false, reason: "no_assignment_row" };
  if (!allowedRoles.has(role))
    return { ok: false, reason: `role_not_allowed:${role}` };

  return { ok: true, reason: `allowed_role:${role}` };
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) console.error("create session: auth error", userError);

  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return new Response("Invalid JSON body", { status: 400 });

  const teamId = Number(body.team_id);
  const sessionDate = String(body.session_date || "");
  const sessionType = String(body.session_type || "").toLowerCase();

  if (!teamId || Number.isNaN(teamId)) {
    return new Response("Invalid team_id", { status: 400 });
  }
  if (!sessionDate) {
    return new Response("Missing session_date", { status: 400 });
  }
  if (sessionType !== "training" && sessionType !== "match") {
    return new Response("Invalid session_type", { status: 400 });
  }

  console.log("create session: request", {
    userId: user.id,
    teamId,
    sessionType,
    sessionDate,
  });

  // ✅ Authorization check BEFORE inserting anything
  const authz = await canCreateForTeam(supabase, user.id, teamId);
  console.log("create session: authz", authz);

  if (!authz.ok) {
    return new Response(`Forbidden: ${authz.reason}`, { status: 403 });
  }

  // 1) Create session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      session_date: sessionDate,
      session_type: sessionType,
      theme: body.theme ?? null,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("create session: insert error", sessionError);
    const status = sessionError?.code === "42501" ? 403 : 500;
    // Plain text so your client (res.text()) shows it cleanly
    return new Response(sessionError?.message || "Failed to create session", {
      status,
    });
  }

  const sessionId = session.id as number;

  // 2) If match, create match_details
  if (sessionType === "match") {
    const md = body.match_details ?? {};
    const opposition = String(md.opposition || "").trim();

    if (!opposition) {
      // rollback session for cleanliness
      await supabase.from("sessions").delete().eq("id", sessionId);
      return new Response("Match opposition is required", { status: 400 });
    }

    const { error: mdError } = await supabase.from("match_details").insert({
      session_id: sessionId,
      opposition,
      venue_type: md.venue_type ?? "home",
      venue_name: md.venue_name ?? null,
      competition: md.competition ?? null,
      formation: md.formation ?? null,
      goals_for: 0,
      goals_against: 0,
      notes: null,
    });

    if (mdError) {
      console.error("create session: match_details insert error", mdError);

      // rollback session (best effort)
      await supabase.from("sessions").delete().eq("id", sessionId);

      const status = mdError.code === "42501" ? 403 : 400;
      // Plain text so your client (res.text()) shows it cleanly
      return new Response(
        mdError.message || "Failed to create match details",
        { status }
      );
    }
  }

  return Response.json({ session_id: sessionId }, { status: 200 });
}
