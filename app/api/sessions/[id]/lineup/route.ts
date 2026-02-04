// app/api/sessions/[id]/lineup/route.ts
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

    const { data, error } = await supabase
      .from("match_lineups")
      .select("*")
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sessionId = Number(id);
    const { lineup } = await req.json();

    const supabase = await createServerSupabaseClient();

    // Delete existing lineup for this session
    await supabase
      .from("match_lineups")
      .delete()
      .eq("session_id", sessionId);

    // Insert new lineup
    const { data, error } = await supabase
      .from("match_lineups")
      .insert(
        lineup.map((player: any) => ({
          session_id: sessionId,
          player_id: player.player_id,
          role: player.role,
          position: player.position,
          shirt_number: player.shirt_number,
          is_captain: player.is_captain,
        }))
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
