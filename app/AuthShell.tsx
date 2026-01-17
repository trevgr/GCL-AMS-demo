"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Props = {
  children: ReactNode;
};

export default function AuthShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // /login is always public
    if (pathname === "/login") {
      setChecking(false);
      setAuthed(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isMounted) return;

        // Ignore the expected "no session" case so dev overlay doesn't scream
        if (
          error &&
          !(
            error.name === "AuthSessionMissingError" ||
            error.message?.toLowerCase().includes("auth session missing")
          )
        ) {
          console.error("Unexpected auth error:", error);
        }

        if (data?.user) {
          setAuthed(true);
        } else {
          router.replace("/login");
        }
      })
      .finally(() => {
        if (isMounted) {
          setChecking(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  // Public login page: no shell/header
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // While checking auth, show a simple loader
  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Checking access…</p>
      </main>
    );
  }

  // If not authed, redirect is already happening
  if (!authed) {
    return null;
  }

  // Authenticated app shell: header + page content + logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-slate-900 text-white">
        <div className="max-w-xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold text-base text-white">
            GCL
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/teams" className="hover:underline text-white">
              Teams
            </Link>
            <Link href="/calendar" className="hover:underline text-white">
              Calendar
            </Link>
            <Link href="/reports" className="hover:underline text-white">
              Reports
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 text-xs px-2 py-1 rounded border border-white/60 hover:bg-white hover:text-slate-900 transition"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <div className="flex-1 max-w-xl mx-auto w-full px-4 py-4">
        {children}
      </div>
    </div>
  );
}
