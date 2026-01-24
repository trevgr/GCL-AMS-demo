"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

type Props = {
  teams: TeamRow[];
};

const SESSION_TYPES = [
  "Training",
  "Match",
  "Friendly",
  "Fitness",
  "Other",
];

export default function NewSessionClient({ teams }: Props) {
  const router = useRouter();

  const defaultTeamId =
    teams.length > 0 ? String(teams[0].id) : "";

  const [teamId, setTeamId] = useState(defaultTeamId);
  const [date, setDate] = useState("");
  const [sessionType, setSessionType] = useState("Training");
  const [theme, setTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!teamId) {
      setError("Please select a team.");
      return;
    }
    if (!date) {
      setError("Please choose a date.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("sessions").insert({
      team_id: Number(teamId),
      session_date: date,
      session_type: sessionType || "Training",
      theme: theme.trim() || null,
    });

    if (error) {
      console.error("Error creating session:", error);
      setError("Failed to create session. Please try again.");
      setSaving(false);
      return;
    }

    // On success: go back to sessions list
    router.push("/sessions");
    router.refresh();
  };

  const handleCancel = () => {
    router.push("/sessions");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {teams.length === 0 && (
        <p className="text-sm text-red-600">
          There are no teams yet. Create a team before planning sessions.
        </p>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Team<span className="text-red-500">*</span>
        </label>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="border rounded px-2 py-1 w-full text-sm"
          disabled={teams.length === 0 || saving}
        >
          {teams.length === 0 ? (
            <option value="">No teams available</option>
          ) : (
            teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.age_group} · {t.season}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Date<span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1 w-full text-sm"
          disabled={saving}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Session type<span className="text-red-500">*</span>
        </label>
        <select
          value={sessionType}
          onChange={(e) => setSessionType(e.target.value)}
          className="border rounded px-2 py-1 w-full text-sm"
          disabled={saving}
        >
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          e.g. Training, Match, Friendly, Fitness.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Theme / focus (optional)
        </label>
        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="border rounded px-2 py-1 w-full text-sm"
          placeholder="e.g. Playing out from the back"
          disabled={saving}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 rounded border border-slate-300 text-sm"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
          disabled={saving || teams.length === 0}
        >
          {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </form>
  );
}
