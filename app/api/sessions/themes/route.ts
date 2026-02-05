import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get distinct themes from sessions table, ordered alphabetically
    const { data, error } = await supabase
      .from("sessions")
      .select("theme")
      .not("theme", "is", null)
      .order("theme", { ascending: true });

    if (error) {
      console.error("Error fetching themes:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Extract unique themes
    const themes = [...new Set(
      (data ?? [])
        .map((row: any) => row.theme)
        .filter((t: string | null) => t !== null && t.trim() !== "")
    )].sort();

    console.log("Available themes:", themes);

    return NextResponse.json(themes);
  } catch (err) {
    console.error("themes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}