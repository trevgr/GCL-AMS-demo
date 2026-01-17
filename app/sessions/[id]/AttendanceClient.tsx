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

type AttendanceRecord = {
  player_id: number;
  status: Status;
};

type Props = {
  sessionId: number;
  players: Player[];
  initialAttendance: AttendanceRecord[];
};

// Deterministic date formatting (DD/MM/YYYY) – same on server & client
function formatDateYYYYMMDD(isoDateString: string) {
  const d = new Date(isoDateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function AttendanceClient({
  sessionId,
  players,
  initialAttendance,
}: Props) {
  // Convert initial attendance list into a keyed map
  const [attendance, setAttendance] = useState<Record<number, Status>>(() => {
    const initial: Record<number, Status> = {};
    for (const rec of initialAttendance) {
      initial[rec.player_id] = rec.status;
    }
    return initial;
  });

  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetStatus = async (playerId: number, status: Status) => {
    try {
      setSavingId(playerId);
      setError(null);

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
        console.error("Failed to save attendance", error);
        setError("Failed to save attendance");
        return;
      }

      setAttendance((prev) => ({
        ...prev,
        [playerId]: status,
      }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Attendance</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {players.length === 0 ? (
        <p>No players assigned to this team.</p>
      ) : (
        <ul className="space-y-3">
          {players.map((p) => {
            const status = attendance[p.id];

            return (
              <li
                key={p.id}
                className="border rounded px-3 py-2 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatDateYYYYMMDD(p.dob)}
                    </div>
                  </div>
                </div>

                {/* Attendance buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetStatus(p.id, "present")}
                    disabled={savingId === p.id}
                    className={`px-3 py-1 rounded text-sm border ${
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
                    disabled={savingId === p.id}
                    className={`px-3 py-1 rounded text-sm border ${
                      status === "absent"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-red-700 border-red-500"
                    }`}
                  >
                    Absent
                  </button>
                </div>

                <div className="text-xs text-gray-500">
                  {status ? `Marked as: ${status}` : "Not marked yet"}
                  {savingId === p.id && " · Saving..."}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
