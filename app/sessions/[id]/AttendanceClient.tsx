"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
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
  player_id: number;
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

export default function AttendanceClient({
  sessionId,
  players,
  initialAttendance,
  initialFeedback,
}: Props) {
  const searchParams = useSearchParams();
  const initialViewParam = searchParams.get("view");
  const [view, setView] = useState<"attendance" | "development">(
    initialViewParam === "development" ? "development" : "attendance"
  );

  // Attendance state
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

  // Feedback state per player (0–5, but default = 1)
  const [feedback, setFeedback] = useState<
    Record<
      number,
      {
        ball_control: number;
        passing: number;
        shooting: number;
        fitness: number;
        attitude: number;
        coachability: number;
        positioning: number;
        speed_agility: number;
        comments: string;
      }
    >
  >(() => {
    const map: any = {};
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
    for (const f of initialFeedback) {
      map[f.player_id] = {
        ball_control: f.ball_control,
        passing: f.passing,
        shooting: f.shooting,
        fitness: f.fitness,
        attitude: f.attitude,
        coachability: f.coachability,
        positioning: f.positioning,
        speed_agility: f.speed_agility,
        comments: f.comments ?? "",
      };
    }
    return map;
  });

  const [savingAttendanceId, setSavingAttendanceId] = useState<
    number | null
  >(null);
  const [savingFeedbackId, setSavingFeedbackId] = useState<number | null>(
    null
  );

  const [error, setError] = useState<string | null>(null);

  const handleSetStatus = async (playerId: number, status: Status) => {
    setError(null);
    setSavingAttendanceId(playerId);
    setAttendance((prev) => ({ ...prev, [playerId]: status }));

    const { error } = await supabase.from("attendance").upsert(
      {
        session_id: sessionId,
        player_id: playerId,
        status,
      },
      {
        onConflict: "session_id,player_id",
      }
    );

    if (error) {
      console.error("Error saving attendance:", error);
      setError("Failed to save attendance. Please try again.");
    }

    setSavingAttendanceId(null);
  };

  const handleFeedbackChange = (
    playerId: number,
    key: CategoryKey,
    value: number
  ) => {
    setFeedback((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [key]: value,
      },
    }));
  };

  const handleFeedbackComments = (playerId: number, value: string) => {
    setFeedback((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        comments: value,
      },
    }));
  };

  const handleSaveFeedback = async (playerId: number) => {
    setError(null);
    setSavingFeedbackId(playerId);

    const f = feedback[playerId];
    if (!f) {
      setSavingFeedbackId(null);
      return;
    }

    const { error } = await supabase.from("coach_feedback").upsert(
      {
        player_id: playerId,
        session_id: sessionId,
        ball_control: f.ball_control,
        passing: f.passing,
        shooting: f.shooting,
        fitness: f.fitness,
        attitude: f.attitude,
        coachability: f.coachability,
        positioning: f.positioning,
        speed_agility: f.speed_agility,
        comments: f.comments.trim() || null,
      },
      {
        onConflict: "player_id,session_id",
      }
    );

    if (error) {
      console.error("Error saving feedback:", error);
      setError("Failed to save feedback. Please try again.");
    }

    setSavingFeedbackId(null);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Session details</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setView("attendance")}
          className={`px-3 py-1 rounded border ${
            view === "attendance"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-800 border-slate-300"
          }`}
        >
          Attendance
        </button>
        <button
          type="button"
          onClick={() => setView("development")}
          className={`px-3 py-1 rounded border ${
            view === "development"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-800 border-slate-300"
          }`}
        >
          Player development
        </button>
      </div>

      {view === "development" && (
        <p className="text-xs text-gray-600">
          <span className="font-semibold">Legend:</span>{" "}
          <span className="font-medium">0</span> = Not assessed,{" "}
          <span className="font-medium">1</span>–<span className="font-medium">2</span> = Needs work,{" "}
          <span className="font-medium">3</span> = Okay,{" "}
          <span className="font-medium">4</span>–<span className="font-medium">5</span> = Strong.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {players.length === 0 ? (
        <p>No players assigned to this team.</p>
      ) : (
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
                        disabled={savingAttendanceId === p.id}
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
                        disabled={savingAttendanceId === p.id}
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

                {/* Player development view */}
                {view === "development" && f && (
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

                    <button
                      type="button"
                      onClick={() => handleSaveFeedback(p.id)}
                      disabled={savingFeedbackId === p.id}
                      className="px-3 py-1 rounded bg-slate-900 text-slate-50 text-xs disabled:opacity-60"
                    >
                      {savingFeedbackId === p.id
                        ? "Saving…"
                        : "Save feedback"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
