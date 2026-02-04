"use client";

import { useState, useEffect } from "react";

type MatchLineupRow = {
  player_id: number;
  role: "starter" | "sub";
  position: string | null;
  shirt_number: number | null;
  is_captain: boolean;
};

type Props = {
  sessionId: number;
  teamName: string;
  ageGroup: string;
  opposition: string;
  targetStarters: number;
  players: Array<{ id: number; name: string; team_id: number }>;
  teams: Array<{ id: number; name: string }>;
  initialLineup: MatchLineupRow[];
};

const FORMATIONS = [
  { name: "4-4-2", positions: ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"] },
  { name: "4-3-3", positions: ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "RM", "LW", "ST", "RW"] },
  { name: "3-5-2", positions: ["GK", "CB", "CB", "CB", "LB", "LM", "CM", "CM", "RM", "RB", "ST", "ST"] },
  { name: "5-3-2", positions: ["GK", "LB", "CB", "CB", "CB", "RB", "LM", "CM", "RM", "ST", "ST"] },
  { name: "4-2-3-1", positions: ["GK", "LB", "CB", "CB", "RB", "DM", "DM", "LW", "CM", "RW", "ST"] },
];

const POSITION_ORDER: Record<string, number> = {
  "GK": 0,
  "LB": 1, "CB": 2, "RB": 3,
  "LWB": 1, "RWB": 3,
  "DM": 4, "CM": 5, "AM": 6,
  "LM": 4, "RM": 7,
  "LW": 8, "RW": 9,
  "ST": 10, "CF": 10,
};

export default function MatchLineupClient({
  sessionId,
  teamName,
  ageGroup,
  opposition,
  targetStarters,
  players,
  teams,
  initialLineup,
}: Props) {
  const [lineup, setLineup] = useState<MatchLineupRow[]>(initialLineup);
  const [selectedFormation, setSelectedFormation] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  const starters = lineup.filter((l) => l.role === "starter");
  const subs = lineup.filter((l) => l.role === "sub");
  const unassigned = players.filter(
    (p) => !lineup.find((l) => l.player_id === p.id)
  );

  const isLineupComplete = starters.length === targetStarters;

  const handleAddPlayer = (playerId: number, role: "starter" | "sub") => {
    if (role === "starter" && starters.length >= targetStarters) {
      setError(`Maximum ${targetStarters} starters allowed`);
      return;
    }

    setError(null);
    setLineup((prev) => [
      ...prev,
      {
        player_id: playerId,
        role,
        position: null,
        shirt_number: null,
        is_captain: false,
      },
    ]);
  };

  const handleRemovePlayer = (playerId: number) => {
    setLineup((prev) => prev.filter((l) => l.player_id !== playerId));
    setError(null);
  };

  const handleUpdateLineupPlayer = (
    playerId: number,
    updates: Partial<MatchLineupRow>
  ) => {
    setLineup((prev) =>
      prev.map((l) =>
        l.player_id === playerId ? { ...l, ...updates } : l
      )
    );
  };

  const handleApplyFormation = (formationName: string) => {
    const formation = FORMATIONS.find((f) => f.name === formationName);
    if (!formation) return;

    setSelectedFormation(formationName);

    // Auto-assign positions to first N starters based on formation
    const startersToUpdate = [...starters].sort((a, b) => {
      const aOrder = POSITION_ORDER[a.position || ""] ?? 99;
      const bOrder = POSITION_ORDER[b.position || ""] ?? 99;
      return aOrder - bOrder;
    });

    const updatedLineup = [...lineup];
    startersToUpdate.forEach((starter, idx) => {
      if (idx < formation.positions.length) {
        const lineupIdx = updatedLineup.findIndex((l) => l.player_id === starter.player_id);
        if (lineupIdx >= 0) {
          updatedLineup[lineupIdx].position = formation.positions[idx];
        }
      }
    });

    setLineup(updatedLineup);
  };

  const handleSaveLineup = async () => {
    if (starters.length === 0) {
      setError("Must have at least one starter");
      return;
    }

    if (starters.length < targetStarters) {
      setError(`Must have ${targetStarters} starters`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/lineup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineup }),
        }
      );

      if (!response.ok) {
        const msg = await response.text();
        setError(`Failed to save lineup: ${msg}`);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPreviousLineup = async () => {
    setLoadingPrevious(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/previous-lineup`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setLineup(data);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } else {
          setError("No previous lineup found");
        }
      } else {
        setError("Failed to load previous lineup");
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoadingPrevious(false);
    }
  };

  const getPlayerName = (playerId: number) => {
    return players.find((p) => p.id === playerId)?.name || "Unknown";
  };

  // Sort starters by position for display
  const sortedStarters = [...starters].sort((a, b) => {
    const aOrder = POSITION_ORDER[a.position || ""] ?? 99;
    const bOrder = POSITION_ORDER[b.position || ""] ?? 99;
    return aOrder - bOrder;
  });

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-1">{teamName}</h2>
        <p className="text-slate-300 text-sm mb-4">
          vs {opposition} • {ageGroup}
        </p>
        <div className="flex gap-4 text-sm mb-4">
          <div>
            <span className="text-slate-400">Starters:</span>
            <span className={`font-bold ml-2 ${isLineupComplete ? "text-green-300" : "text-amber-300"}`}>
              {starters.length}/{targetStarters}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Subs:</span>
            <span className="font-bold ml-2">{subs.length}</span>
          </div>
        </div>

        {!isLineupComplete && (
          <div className="bg-red-500/20 border border-red-400 rounded px-3 py-2 text-sm">
            ⚠️ Complete lineup to start match timer
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-700">
          ✓ Lineup saved successfully
        </div>
      )}

      {/* Formation Selector */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-bold text-sm mb-3">Select Formation</h3>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {FORMATIONS.map((formation) => (
            <button
              key={formation.name}
              onClick={() => handleApplyFormation(formation.name)}
              className={`px-3 py-2 rounded border-2 text-sm font-medium transition ${
                selectedFormation === formation.name
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-gray-700 border-gray-300 hover:border-slate-900"
              }`}
            >
              {formation.name}
            </button>
          ))}
        </div>
      </div>

      {/* Load Previous Lineup Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-blue-900">Reuse Previous Lineup</h3>
          <p className="text-xs text-blue-700 mt-1">
            Load the lineup from the most recent previous match to save time
          </p>
        </div>
        <button
          onClick={handleLoadPreviousLineup}
          disabled={loadingPrevious}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
        >
          {loadingPrevious ? "Loading..." : "📋 Load Previous"}
        </button>
      </div>

      {/* Starters Section */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-bold text-sm mb-3">
          Starting XI ({starters.length}/{targetStarters})
          {selectedFormation && <span className="text-gray-600 font-normal ml-2">({selectedFormation})</span>}
        </h3>

        {starters.length === 0 ? (
          <p className="text-xs text-gray-500 mb-3">No starters selected yet</p>
        ) : (
          <div className="space-y-2 mb-4">
            {sortedStarters.map((lineup) => (
              <div
                key={lineup.player_id}
                className="bg-slate-50 border rounded p-3 flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {getPlayerName(lineup.player_id)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    {/* Position */}
                    <label>
                      <div className="text-gray-600 mb-1">Position</div>
                      <select
                        value={lineup.position || ""}
                        onChange={(e) =>
                          handleUpdateLineupPlayer(lineup.player_id, {
                            position: e.target.value || null,
                          })
                        }
                        className="border rounded px-2 py-1 text-xs w-full"
                      >
                        <option value="">Select</option>
                        <option value="GK">Goalkeeper</option>
                        <option value="LB">Left Back</option>
                        <option value="CB">Centre Back</option>
                        <option value="RB">Right Back</option>
                        <option value="LWB">Left Wing Back</option>
                        <option value="RWB">Right Wing Back</option>
                        <option value="DM">Defensive Mid</option>
                        <option value="CM">Central Mid</option>
                        <option value="AM">Attacking Mid</option>
                        <option value="LM">Left Mid</option>
                        <option value="RM">Right Mid</option>
                        <option value="LW">Left Winger</option>
                        <option value="RW">Right Winger</option>
                        <option value="ST">Striker</option>
                        <option value="CF">Centre Forward</option>
                      </select>
                    </label>

                    {/* Shirt Number */}
                    <label>
                      <div className="text-gray-600 mb-1">Shirt #</div>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={lineup.shirt_number || ""}
                        onChange={(e) =>
                          handleUpdateLineupPlayer(lineup.player_id, {
                            shirt_number: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 text-xs w-full"
                        placeholder="e.g. 7"
                      />
                    </label>

                    {/* Captain checkbox */}
                    <label className="flex items-center gap-1 mt-4">
                      <input
                        type="checkbox"
                        checked={lineup.is_captain}
                        onChange={(e) =>
                          handleUpdateLineupPlayer(lineup.player_id, {
                            is_captain: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <span className="text-xs font-medium">Captain</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => handleRemovePlayer(lineup.player_id)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {starters.length < targetStarters && unassigned.length > 0 && (
          <div className="border-t pt-3">
            <label className="text-xs font-medium text-gray-700 block mb-2">
              Add starter
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddPlayer(Number(e.target.value), "starter");
                  e.target.value = "";
                }
              }}
              className="border rounded px-2 py-1 text-sm w-full"
            >
              <option value="">Select player</option>
              {unassigned.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Substitutes Section */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-bold text-sm mb-3">Substitutes ({subs.length})</h3>

        {subs.length === 0 ? (
          <p className="text-xs text-gray-500 mb-3">No substitutes selected yet</p>
        ) : (
          <div className="space-y-2 mb-4">
            {subs.map((lineup) => (
              <div
                key={lineup.player_id}
                className="bg-slate-50 border rounded p-3 flex items-center justify-between"
              >
                <div className="font-medium text-sm">
                  {getPlayerName(lineup.player_id)}
                </div>

                <button
                  onClick={() => handleRemovePlayer(lineup.player_id)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="border-t pt-3">
            <label className="text-xs font-medium text-gray-700 block mb-2">
              Add substitute
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddPlayer(Number(e.target.value), "sub");
                  e.target.value = "";
                }
              }}
              className="border rounded px-2 py-1 text-sm w-full"
            >
              <option value="">Select player</option>
              {unassigned.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Available Players */}
      {unassigned.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-sm mb-2">Not in squad ({unassigned.length})</h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-blue-200 rounded px-3 py-1 text-xs text-gray-700"
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2">
        <button
          onClick={handleSaveLineup}
          disabled={saving || !isLineupComplete}
          className="flex-1 px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium disabled:opacity-60 hover:bg-slate-800"
        >
          {saving ? "Saving..." : "Save Lineup"}
        </button>
      </div>
    </section>
  );
}