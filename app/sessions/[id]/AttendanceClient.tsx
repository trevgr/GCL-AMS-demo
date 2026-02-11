// app/sessions/[id]/AttendanceClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Status = "present" | "absent";

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
};

type AttendanceRow = {
  player_id: number;
  status: Status;
};

type FeedbackRow = {
  id: number;
  player_id: number;
  session_id: number;
  coach_id: string | null;
  ball_control: number;
  passing: number;
  shooting: number;
  fitness: number;
  attitude: number;
  coachability: number;
  positioning: number;
  speed_agility: number;
  comments: string | null;
};

type Props = {
  sessionId: number;
  players: Player[];
  initialAttendance: AttendanceRow[];
  initialFeedback: FeedbackRow[];
  coachCounts: Record<number, number>; // player_id -> #coaches
};

type CategoryKey =
  | "ball_control"
  | "passing"
  | "shooting"
  | "fitness"
  | "attitude"
  | "coachability"
  | "positioning"
  | "speed_agility";

const categories: { key: CategoryKey; label: string }[] = [
  { key: "ball_control", label: "Ball Control" },
  { key: "passing", label: "Passing" },
  { key: "shooting", label: "Shooting" },
  { key: "fitness", label: "Fitness" },
  { key: "attitude", label: "Attitude" },
  { key: "coachability", label: "Coachability" },
  { key: "positioning", label: "Positioning" },
  { key: "speed_agility", label: "Speed / Agility" },
];

const ratingTicks = [0, 1, 2, 3, 4, 5];

function formatDateDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function ratingColorClass(value: number) {
  if (value === 0) return "bg-gray-300 text-gray-800";
  if (value <= 2) return "bg-red-500 text-white";
  if (value === 3) return "bg-amber-400 text-slate-900";
  return "bg-green-500 text-white";
}

function ratingLabel(value: number) {
  if (value === 0) return "Not assessed";
  if (value === 1) return "1 – Needs a lot of work";
  if (value === 2) return "2 – Below average";
  if (value === 3) return "3 – Okay";
  if (value === 4) return "4 – Good";
  return "5 – Excellent";
}

type FeedbackState = {
  ball_control: number;
  passing: number;
  shooting: number;
  fitness: number;
  attitude: number;
  coachability: number;
  positioning: number;
  speed_agility: number;
  comments: string;
};

const emptyFeedback = (): FeedbackState => ({
  ball_control: 0,
  passing: 0,
  shooting: 0,
  fitness: 0,
  attitude: 0,
  coachability: 0,
  positioning: 0,
  speed_agility: 0,
  comments: "",
});

function countRatedCategories(f: FeedbackState) {
  let n = 0;
  for (const { key } of categories) {
    if ((f as any)[key] > 0) n++;
  }
  return n;
}

function avgRatedValue(f: FeedbackState) {
  let sum = 0;
  let cnt = 0;
  for (const { key } of categories) {
    const v = (f as any)[key] as number;
    if (v > 0) {
      sum += v;
      cnt++;
    }
  }
  if (!cnt) return null;
  return Math.round((sum / cnt) * 100) / 100;
}

export default function AttendanceClient({
  sessionId,
  players,
  initialAttendance,
  initialFeedback,
  coachCounts,
}: Props) {
  // Attendance state
  const [attendance, setAttendance] = useState<Record<number, Status | null>>(() => {
    const map: Record<number, Status | null> = {};
    for (const p of players) map[p.id] = null;
    for (const a of initialAttendance) map[a.player_id] = a.status;
    return map;
  });

  // Feedback state per player
  const [feedback, setFeedback] = useState<Record<number, FeedbackState>>(() => {
    const map: Record<number, FeedbackState> = {};
    for (const p of players) map[p.id] = emptyFeedback();
    return map;
  });

  // Which player is expanded for ratings
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);

  // Coach identity
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [coachError, setCoachError] = useState<string | null>(null);

  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Load current coach on mount & hydrate feedback from their rows only
  useEffect(() => {
    let isMounted = true;

    async function loadCoachAndHydrate() {
      setCoachLoading(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          if (!isMounted) return;
          setCoachError("No logged-in coach; please sign in again.");
          setCoachId(null);
          return;
        }

        if (!isMounted) return;

        setCoachId(data.user.id);
        setCoachError(null);

        setFeedback((prev) => {
          const next: Record<number, FeedbackState> = { ...prev };

          for (const row of initialFeedback) {
            if (row.coach_id !== data.user.id) continue;
            next[row.player_id] = {
              ...(next[row.player_id] ?? emptyFeedback()),
              ball_control: row.ball_control ?? 0,
              passing: row.passing ?? 0,
              shooting: row.shooting ?? 0,
              fitness: row.fitness ?? 0,
              attitude: row.attitude ?? 0,
              coachability: row.coachability ?? 0,
              positioning: row.positioning ?? 0,
              speed_agility: row.speed_agility ?? 0,
              comments: row.comments ?? "",
            };
          }

          return next;
        });
      } catch (err) {
        if (!isMounted) return;
        console.error("Error loading coach user:", err);
        setCoachError("Problem loading coach identity.");
        setCoachId(null);
      } finally {
        if (isMounted) setCoachLoading(false);
      }
    }

    loadCoachAndHydrate();
    return () => {
      isMounted = false;
    };
  }, [initialFeedback]);

  const toggleRatings = (playerId: number) => {
    setExpandedPlayerId((cur) => (cur === playerId ? null : playerId));
  };

  // Update local state (no DB write)
  const handleSetStatus = (playerId: number, status: Status) => {
    setError(null);
    setSavedAt(null);

    setAttendance((prev) => ({ ...prev, [playerId]: status }));

    // If player becomes absent, close panel + clear ratings locally (prevents stale rating data)
    if (status === "absent") {
      setExpandedPlayerId((cur) => (cur === playerId ? null : cur));
      setFeedback((prev) => ({ ...prev, [playerId]: emptyFeedback() }));
    }
  };

  const handleFeedbackChange = (playerId: number, key: CategoryKey, value: number) => {
    setError(null);
    setSavedAt(null);

    setFeedback((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [key]: value,
      },
    }));
  };

  const handleFeedbackComments = (playerId: number, value: string) => {
    setError(null);
    setSavedAt(null);

    setFeedback((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        comments: value,
      },
    }));
  };

  // ONE BUTTON: save all attendance + ratings
  const handleSaveAll = async () => {
    setError(null);
    setSavedAt(null);
    setSavingAll(true);

    try {
      // Ensure we have a coachId
      let currentCoachId = coachId;
      if (!currentCoachId) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          setError("No logged-in coach; please sign in again.");
          setSavingAll(false);
          return;
        }
        currentCoachId = data.user.id;
        setCoachId(data.user.id);
      }

      // 1) Upsert attendance for ALL players
      const attendancePayload = players.map((p) => ({
        session_id: sessionId,
        player_id: p.id,
        status: attendance[p.id] ?? "absent",
      }));

      const { error: attendanceError } = await supabase
        .from("attendance")
        .upsert(attendancePayload, { onConflict: "session_id,player_id" });

      if (attendanceError) {
        console.error("Error saving attendance:", attendanceError);
        setError("Failed to save attendance. Please try again.");
        return;
      }

      // 2) Upsert feedback for ALL players for this coach & session
      //    If absent, we send zeros/comments null (so absent players do not carry ratings).
      const feedbackPayload = players.map((p) => {
        const status = attendance[p.id] ?? "absent";
        const f = feedback[p.id] ?? emptyFeedback();

        const use = status === "present" ? f : emptyFeedback();

        return {
          player_id: p.id,
          session_id: sessionId,
          coach_id: currentCoachId,
          ball_control: use.ball_control ?? 0,
          passing: use.passing ?? 0,
          shooting: use.shooting ?? 0,
          fitness: use.fitness ?? 0,
          attitude: use.attitude ?? 0,
          coachability: use.coachability ?? 0,
          positioning: use.positioning ?? 0,
          speed_agility: use.speed_agility ?? 0,
          comments: status === "present" ? (use.comments.trim() || null) : null,
        };
      });

      const { error: feedbackError } = await supabase
        .from("coach_feedback")
        .upsert(feedbackPayload, { onConflict: "player_id,session_id,coach_id" });

      if (feedbackError) {
        console.error("Error saving feedback:", {
          message: (feedbackError as any).message,
          details: (feedbackError as any).details,
          hint: (feedbackError as any).hint,
        });
        setError("Failed to save ratings. Please try again.");
        return;
      }

      setSavedAt(new Date());
      setExpandedPlayerId(null); // collapse everything after save (keeps UI tidy)
    } finally {
      setSavingAll(false);
    }
  };

  const presentCount = useMemo(() => {
    return players.reduce((sum, p) => sum + ((attendance[p.id] ?? "absent") === "present" ? 1 : 0), 0);
  }, [players, attendance]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Attendance & Ratings</h2>
        <span className="text-xs px-2 py-1 rounded border bg-gray-50">
          Present: <span className="font-semibold">{presentCount}</span> / {players.length}
        </span>
      </div>

      <p className="text-xs text-gray-600">
        Mark who&apos;s present and record quick 0–5 ratings.{" "}
        <span className="font-semibold">0</span> = Not assessed,{" "}
        <span className="font-semibold">1–2</span> = Needs work,{" "}
        <span className="font-semibold">3</span> = Okay,{" "}
        <span className="font-semibold">4–5</span> = Strong.
      </p>

      {coachLoading && <p className="text-xs text-gray-500">Checking coach identity…</p>}
      {coachError && <p className="text-xs text-red-600">{coachError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && !error && (
        <p className="text-xs text-green-700">Saved at {savedAt.toLocaleTimeString()}</p>
      )}

      {players.length === 0 ? (
        <p>No players assigned to this team.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {players.map((p) => {
              const status = attendance[p.id] ?? null;
              const isPresent = status === "present";
              const isOpen = expandedPlayerId === p.id;

              const f = feedback[p.id] ?? emptyFeedback();
              const ratedCats = countRatedCategories(f);
              const avg = avgRatedValue(f);

              return (
                <li key={p.id} className="border rounded px-3 py-2 bg-white">
                  {/* Header: player info + attendance controls */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-sm text-gray-600">
                        DOB: {formatDateDDMMYYYY(p.dob)}
                      </div>

                      {coachCounts[p.id] && coachCounts[p.id] > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Rated by {coachCounts[p.id]} coach{coachCounts[p.id] > 1 ? "es" : ""}
                        </div>
                      )}

                      {!p.active && <div className="text-xs text-red-600">Inactive</div>}

                      {/* Collapsed summary */}
                      {!isOpen && (
                        <div className="mt-2 text-xs text-gray-700">
                          <span className="px-2 py-0.5 rounded bg-gray-100 border">
                            Rated: <span className="font-semibold">{ratedCats}</span>/8
                            {avg !== null ? (
                              <>
                                {" "}
                                • Avg: <span className="font-semibold">{avg.toFixed(2).replace(/\.00$/, "")}</span>
                              </>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 text-sm shrink-0">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(p.id, "present")}
                          className={`px-3 py-1 rounded border text-xs ${
                            status === "present"
                              ? "bg-green-500 text-white border-green-500"
                              : "bg-white text-green-700 border-green-500"
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(p.id, "absent")}
                          className={`px-3 py-1 rounded border text-xs ${
                            status === "absent"
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-white text-red-700 border-red-500"
                          }`}
                        >
                          Absent
                        </button>
                      </div>

                      {/* Open/Close rating */}
                      <button
                        type="button"
                        onClick={() => toggleRatings(p.id)}
                        disabled={!isPresent}
                        className={`px-3 py-1 rounded border text-xs font-medium ${
                          !isPresent
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : isOpen
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-900 border-slate-300"
                        }`}
                        title={!isPresent ? "Mark Present to rate" : ""}
                      >
                        {isOpen ? "Close rating" : "Open rating"}
                      </button>
                    </div>
                  </div>

                  {/* Ratings section (collapsible) */}
                  {isOpen && (
                    <div className="mt-3 border-t pt-3 text-sm bg-gray-50 rounded">
                      {!isPresent && (
                        <div className="text-xs text-gray-600 mb-2">
                          Player must be marked <span className="font-semibold">Present</span> to rate.
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        {categories.map((cat) => {
                          const value = f[cat.key];

                          return (
                            <div key={cat.key} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-xs">
                                <span>{cat.label}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[0.65rem] ${ratingColorClass(value)}`}
                                >
                                  {ratingLabel(value)}
                                </span>
                              </div>

                              <div className="flex flex-col gap-1">
                                <input
                                  type="range"
                                  min={0}
                                  max={5}
                                  step={1}
                                  value={value}
                                  disabled={!isPresent}
                                  onChange={(e) =>
                                    handleFeedbackChange(p.id, cat.key, Number(e.target.value))
                                  }
                                  className="w-full"
                                />

                                <div className="flex justify-between text-[0.65rem] text-gray-500">
                                  {ratingTicks.map((tick) => {
                                    const isActive = value === tick;
                                    return (
                                      <button
                                        key={tick}
                                        type="button"
                                        disabled={!isPresent}
                                        onClick={() => handleFeedbackChange(p.id, cat.key, tick)}
                                        className={`min-w-[1.25rem] text-center ${
                                          !isPresent
                                            ? "text-gray-300 cursor-not-allowed"
                                            : isActive
                                            ? "font-semibold text-slate-900"
                                            : "text-gray-400"
                                        }`}
                                      >
                                        {tick}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mb-2">
                        <label className="flex flex-col gap-1 text-xs">
                          <span>Comments (optional)</span>
                          <textarea
                            rows={2}
                            value={f.comments}
                            disabled={!isPresent}
                            onChange={(e) => handleFeedbackComments(p.id, e.target.value)}
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Notes specific to this session…"
                          />
                        </label>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setExpandedPlayerId(null)}
                          className="px-3 py-1 rounded border text-xs bg-white"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Global save button */}
          <div className="mt-4 flex flex-col gap-2 text-xs">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={savingAll || coachLoading}
              className="px-3 py-2 rounded bg-slate-900 text-slate-50 disabled:opacity-60"
            >
              {savingAll ? "Saving…" : "Save attendance & ratings"}
            </button>

            <p className="text-[0.7rem] text-gray-500">
              Tip: mark a player absent to automatically clear their ratings for this coach in this session.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
