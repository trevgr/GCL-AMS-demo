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
      .from("match_details")
      .select("*")
      .eq("session_id", sessionId)
      .single();

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