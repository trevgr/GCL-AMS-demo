"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error("Login error:", error);
      setError(error.message || "Failed to sign in.");
      setSubmitting(false);
      return;
    }

    if (!data.user) {
      setError("No user returned from Supabase.");
      setSubmitting(false);
      return;
    }

    // On success, send them to Teams (or / if you prefer)
    router.replace("/teams");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border rounded-lg bg-white px-4 py-5 shadow-sm">
        <h1 className="text-xl font-semibold mb-4 text-center">
          Coach login
        </h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-sm">
            <label className="block mb-1 font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-2 py-1"
              required
            />
          </div>

          <div className="text-sm">
            <label className="block mb-1 font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-2 py-1"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-1 px-3 py-2 rounded bg-slate-900 text-slate-50 text-sm disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-3 text-xs text-gray-500 text-center">
          Ask the admin coach to create a Supabase account for you.
        </p>
      </div>
    </main>
  );
}
