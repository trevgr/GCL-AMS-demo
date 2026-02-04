// app/sessions/new/NewSessionClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
  active: boolean;
};

type Props = { teams: TeamRow[] };

export default function NewSessionClient({ teams }: Props) {
  const router = useRouter();

  const [teamId, setTeamId] = useState<number>(teams[0]?.id ?? 0);
  const [sessionDate, setSessionDate] = useState<string>(() => {
    // default today (yyyy-mm-dd)
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const [sessionType, setSessionType] = useState<"training" | "match">("training");
  const [theme, setTheme] = useState<string>("");

  // Match fields
  const [opposition, setOpposition] = useState<string>("");
  const [venueType, setVenueType] = useState<"home" | "away" | "neutral">("home");
  const [venueName, setVenueName] = useState<string>("");
  const [competition, setCompetition] = useState<string>("");
  const [formation, setFormation] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === teamId) ?? teams[0],
    [teamId, teams]
  );

  const handleSubmit = async () => {
    setError(null);

    if (!teamId) {
      setError("Please select a team.");
      return;
    }
    if (!sessionDate) {
      setError("Please select a date.");
      return;
    }
    if (sessionType === "match" && opposition.trim().length === 0) {
      setError("Please enter an opposition for the match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          session_date: sessionDate,
          session_type: sessionType,
          theme: theme.trim() || null,
          match_details:
            sessionType === "match"
              ? {
                  opposition: opposition.trim(),
                  venue_type: venueType,
                  venue_name: venueName.trim() || null,
                  competition: competition.trim() || null,
                  formation: formation.trim() || null,
                }
              : null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create session");
      }

      const json = (await res.json()) as { session_id: number };
      router.replace(`/sessions/${json.session_id}?view=attendance`);
      router.refresh();
    } catch (e: any) {
      console.error("Create session error:", e);
      setError(e?.message || "Failed to create session.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border rounded-lg bg-white p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="font-medium mb-1">Team</div>
          <select
            className="w-full border rounded px-2 py-1"
            value={teamId}
            onChange={(e) => setTeamId(Number(e.target.value))}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.age_group} · {t.season}
              </option>
            ))}
          </select>
          {selectedTeam && (
            <div className="text-xs text-gray-500 mt-1">
              Selected: {selectedTeam.name} ({selectedTeam.age_group})
            </div>
          )}
        </label>

        <label className="text-sm">
          <div className="font-medium mb-1">Date</div>
          <input
            type="date"
            className="w-full border rounded px-2 py-1"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <div className="font-medium mb-1">Type</div>
          <select
            className="w-full border rounded px-2 py-1"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as any)}
          >
            <option value="training">Training</option>
            <option value="match">Match</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="font-medium mb-1">
            {sessionType === "match" ? "Theme (optional)" : "Theme (optional)"}
          </div>
          <input
            className="w-full border rounded px-2 py-1"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder={sessionType === "match" ? "e.g. Pressing triggers" : "e.g. First touch"}
          />
        </label>
      </div>

      {sessionType === "match" && (
        <div className="border-t pt-3 space-y-3">
          <div className="text-sm font-semibold">Match details</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="font-medium mb-1">Opposition *</div>
              <input
                className="w-full border rounded px-2 py-1"
                value={opposition}
                onChange={(e) => setOpposition(e.target.value)}
                placeholder="e.g. Riverview FC"
              />
            </label>

            <label className="text-sm">
              <div className="font-medium mb-1">Venue</div>
              <select
                className="w-full border rounded px-2 py-1"
                value={venueType}
                onChange={(e) => setVenueType(e.target.value as any)}
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="font-medium mb-1">Venue name (optional)</div>
              <input
                className="w-full border rounded px-2 py-1"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Pitch / stadium name"
              />
            </label>

            <label className="text-sm">
              <div className="font-medium mb-1">Competition (optional)</div>
              <input
                className="w-full border rounded px-2 py-1"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                placeholder="League / cup"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <div className="font-medium mb-1">Formation (optional)</div>
              <input
                className="w-full border rounded px-2 py-1"
                value={formation}
                onChange={(e) => setFormation(e.target.value)}
                placeholder="e.g. 2-3-1 (7s), 3-3-2 (9s), 4-3-3 (11s)"
              />
            </label>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="px-4 py-2 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </section>
  );
}
