// app/sessions/[id]/MatchEventClient.tsx
"use client";

import { useEffect, useState } from "react";

type MatchEvent = {
  id?: number;
  session_id: number;
  event_type: "goal" | "yellow_card" | "red_card" | "substitution";
  goal_type?: "scored" | "conceded" | null;
  goal_context?: "open_play" | "free_kick" | "corner" | "penalty" | "other" | null;
  player_id: number | null;
  player_off_id?: number | null;
  sub_reason?: "injury" | "tactical" | "yellow_card" | "fatigue" | "other" | null;
  team_id: number;
  minute: number;
  assisting_player_id: number | null;
  is_own_goal: boolean;
  notes: string | null;
};

type Props = {
  sessionId: number;
  players: Array<{ id: number; name: string; team_id: number }>;
  teams: Array<{ id: number; name: string }>;
  lineupComplete?: boolean;
  currentMinute?: number;
};

const SUB_REASONS = [
  { value: "injury", label: "🏥 Injury" },
  { value: "tactical", label: "🎯 Tactical" },
  { value: "yellow_card", label: "🟨 Already on yellow" },
  { value: "fatigue", label: "😫 Fatigue" },
  { value: "other", label: "📝 Other" },
];

const GOAL_CONTEXTS = [
  { value: "open_play", label: "⚽ Open play" },
  { value: "free_kick", label: "🎯 Free kick" },
  { value: "corner", label: "🪝 Corner" },
  { value: "penalty", label: "⚪ Penalty" },
  { value: "other", label: "📝 Other" },
];

export default function MatchEventClient({ 
  sessionId, 
  players, 
  teams,
  lineupComplete = true,
  currentMinute = 0,
}: Props) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [minute, setMinute] = useState(currentMinute);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [playerOffId, setPlayerOffId] = useState<number | null>(null);
  const [eventType, setEventType] = useState<"goal" | "yellow_card" | "red_card" | "substitution">("goal");
  const [goalType, setGoalType] = useState<"scored" | "conceded">("scored");
  const [goalContext, setGoalContext] = useState<"open_play" | "free_kick" | "corner" | "penalty" | "other">("open_play");
  const [subReason, setSubReason] = useState<"injury" | "tactical" | "yellow_card" | "fatigue" | "other">("tactical");
  const [assistingPlayer, setAssistingPlayer] = useState<number | null>(null);
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update minute from parent (timer)
  useEffect(() => {
    setMinute(currentMinute);
  }, [currentMinute]);

  // Load existing events from database on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/match-events`);
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
        }
      } catch (err) {
        console.error("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [sessionId]);

  const handleAddEvent = async () => {
    setError(null);

    // Validate based on event type
    if (eventType === "goal") {
      if (goalType === "scored" && !selectedPlayer) {
        setError("Player required for scored goals");
        return;
      }
      if (goalType === "scored" && !assistingPlayer && !isOwnGoal) {
        setError("Assist player required for regular goals");
        return;
      }
    } else if (eventType === "substitution") {
      if (!selectedPlayer) {
        setError("Player coming on required");
        return;
      }
      if (!playerOffId) {
        setError("Player going off required");
        return;
      }
    } else {
      if (!selectedPlayer) {
        setError("Player required for this event");
        return;
      }
    }

    setSaving(true);

    const payload = {
      session_id: sessionId,
      event_type: eventType,
      goal_type: eventType === "goal" ? goalType : null,
      goal_context: eventType === "goal" ? goalContext : null,
      player_id: eventType === "goal" && goalType === "conceded" ? null : selectedPlayer,
      player_off_id: eventType === "substitution" ? playerOffId : null,
      sub_reason: eventType === "substitution" ? subReason : null,
      team_id: selectedTeam,
      minute: minute,
      assisting_player_id: eventType === "goal" && goalType === "scored" ? assistingPlayer : null,
      is_own_goal: isOwnGoal,
      notes: notes || null,
    };

    try {
      const response = await fetch(`/api/sessions/${sessionId}/match-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const msg = await response.text();
        setError(`Failed to save event: ${msg}`);
        return;
      }

      // Clear form
      setSelectedPlayer(null);
      setPlayerOffId(null);
      setAssistingPlayer(null);
      setIsOwnGoal(false);
      setNotes("");
      setGoalType("scored");
      setGoalContext("open_play");
      setSubReason("tactical");

      // Add to local events list
      setEvents((prev) => [...prev, payload as MatchEvent]);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const playersForTeam = selectedTeam
    ? players.filter((p) => p.team_id === selectedTeam)
    : [];

  if (!teams || !Array.isArray(teams)) {
    return (
      <div className="text-red-600 p-4 border border-red-300 rounded bg-red-50">
        Error: Teams data not available
      </div>
    );
  }

  if (!lineupComplete) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <div className="text-lg font-semibold text-amber-900 mb-2">⚠️ Lineup Not Complete</div>
        <p className="text-sm text-amber-800">
          Please complete the lineup in the <strong>Lineup tab</strong> before logging match events.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Event Form */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h3 className="font-bold text-lg">Log Match Event</h3>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Minute Display (from timer) */}
        <div className="bg-slate-100 rounded p-2 text-center">
          <div className="text-xs text-gray-600">Current minute</div>
          <div className="text-2xl font-bold">{String(minute).padStart(2, "0")}:00</div>
        </div>

        {/* Event Type */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Event type</span>
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value as any);
              setSelectedPlayer(null);
              setPlayerOffId(null);
              setAssistingPlayer(null);
              setIsOwnGoal(false);
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="goal">⚽ Goal</option>
            <option value="yellow_card">🟨 Yellow card</option>
            <option value="red_card">🔴 Red card</option>
            <option value="substitution">🔄 Substitution</option>
          </select>
        </label>

        {/* Goal Type (only for goals) */}
        {eventType === "goal" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Goal type</span>
            <div className="flex gap-2">
              <button
                onClick={() => setGoalType("scored")}
                className={`flex-1 px-3 py-2 rounded border-2 text-sm font-medium transition ${
                  goalType === "scored"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-green-600"
                }`}
              >
                ✅ Goal Scored
              </button>
              <button
                onClick={() => setGoalType("conceded")}
                className={`flex-1 px-3 py-2 rounded border-2 text-sm font-medium transition ${
                  goalType === "conceded"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-red-600"
                }`}
              >
                ❌ Goal Conceded
              </button>
            </div>
          </label>
        )}

        {/* Goal Context (for all goals) */}
        {eventType === "goal" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">How was the goal scored?</span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {GOAL_CONTEXTS.map((context) => (
                <button
                  key={context.value}
                  onClick={() => setGoalContext(context.value as any)}
                  className={`px-2 py-2 rounded border text-xs font-medium transition ${
                    goalContext === context.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-gray-700 border-gray-300 hover:border-slate-900"
                  }`}
                >
                  {context.label}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Team */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Team</span>
          <select
            value={selectedTeam ?? ""}
            onChange={(e) => {
              setSelectedTeam(Number(e.target.value) || null);
              setSelectedPlayer(null);
              setPlayerOffId(null);
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Select team</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {/* Player (conditional based on event type and goal type) */}
        {eventType !== "goal" || goalType === "scored" ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {eventType === "goal" ? "Scorer" : eventType === "substitution" ? "Player on" : "Player"}
            </span>
            <select
              value={selectedPlayer ?? ""}
              onChange={(e) => setSelectedPlayer(Number(e.target.value) || null)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Select player</option>
              {playersForTeam.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Player Off (only for substitutions) */}
        {eventType === "substitution" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Player off</span>
            <select
              value={playerOffId ?? ""}
              onChange={(e) => setPlayerOffId(Number(e.target.value) || null)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Select player</option>
              {playersForTeam.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === selectedPlayer}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Substitution Reason (only for substitutions) */}
        {eventType === "substitution" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Reason for substitution</span>
            <div className="grid grid-cols-2 gap-2">
              {SUB_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  onClick={() => setSubReason(reason.value as any)}
                  className={`px-2 py-2 rounded border text-xs font-medium transition ${
                    subReason === reason.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-gray-700 border-gray-300 hover:border-slate-900"
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Assist Player (only for scored goals) */}
        {eventType === "goal" && goalType === "scored" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              Assist
              {isOwnGoal && " (optional)"}
            </span>
            <select
              value={assistingPlayer ?? ""}
              onChange={(e) => setAssistingPlayer(Number(e.target.value) || null)}
              className="border rounded px-3 py-2 text-sm"
              disabled={isOwnGoal}
            >
              <option value="">
                {isOwnGoal ? "N/A (own goal)" : "Select assisting player"}
              </option>
              {!isOwnGoal &&
                playersForTeam.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        {/* Own Goal Checkbox (only for scored goals) */}
        {eventType === "goal" && goalType === "scored" && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isOwnGoal}
              onChange={(e) => {
                setIsOwnGoal(e.target.checked);
                if (e.target.checked) setAssistingPlayer(null);
              }}
              className="rounded"
            />
            <span className="text-sm">Own goal</span>
          </label>
        )}

        {/* Notes */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            rows={2}
            className="border rounded px-3 py-2 text-sm resize-none"
          />
        </label>

        {/* Add Event Button */}
        <button
          onClick={handleAddEvent}
          disabled={saving}
          className="w-full px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium disabled:opacity-60 hover:bg-slate-800"
        >
          {saving ? "Saving..." : "Add event"}
        </button>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="bg-white border rounded-lg p-4 text-center text-sm text-gray-500">
          Loading match events...
        </div>
      ) : events.length > 0 ? (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-bold text-sm mb-3">Events ({events.length})</h3>
          <div className="space-y-2 text-xs max-h-96 overflow-y-auto">
            {events.map((evt, idx) => (
              <div key={idx} className="bg-slate-50 rounded p-2 border-l-4 border-slate-900">
                <div className="font-medium">
                  {evt.minute}' - {eventTypeLabel(evt.event_type)}
                </div>
                {evt.event_type === "goal" && evt.goal_type && (
                  <div className="text-gray-600">
                    {evt.goal_type === "scored" ? "✅ Scored" : "❌ Conceded"}
                    {evt.goal_context && ` • ${goalContextLabel(evt.goal_context)}`}
                  </div>
                )}
                {evt.player_id && (
                  <div className="text-gray-600">
                    Player: {players.find((p) => p.id === evt.player_id)?.name}
                  </div>
                )}
                {evt.assisting_player_id && (
                  <div className="text-gray-600 text-xs">
                    Assist: {players.find((p) => p.id === evt.assisting_player_id)?.name}
                  </div>
                )}
                {evt.event_type === "substitution" && evt.player_off_id && (
                  <div className="text-gray-600 text-xs mt-1">
                    Off: {players.find((p) => p.id === evt.player_off_id)?.name}
                    {evt.sub_reason && ` (${evt.sub_reason})`}
                  </div>
                )}
                {evt.notes && <div className="text-gray-500 mt-1">{evt.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    goal: "⚽ Goal",
    substitution: "🔄 Substitution",
    yellow_card: "🟨 Yellow card",
    red_card: "🔴 Red card",
  };
  return labels[type] || type;
}

function goalContextLabel(context: string): string {
  const labels: Record<string, string> = {
    open_play: "Open play",
    free_kick: "Free kick",
    corner: "Corner",
    penalty: "Penalty",
    other: "Other",
  };
  return labels[context] || context;
}