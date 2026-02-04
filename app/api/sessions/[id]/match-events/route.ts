import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

type SupabaseClientLike = any;

async function canWriteSessionTeam(
  supabase: SupabaseClientLike,
  userId: string,
  teamId: number
): Promise<{ ok: true; reason: string } | { ok: false; reason: string }> {
  // 1) Global director? (directors table)
  const { data: directorRow, error: directorErr } = await supabase
    .from("directors")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (directorErr) console.error("authz(match-events): directors lookup error", directorErr);
  if (directorRow) return { ok: true, reason: "global_director" };

  // 2) Coach row
  const { data: coachRow, error: coachErr } = await supabase
    .from("coaches")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (coachErr) console.error("authz(match-events): coaches lookup error", coachErr);
  if (!coachRow) return { ok: false, reason: "no_coach_row" };

  // 3) Assignment for this team
  const { data: assignmentRow, error: assignErr } = await supabase
    .from("coach_team_assignments")
    .select("team_id, role")
    .eq("coach_id", coachRow.id)
    .eq("team_id", teamId)
    .maybeSingle();

  if (assignErr)
    console.error("authz(match-events): coach_team_assignments lookup error", assignErr);

  const allowedRoles = new Set(["coach", "assistant", "admin", "director"]);
  const role = assignmentRow?.role ? String(assignmentRow.role) : null;

  if (!role) return { ok: false, reason: "no_assignment_row" };
  if (!allowedRoles.has(role))
    return { ok: false, reason: `role_not_allowed:${role}` };

  return { ok: true, reason: `allowed_role:${role}` };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user)
    return new Response("Not authenticated", { status: 401 });

  const { id } = await context.params;
  const sessionId = Number(id);

  if (Number.isNaN(sessionId)) {
    return new Response("Invalid session id", { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.event_type) {
    return new Response("Invalid body", { status: 400 });
  }

  // Load session for team_id permission check
  const { data: sessRow, error: sessErr } = await supabase
    .from("sessions")
    .select("team_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessErr) {
    console.error("Match events: failed to load session", sessErr);
    return new Response("Failed to load session", { status: 500 });
  }

  if (!sessRow) return new Response("Session not found", { status: 404 });

  const teamId = Number(sessRow.team_id);

  console.log("Match events: request", { userId: user.id, sessionId, teamId });

  // Check authorization
  const authz = await canWriteSessionTeam(supabase, user.id, teamId);
  console.log("Match events: authz", authz);

  if (!authz.ok) {
    return new Response(`Forbidden: ${authz.reason}`, { status: 403 });
  }

  // Validate event payload
  const validEventTypes = ["goal", "yellow_card", "red_card", "substitution"];
  if (!validEventTypes.includes(body.event_type)) {
    return new Response("Invalid event_type", { status: 400 });
  }

  if (!body.player_id || Number.isNaN(Number(body.player_id))) {
    return new Response("Invalid player_id", { status: 400 });
  }

  if (Number.isNaN(Number(body.minute))) {
    return new Response("Invalid minute", { status: 400 });
  }

  // Update: Validate goal_type if event_type is 'goal'
  if (body.event_type === "goal" && !body.goal_type) {
    return new Response("goal_type required for goals (scored or conceded)", {
      status: 400,
    });
  }

  if (body.goal_type && !["scored", "conceded"].includes(body.goal_type)) {
    return new Response("Invalid goal_type: must be 'scored' or 'conceded'", {
      status: 400,
    });
  }

  // Update: Validate substitution fields if event_type is 'substitution'
  if (body.event_type === "substitution") {
    if (!body.player_id) {
      return new Response("player_id required for substitutions", { status: 400 });
    }
    if (!body.player_off_id) {
      return new Response("player_off_id required for substitutions", { status: 400 });
    }
    if (!["injury", "tactical", "yellow_card", "fatigue", "other"].includes(body.sub_reason)) {
      return new Response("Invalid sub_reason", { status: 400 });
    }
  }

  // Add validation for goal_context in the POST handler:
  if (body.event_type === "goal" && body.goal_type) {
    if (!body.goal_context || !["open_play", "free_kick", "corner", "penalty", "other"].includes(body.goal_context)) {
      return new Response("Invalid goal_context: must be one of open_play, free_kick, corner, penalty, other", {
        status: 400,
      });
    }
  }

  // Insert match event
  const { error: insertError } = await supabase.from("match_events").insert([
    {
      session_id: sessionId,
      event_type: body.event_type,
      player_id: body.player_id,
      team_id: body.team_id,
      minute: body.minute,
      assisting_player_id: body.assisting_player_id || null,
      is_own_goal: body.is_own_goal || false,
      notes: body.notes || null,
      created_by: user.id,
      goal_type: body.event_type === "goal" ? body.goal_type : null, // Update: Add goal_type to insert payload
      player_off_id: body.event_type === "substitution" ? body.player_off_id : null,
      sub_reason: body.event_type === "substitution" ? body.sub_reason : null,
      goal_context: body.event_type === "goal" ? body.goal_context : null, // Add goal_context to insert payload
    },
  ]);

  if (insertError) {
    console.error("Match events: insert error", insertError);
    const status = insertError.code === "42501" ? 403 : 500;
    return new Response(insertError.message || "Failed to save event", {
      status,
    });
  }

  return new Response("OK", { status: 200 });
}

// GET endpoint to fetch existing events for a session
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user)
    return new Response("Not authenticated", { status: 401 });

  const { id } = await context.params;
  const sessionId = Number(id);

  if (Number.isNaN(sessionId)) {
    return new Response("Invalid session id", { status: 400 });
  }

  // FIX: Use explicit relationship aliases to disambiguate
  const { data, error } = await supabase
    .from("match_events")
    .select(
      `
      id,
      event_type,
      player_id,
      team_id,
      minute,
      is_own_goal,
      notes,
      created_at,
      player:player_id(id, name),
      assisting_player:assisting_player_id(id, name)
    `
    )
    .eq("session_id", sessionId)
    .order("minute", { ascending: true });

  if (error) {
    console.error("Match events: fetch error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data || []), {
    headers: { "Content-Type": "application/json" },
  });
}