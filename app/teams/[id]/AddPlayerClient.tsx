"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  teamId: number;
};

export default function AddPlayerClient({ teamId }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDob("");
    setActive(true);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dob) {
      setError("Please enter name and date of birth.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          dob,
          active,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to create player.");
        return;
      }

      resetForm();
      setOpen(false);
      // Reload server data so new player appears in the list
      router.refresh();
    } catch (err) {
      console.error("AddPlayerClient – network error", err);
      setError("Network error while creating player.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs sm:text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800"
      >
        + Add player
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 border rounded bg-white p-3 space-y-2 text-sm"
    >
      <div className="flex justify-between items-center">
        <div className="font-medium text-slate-800 text-sm">
          Add new player to this team
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div>
        <label className="block mb-1 text-xs font-medium" htmlFor="player-name">
          Name
        </label>
        <input
          id="player-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Player full name"
          required
        />
      </div>

      <div>
        <label className="block mb-1 text-xs font-medium" htmlFor="player-dob">
          Date of birth
        </label>
        <input
          id="player-dob"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="player-active"
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="player-active" className="text-xs">
          Active
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="px-3 py-1.5 rounded border border-slate-300 text-xs"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 rounded bg-slate-900 text-white text-xs disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save player"}
        </button>
      </div>
    </form>
  );
}
