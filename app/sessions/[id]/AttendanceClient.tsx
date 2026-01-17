"use client";

import { useState } from "react";
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

export default function AttendanceClient({
  sessionId,
  players,
  initialAttendance,
  initialFeedback,
}: Props) {
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

  // Feedback state per player
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
        ball_control: 3,
        passing: 3,
        shooting: 3,
        fitness: 3,
        attitude: 3,
        coachability: 3,
        positioning: 3,
        speed_agility: 3,
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

  const [openFeedback, setOpenFeedback] = useState<Record<number, boolean>>(
    () => {
      const map: Record<number, boolean> = {};
      for (const p of players) {
        map[p.id] = false;
      }
      return map;
    }
  );

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
      <h2 className="text-xl font-semibold">Attendance & development</h2>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

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
                        onClick={() => handleSetStatus(p.id, "present")}
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
                        onClick={() => handleSetStatus(p.id, "absent")}
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
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFeedback((prev) => ({
                          ...prev,
                          [p.id]: !prev[p.id],
                        }))
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {openFeedback[p.id]
                        ? "Hide feedback"
                        : "Add / edit feedback"}
                    </button>
                  </div>
                </div>

                {openFeedback[p.id] && f && (
                  <div className="mt-3 border-t pt-2 text-sm">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {categories.map((cat) => (
                        <label
                          key={cat.key}
                          className="flex flex-col gap-1"
                        >
                          <span>{cat.label}</span>
                          <select
                            value={f[cat.key]}
                            onChange={(e) =>
                              handleFeedbackChange(
                                p.id,
                                cat.key,
                                Number(e.target.value)
                              )
                            }
                            className="border rounded px-2 py-1 text-xs"
                          >
                            <option value={1}>
                              1 – Needs a lot of work
                            </option>
                            <option value={2}>2 – Below average</option>
                            <option value={3}>3 – Okay</option>
                            <option value={4}>4 – Good</option>
                            <option value={5}>5 – Excellent</option>
                          </select>
                        </label>
                      ))}
                    </div>

                    <div className="mb-2">
                      <label className="flex flex-col gap-1 text-xs">
                        <span>Comments (optional)</span>
                        <textarea
                          rows={2}
                          value={f.comments}
                          onChange={(e) =>
                            handleFeedbackComments(p.id, e.target.value)
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
