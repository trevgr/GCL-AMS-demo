// app/sessions/[id]/AttendanceClient.tsx
"use client";

import { useEffect, useState } from "react";
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

// 0–5 tick marks under the slider
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
  return "bg-green-500 text-white"; // 4–5
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

export default function AttendanceClient({
  sessionId,
  players,
  initialAttendance,
  initialFeedback,
  coachCounts,
}: Props) {
  // Attendance state (local only until Save All)
  const [attendance, setAttendance] = useState<
    Record<number, Status | null>
  >(() => {
    const map: Record<number, Status | null> = {};
    for (const p of players) {
      map[p.id] = null;
    }
    for (const a of initialAttendance) {
      map[a.player_id] = a.status;
    }
    return map;
  });

  // Feedback state per player (0–5, default = 0 = not assessed)
  const [feedback, setFeedback] = useState<
    Record<number, FeedbackState>
  >(() => {
    const map: Record<number, FeedbackState> = {};
    for (const p of players) {
      map[p.id] = {
        ball_control: 0,
        passing: 0,
        shooting: 0,
        fitness: 0,
        attitude: 0,
        coachability: 0,
        positioning: 0,
        speed_agility: 0,
        comments: "",
      };
    }
    return map;
  });

  // current coach info
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

        // Hydrate this coach's previous ratings into the local state
        setFeedback((prev) => {
          const next: Record<number, FeedbackState> = { ...prev };

          for (const row of initialFeedback) {
            if (row.coach_id !== data.user.id) continue;
            if (!next[row.player_id]) {
              next[row.player_id] = {
                ball_control: 0,
                passing: 0,
                shooting: 0,
                fitness: 0,
                attitude: 0,
                coachability: 0,
                positioning: 0,
                speed_agility: 0,
                comments: "",
              };
            }
            next[row.player_id] = {
              ...next[row.player_id],
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
        if (isMounted) {
          setCoachLoading(false);
        }
      }
    }

    loadCoachAndHydrate();

    return () => {
      isMounted = false;
    };
  }, [initialFeedback]);

  // Just update local state (no DB write here)
  const handleSetStatus = (playerId: number, status: Status) => {
    setError(null);
    setSavedAt(null);
    setAttendance((prev) => ({ ...prev, [playerId]: status }));
  };

  const handleFeedbackChange = (
    playerId: number,
    key: CategoryKey,
    value: number
  ) => {
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

      // 1) Upsert attendance for ALL players in this session
      const attendancePayload = players.map((p) => ({
        session_id: sessionId,
        player_id: p.id,
        // Treat null as "absent" for consistency;
        // if you want "leave unchanged", you could filter null out instead.
        status: attendance[p.id] ?? "absent",
      }));

      const { error: attendanceError } = await supabase
        .from("attendance")
        .upsert(attendancePayload, {
          onConflict: "session_id,player_id",
        });

      if (attendanceError) {
        console.error("Error saving attendance:", attendanceError);
        setError("Failed to save attendance. Please try again.");
        setSavingAll(false);
        return;
      }

      // 2) Upsert feedback for ALL players for this coach & session
      const feedbackPayload = players.map((p) => {
        const f = feedback[p.id];
        return {
          player_id: p.id,
          session_id: sessionId,
          coach_id: currentCoachId,
          ball_control: f?.ball_control ?? 0,
          passing: f?.passing ?? 0,
          shooting: f?.shooting ?? 0,
          fitness: f?.fitness ?? 0,
          attitude: f?.attitude ?? 0,
          coachability: f?.coachability ?? 0,
          positioning: f?.positioning ?? 0,
          speed_agility: f?.speed_agility ?? 0,
          comments: f?.comments.trim() || null,
        };
      });

      const { error: feedbackError } = await supabase
        .from("coach_feedback")
        .upsert(feedbackPayload, {
          onConflict: "player_id,session_id,coach_id",
        });

      if (feedbackError) {
        console.error("Error saving feedback:", {
          message: (feedbackError as any).message,
          details: (feedbackError as any).details,
          hint: (feedbackError as any).hint,
        });
        setError("Failed to save ratings. Please try again.");
        setSavingAll(false);
        return;
      }

      setSavedAt(new Date());
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Attendance & Ratings</h2>
      </div>

      <p className="text-xs text-gray-600">
        Mark who&apos;s present and record quick 0–5 ratings.{" "}
        <span className="font-semibold">0</span> = Not assessed,{" "}
        <span className="font-semibold">1–2</span> = Needs work,{" "}
        <span className="font-semibold">3</span> = Okay,{" "}
        <span className="font-semibold">4–5</span> = Strong.
      </p>

      {coachLoading && (
        <p className="text-xs text-gray-500">Checking coach identity…</p>
      )}
      {coachError && (
        <p className="text-xs text-red-600">{coachError}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p className="text-xs text-green-700">
          Saved at {savedAt.toLocaleTimeString()}
        </p>
      )}

      {players.length === 0 ? (
        <p>No players assigned to this team.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {players.map((p) => {
              const status = attendance[p.id] ?? null;
              const f = feedback[p.id];

              return (
                <li
                  key={p.id}
                  className="border rounded px-3 py-2 bg-white"
                >
                  {/* Header: player info + attendance controls */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-gray-600">
                        DOB: {formatDateDDMMYYYY(p.dob)}
                      </div>
                      {coachCounts[p.id] && coachCounts[p.id] > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Rated by {coachCounts[p.id]} coach
                          {coachCounts[p.id] > 1 ? "es" : ""}
                        </div>
                      )}
                      {!p.active && (
                        <div className="text-xs text-red-600">
                          Inactive
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-sm">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleSetStatus(p.id, "present")
                          }
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
                          onClick={() =>
                            handleSetStatus(p.id, "absent")
                          }
                          className={`px-3 py-1 rounded border text-xs ${
                            status === "absent"
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-white text-red-700 border-red-500"
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ratings section */}
                  {f && (
                    <div className="mt-3 border-t pt-2 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        {categories.map((cat) => {
                          const value = f[cat.key];

                          return (
                            <div
                              key={cat.key}
                              className="flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span>{cat.label}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[0.65rem] ${ratingColorClass(
                                    value
                                  )}`}
                                >
                                  {ratingLabel(value)}
                                </span>
                              </div>

                              {/* Slider + clickable tick marks */}
                              <div className="flex flex-col gap-1">
                                <input
                                  type="range"
                                  min={0}
                                  max={5}
                                  step={1}
                                  value={value}
                                  onChange={(e) =>
                                    handleFeedbackChange(
                                      p.id,
                                      cat.key,
                                      Number(e.target.value)
                                    )
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
                                        onClick={() =>
                                          handleFeedbackChange(
                                            p.id,
                                            cat.key,
                                            tick
                                          )
                                        }
                                        className={`min-w-[1.25rem] text-center ${
                                          isActive
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
                            onChange={(e) =>
                              handleFeedbackComments(
                                p.id,
                                e.target.value
                              )
                            }
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Notes specific to this session…"
                          />
                        </label>
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
          </div>
        </>
      )}
    </section>
  );
}
