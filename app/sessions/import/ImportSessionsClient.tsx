"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type TeamRow = {
  id: number;
  name: string;
  age_group: string;
  season: string;
};

type Props = {
  teams: TeamRow[];
};

type ParsedRow = {
  raw: string;
  date: string;
  session_type: string;
  theme: string;
  lineNumber: number;
};

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // try DD/MM/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function simpleCsvParse(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // assume header in first line
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const idxDate = header.indexOf("date");
  const idxType =
    header.indexOf("session_type") !== -1
      ? header.indexOf("session_type")
      : header.indexOf("type");
  const idxTheme = header.indexOf("theme");

  if (idxDate === -1 || idxType === -1) {
    throw new Error(
      "CSV must have at least 'date' and 'session_type' (or 'type') columns in the header."
    );
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1; // human-friendly
    const line = lines[i];
    if (!line) continue;

    const cols = line.split(","); // simple split – assumes no commas inside values

    const dateRaw = cols[idxDate] ?? "";
    const typeRaw = cols[idxType] ?? "";
    const themeRaw = idxTheme !== -1 ? cols[idxTheme] ?? "" : "";

    const parsedDate = parseDate(dateRaw);
    if (!parsedDate) {
      // We'll still push, but flag as invalid date so we can highlight.
      rows.push({
        raw: line,
        date: "",
        session_type: typeRaw.trim(),
        theme: themeRaw.trim(),
        lineNumber,
      });
      continue;
    }

    rows.push({
      raw: line,
      date: parsedDate,
      session_type: typeRaw.trim() || "Training",
      theme: themeRaw.trim(),
      lineNumber,
    });
  }

  return rows;
}

export default function ImportSessionsClient({ teams }: Props) {
  const router = useRouter();

  const [teamId, setTeamId] = useState(
    teams.length > 0 ? String(teams[0].id) : ""
  );
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [rawPreview, setRawPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setImportResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setRawPreview(text);

    try {
      const rows = simpleCsvParse(text);
      if (rows.length === 0) {
        setError("CSV appears to be empty.");
      }
      setParsedRows(rows);
    } catch (err: any) {
      console.error("CSV parse error:", err);
      setError(err?.message || "Failed to parse CSV file.");
      setParsedRows([]);
    }
  };

  const handleImport = async () => {
    setError(null);
    setImportResult(null);

    if (!teamId) {
      setError("Please select a team.");
      return;
    }
    if (parsedRows.length === 0) {
      setError("No parsed rows available. Please upload a CSV first.");
      return;
    }

    const validRows = parsedRows.filter((r) => r.date);
    const invalidRows = parsedRows.filter((r) => !r.date);

    if (validRows.length === 0) {
      setError(
        "All rows have invalid or missing dates. Please check your CSV format."
      );
      return;
    }

    setImporting(true);

    let success = 0;
    let failed = invalidRows.length; // count rows that were already invalid

    for (const row of validRows) {
      const { error } = await supabase.from("sessions").insert({
        team_id: Number(teamId),
        session_date: row.date,
        session_type: row.session_type || "Training",
        theme: row.theme || null,
      });

      if (error) {
        console.error(
          `Failed to import line ${row.lineNumber}:`,
          error
        );
        failed += 1;
      } else {
        success += 1;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);

    // Refresh sessions page so user sees the results if they go back
    router.refresh();
  };

  const handleBack = () => {
    router.push("/sessions");
  };

  return (
    <section className="space-y-4">
      {teams.length === 0 && (
        <p className="text-sm text-red-600">
          There are no teams yet. Create a team before importing sessions.
        </p>
      )}

      {/* Team selection */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Team for imported sessions
          <span className="text-red-500">*</span>
        </label>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="border rounded px-2 py-1 w-full text-sm"
          disabled={importing || teams.length === 0}
        >
          {teams.length === 0 ? (
            <option value="">No teams available</option>
          ) : (
            teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.age_group} · {t.season}
              </option>
            ))
          )}
        </select>
        <p className="text-xs text-gray-500">
          All rows in this CSV will be imported as sessions for this team.
        </p>
      </div>

      {/* File input */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          CSV file<span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={importing}
          className="text-sm"
        />
        <p className="text-xs text-gray-500">
          Expected header:{" "}
          <code className="font-mono">
            date,session_type,theme
          </code>{" "}
          (or <code>date,type,theme</code>). Dates can be{" "}
          <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code>.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Preview */}
      {parsedRows.length > 0 && (
        <div className="border rounded p-3 bg-slate-50 space-y-2">
          <h2 className="text-sm font-semibold">
            Preview ({parsedRows.length} rows)
          </h2>
          <div className="max-h-48 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border px-2 py-1 text-left">
                    Line
                  </th>
                  <th className="border px-2 py-1 text-left">
                    Date
                  </th>
                  <th className="border px-2 py-1 text-left">
                    Session type
                  </th>
                  <th className="border px-2 py-1 text-left">
                    Theme
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((r) => (
                  <tr
                    key={r.lineNumber}
                    className={
                      r.date ? "" : "bg-red-50 text-red-700"
                    }
                  >
                    <td className="border px-2 py-1">
                      {r.lineNumber}
                    </td>
                    <td className="border px-2 py-1">
                      {r.date || "Invalid date"}
                    </td>
                    <td className="border px-2 py-1">
                      {r.session_type}
                    </td>
                    <td className="border px-2 py-1">
                      {r.theme}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rawPreview ? null : (
            <details className="text-[0.7rem]">
              <summary className="cursor-pointer">
                Show raw CSV
              </summary>
              <pre className="mt-1 whitespace-pre-wrap bg-white border rounded p-2">
                {rawPreview}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Import actions */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="px-3 py-1.5 rounded border border-slate-300 text-sm"
          disabled={importing}
        >
          Back to sessions
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={
            importing || teams.length === 0 || parsedRows.length === 0
          }
          className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
        >
          {importing ? "Importing…" : "Import sessions"}
        </button>
      </div>

      {importResult && (
        <p className="text-xs text-gray-700">
          Import complete.{" "}
          <span className="font-semibold">
            {importResult.success}
          </span>{" "}
          rows imported,{" "}
          <span className="font-semibold">
            {importResult.failed}
          </span>{" "}
          rows failed (see console for details).
        </p>
      )}
    </section>
  );
}
