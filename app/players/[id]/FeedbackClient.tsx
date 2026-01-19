"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type FeedbackSummary = {
  avg_ball_control: number | null;
  avg_passing: number | null;
  avg_shooting: number | null;
  avg_fitness: number | null;
  avg_attitude: number | null;
  avg_coachability: number | null;
  avg_positioning: number | null;
  avg_speed_agility: number | null;
};

type FeedbackRow = {
  id: number;
  created_at: string;
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
  playerId: number;
  summary: FeedbackSummary;
  recent: FeedbackRow[];
};

const categories = [
  { key: "ball_control", label: "Ball Control" },
  { key: "passing", label: "Passing" },
  { key: "shooting", label: "Shooting" },
  { key: "fitness", label: "Fitness" },
  { key: "attitude", label: "Attitude" },
  { key: "coachability", label: "Coachability" },
  { key: "positioning", label: "Positioning" },
  { key: "speed_agility", label: "Speed / Agility" },
] as const;

type CategoryKey = (typeof categories)[number]["key"];

const ratingChoices = [
  { value: 1, label: "1", description: "Needs a lot of work" },
  { value: 2, label: "2", description: "Below average" },
  { value: 3, label: "3", description: "Okay" },
  { value: 4, label: "4", description: "Good" },
  { value: 5, label: "5", description: "Excellent" },
] as const;

export default function FeedbackClient({ playerId, summary, recent }: Props) {
  const router = useRouter();

  const [ratings, setRatings] = useState<Record<CategoryKey, number>>({
    ball_control: 1,
    passing: 1,
    shooting: 1,
    fitness: 1,
    attitude: 1,
    coachability: 1,
    positioning: 1,
    speed_agility: 1,
  });

  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: CategoryKey, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("coach_feedback").insert({
      player_id: playerId,
      // session_id: null, // could hook this to a session later
      ball_control: ratings.ball_control,
      passing: ratings.passing,
      shooting: ratings.shooting,
      fitness: ratings.fitness,
      attitude: ratings.attitude,
      coachability: ratings.coachability,
      positioning: ratings.positioning,
      speed_agility: ratings.speed_agility,
      comments: comments.trim() || null,
    });

    if (error) {
      console.error("Error saving feedback:", error);
      setError("Failed to save feedback. Please try again.");
      setSaving(false);
      return;
    }

    // Reset form & refresh page so server summary updates
    setComments("");
    setSaving(false);
    router.refresh();
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Coach feedback</h2>

      {/* Summary block */}
      <div className="border rounded px-3 py-2 text-sm bg-white">
        <div className="font-medium mb-1">Summary (avg ratings)</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>Ball Control: {summary.avg_ball_control ?? "—"}</div>
          <div>Passing: {summary.avg_passing ?? "—"}</div>
          <div>Shooting: {summary.avg_shooting ?? "—"}</div>
          <div>Fitness: {summary.avg_fitness ?? "—"}</div>
          <div>Attitude: {summary.avg_attitude ?? "—"}</div>
          <div>Coachability: {summary.avg_coachability ?? "—"}</div>
          <div>Positioning: {summary.avg_positioning ?? "—"}</div>
          <div>Speed/Agility: {summary.avg_speed_agility ?? "—"}</div>
        </div>
      </div>

      {/* Feedback form */}
      <form
        onSubmit={handleSubmit}
        className="border rounded px-3 py-3 space-y-3 bg-white"
      >
        <div className="font-medium">New feedback</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {categories.map((cat) => (
            <div key={cat.key} className="flex flex-col gap-1">
              <span>{cat.label}</span>
              <div className="flex flex-wrap gap-1">
                {ratingChoices.map((choice) => {
                  const isActive = ratings[cat.key] === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => handleChange(cat.key, choice.value)}
                      className={`px-2 py-1 rounded-full border text-xs
                        ${
                          isActive
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                        }`}
                      title={choice.description}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[0.7rem] text-gray-500">
                {ratingChoices.find((c) => c.value === ratings[cat.key])
                  ?.description ?? ""}
              </div>
            </div>
          ))}
        </div>

        <div className="text-sm">
          <label className="flex flex-col gap-1">
            <span>Comments (optional)</span>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="border rounded px-2 py-1 w-full"
              placeholder="Notes for future sessions…"
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 px-3 py-1 rounded bg-slate-900 text-slate-50 text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save feedback"}
        </button>
      </form>

      {/* Recent feedback list */}
      <div className="border rounded px-3 py-2 bg-white">
        <div className="font-medium text-sm mb-2">Recent feedback</div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-600">No feedback recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.map((f) => (
              <li key={f.id} className="border rounded px-2 py-1">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">
                    {formatDateTime(f.created_at)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  BC {f.ball_control}, P {f.passing}, Sh {f.shooting}, F{" "}
                  {f.fitness}, A {f.attitude}, C {f.coachability}, Pos{" "}
                  {f.positioning}, Sp {f.speed_agility}
                </div>
                {f.comments && <div className="mt-1">{f.comments}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
