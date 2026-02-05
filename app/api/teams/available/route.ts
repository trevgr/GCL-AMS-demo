// app/api/teams/available/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";
import { getCoachAccessForUser } from "../../../../lib/coachAccess";

export const dynamic = "force-dynamic";

type TeamRow = { id: number; name: string };

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getCoachAccessForUser(supabase as any, user.id);
    const teamIds: number[] = access?.teamIds ?? [];

    if (!teamIds || teamIds.length === 0) {
      return NextResponse.json([] satisfies TeamRow[], { headers: { "Cache-Control": "no-store" } });
    }

    const { data, error } = await supabase
      .from("teams")
      .select("id,name")
      .in("id", teamIds)
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const teams: TeamRow[] = (data ?? []).map((t: any) => ({
      id: Number(t.id),
      name: String(t.name),
    }));

    return NextResponse.json(teams, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
