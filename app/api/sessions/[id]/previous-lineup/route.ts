import { createServerSupabaseClient } from "../../../../../lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sessionId = Number(id);

    const supabase = await createServerSupabaseClient();

    // Get current session's team
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("team_id, session_date")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get previous match session for same team
    const { data: previousSession, error: prevSessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("team_id", session.team_id)
      .eq("session_type", "match")
      .lt("session_date", session.session_date)
      .order("session_date", { ascending: false })
      .limit(1)
      .single();

    if (prevSessionError || !previousSession) {
      return NextResponse.json([], { status: 200 });
    }

    // Get lineup from previous session
    const { data: lineup, error: lineupError } = await supabase
      .from("match_lineups")
      .select("*")
      .eq("session_id", previousSession.id);

    if (lineupError) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(lineup || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}