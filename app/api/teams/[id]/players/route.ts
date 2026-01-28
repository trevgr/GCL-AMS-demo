// app/api/teams/[id]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // ✅ params is a Promise in App Router
  const { id } = await context.params;
  const teamId = Number(id);

  if (!id || Number.isNaN(teamId)) {
    return NextResponse.json(
      { error: "Invalid team_id in route." },
      { status: 400 }
    );
  }

  const { name, dob } = await req.json();

  if (!name || !dob) {
    return NextResponse.json(
      { error: "Name and DOB are required." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing in /api/teams/[id]/players");
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1) Create the player
  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .insert({
      name: String(name).trim(),
      dob, // expect "YYYY-MM-DD"
      active: true,
    })
    .select("*")
    .single();

  if (playerError || !playerRow) {
    console.error("Error inserting player:", playerError);
    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 }
    );
  }

  // 2) Link the player to this team
  const { error: linkError } = await supabase.from("team_players").insert({
    team_id: teamId,
    player_id: playerRow.id,
    active: true,
  });

  if (linkError) {
    console.error("Error linking player to team:", linkError);
    // You might decide to keep the player anyway, but report the problem
    return NextResponse.json(
      { error: "Player created but failed to link to team" },
      { status: 500 }
    );
  }

  // 3) Return the new player to the client
  return NextResponse.json(
    {
      id: playerRow.id,
      name: playerRow.name,
      dob: playerRow.dob,
      active: playerRow.active,
    },
    { status: 201 }
  );
}
