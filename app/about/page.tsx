// app/about/page.tsx

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <main className="min-h-screen space-y-4">
      <section>
        <h1 className="text-2xl font-bold mb-1">About Grassroots CoachLab</h1>
        <p className="text-sm text-gray-600">
          A lightweight tool for grassroots football coaches to track
          attendance and player development across a season.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What this app does</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>Keep a simple record of who attended each training session.</li>
          <li>
            Capture quick 0–5 ratings per player (Ball Control, Passing,
            Attitude, etc.).
          </li>
          <li>
            Highlight players who might need extra support in key areas.
          </li>
          <li>
            Export CSV reports for sessions and development to share with
            staff or analyse in Excel/Sheets.
          </li>
          <li>
            Install on your phone as a PWA so you can use it pitch-side like an
            app.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Basic workflow</h2>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
          <li>
            <span className="font-semibold">Teams:</span> Go to{" "}
            <span className="font-mono text-xs">Teams</span> to pick the group
            you coach (e.g. U11 Blue).
          </li>
          <li>
            <span className="font-semibold">Sessions:</span> Use{" "}
            <span className="font-mono text-xs">Calendar</span> or the team{" "}
            <span className="font-mono text-xs">Sessions</span> tab to open a
            specific training night.
          </li>
          <li>
            <span className="font-semibold">Mark attendance:</span> On the
            session page, set each player to{" "}
            <span className="font-mono text-xs">Present</span> or{" "}
            <span className="font-mono text-xs">Absent</span>.
          </li>
          <li>
            <span className="font-semibold">Add development ratings:</span> On
            the same session, switch to{" "}
            <span className="font-mono text-xs">Player development</span> and
            slide 0–5 ratings. <span className="font-mono text-xs">0</span> =
            not assessed, <span className="font-mono text-xs">1–2</span> = needs
            work, <span className="font-mono text-xs">4–5</span> = strong.
          </li>
          <li>
            <span className="font-semibold">Review trends:</span> Use{" "}
            <span className="font-mono text-xs">Reports</span> to see session
            attendance and the development dashboard (players needing focus).
          </li>
          <li>
            <span className="font-semibold">Export data:</span> On session
            pages and in <span className="font-mono text-xs">Reports</span>,
            use the CSV download buttons to share or back up data.
          </li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Using it on your phone</h2>
        <p className="text-sm text-gray-700">
          Grassroots CoachLab is installable as a Progressive Web App (PWA).
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>
            Open the site in Chrome (Android) or Safari (iOS).
          </li>
          <li>
            Use the browser menu and choose{" "}
            <span className="font-mono text-xs">Add to Home screen</span> or{" "}
            <span className="font-mono text-xs">Install app</span>.
          </li>
          <li>
            Launch it from your home screen like a normal app – it will open
            full-screen with the same login and data.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tips for coaches</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>
            You don't need to rate every player after every session. Use{" "}
            <span className="font-mono text-xs">0</span> for "not assessed".
          </li>
          <li>
            Focus on one or two categories per week (e.g. Passing and
            Attitude) to keep it quick at the pitch.
          </li>
          <li>
            Use the development dashboard to pick 2–3 players for extra support
            over the next block of sessions.
          </li>
          <li>
            Download CSVs at the end of a training block or term as a simple
            record of progress.
          </li>
        </ul>
      </section>

      {/* --- Updated Legal Section Including Copyright --- */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Legal &amp; Copyright</h2>

        <p className="text-sm text-gray-700">
          Grassroots CoachLab is an experimental prototype provided solely for
          demonstration and evaluation purposes. Features, data handling, and
          behaviour may change at any time without notice.
        </p>

        <p className="text-sm text-gray-700">
          The application is supplied “as is,” without any warranties or
          guarantees—express or implied—regarding accuracy, reliability,
          performance, or suitability for real-world coaching decisions. Users
          should not rely on the system as an authoritative record of player
          data or development assessments.
        </p>

        <p className="text-sm text-gray-700">
          © {new Date().getFullYear()} Trevor Grant. All rights reserved.
          All content, design, source code, logic, branding, and functionality
          within Grassroots CoachLab are the exclusive intellectual property of
          Trevor Grant. No part of this application may be copied, reproduced,
          modified, distributed, or reverse-engineered without prior written
          permission.
        </p>

        <p className="text-sm text-gray-700">
          By accessing or using this demo, you acknowledge that it is a
          work-in-progress, may contain errors, and is not intended for public
          release, commercial use, or redistribution at this time.
        </p>
      </section>
    </main>
  );
}
