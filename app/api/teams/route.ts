import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");

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