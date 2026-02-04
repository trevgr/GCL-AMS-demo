"use client";

import { useEffect, useState } from "react";

type Props = {
  sessionId: number;
  onMinuteChange: (minute: number) => void;
};

export default function MatchTimer({ sessionId, onMinuteChange }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [period, setPeriod] = useState<"first" | "second">("first");
  const [isHalfTime, setIsHalfTime] = useState(false);
  const [isFullTime, setIsFullTime] = useState(false);

  const storageKey = `match-timer-${sessionId}`;

  // Load timer state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const {
          minute: m,
          second: s,
          isRunning: running,
          hasStarted: started,
          period: p,
          isHalfTime: ht,
          isFullTime: ft,
        } = JSON.parse(stored);
        setMinute(m);
        setSecond(s);
        setIsRunning(running);
        setHasStarted(started);
        setPeriod(p);
        setIsHalfTime(ht);
        setIsFullTime(ft);
        onMinuteChange(m);
      } catch (err) {
        console.error("Failed to load timer state", err);
      }
    }
  }, [sessionId, storageKey, onMinuteChange]);

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        minute,
        second,
        isRunning,
        hasStarted,
        period,
        isHalfTime,
        isFullTime,
      })
    );
  }, [minute, second, isRunning, hasStarted, period, isHalfTime, isFullTime, storageKey]);

  // Timer interval
  useEffect(() => {
    if (!isRunning || isHalfTime || isFullTime) return;

    const interval = setInterval(() => {
      setSecond((prev) => {
        if (prev === 59) {
          setMinute((m) => m + 1);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isHalfTime, isFullTime]);

  const handleStart = () => {
    setIsRunning(true);
    setHasStarted(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleHalfTime = () => {
    setIsRunning(false);
    setIsHalfTime(true);
  };

  const handleResumeSecondHalf = () => {
    setIsHalfTime(false);
    setPeriod("second");
    setMinute(0);
    setSecond(0);
    setIsRunning(true);
  };

  const handleFullTime = () => {
    setIsRunning(false);
    setIsFullTime(true);
  };

  const handleReset = () => {
    if (confirm("Reset timer? This cannot be undone.")) {
      setMinute(0);
      setSecond(0);
      setIsRunning(false);
      setHasStarted(false);
      setPeriod("first");
      setIsHalfTime(false);
      setIsFullTime(false);
      localStorage.removeItem(storageKey);
    }
  };

  const handleAddMinute = () => {
    setMinute((prev) => prev + 1);
  };

  const handleSubtractMinute = () => {
    if (minute > 0) {
      setMinute((prev) => prev - 1);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-bold">Match Timer</h2>

      {/* Period Indicator */}
      <div className="flex gap-2 justify-center">
        <div
          className={`px-3 py-1 rounded text-sm font-medium ${
            period === "first" && !isFullTime
              ? "bg-blue-600"
              : "bg-slate-700"
          }`}
        >
          1st Half
        </div>
        <div
          className={`px-3 py-1 rounded text-sm font-medium ${
            period === "second" && !isFullTime
              ? "bg-blue-600"
              : "bg-slate-700"
          }`}
        >
          2nd Half
        </div>
      </div>

      {/* Timer Display */}
      <div className="bg-black/30 rounded-lg p-6 text-center">
        <div className="text-5xl md:text-6xl font-mono font-bold tracking-wider">
          {String(minute).padStart(2, "0")}:{String(second).padStart(2, "0")}
        </div>
        <div className="text-sm text-slate-300 mt-2">
          {isFullTime ? (
            <span className="text-red-400">🏁 FULL TIME</span>
          ) : isHalfTime ? (
            <span className="text-yellow-400">⏸️ HALF TIME</span>
          ) : isRunning ? (
            <span>🔴 LIVE</span>
          ) : hasStarted ? (
            <span>⏸️ PAUSED</span>
          ) : (
            <span>⏹️ NOT STARTED</span>
          )}
        </div>
      </div>

      {/* Controls - Not Started */}
      {!hasStarted && (
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={handleStart}
            className="px-4 py-3 rounded bg-green-600 text-white font-bold hover:bg-green-700 transition"
          >
            ▶️ Start Match
          </button>
        </div>
      )}

      {/* Controls - Running/Paused - First Half */}
      {hasStarted && period === "first" && !isHalfTime && !isFullTime && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={isRunning ? handlePause : handleStart}
            className={`px-4 py-2 rounded font-medium transition text-white ${
              isRunning
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isRunning ? "⏸️ Pause" : "▶️ Resume"}
          </button>

          <button
            onClick={handleAddMinute}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          >
            ➕ +1 min
          </button>

          <button
            onClick={handleSubtractMinute}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
            disabled={minute === 0}
          >
            ➖ -1 min
          </button>

          <button
            onClick={handleHalfTime}
            className="px-4 py-2 rounded bg-yellow-600 text-white font-medium hover:bg-yellow-700 transition"
          >
            🏁 Half Time
          </button>

          <button
            onClick={handleReset}
            className="col-span-2 md:col-span-4 px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
          >
            🔄 Reset
          </button>
        </div>
      )}

      {/* Controls - Half Time */}
      {isHalfTime && period === "first" && !isFullTime && (
        <div className="grid grid-cols-1 gap-2">
          <div className="bg-yellow-600/30 border border-yellow-400 rounded px-4 py-3 text-center font-semibold">
            ⏸️ HALF TIME
          </div>
          <button
            onClick={handleResumeSecondHalf}
            className="px-4 py-3 rounded bg-green-600 text-white font-bold hover:bg-green-700 transition"
          >
            ▶️ Start 2nd Half
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
          >
            🔄 Reset
          </button>
        </div>
      )}

      {/* Controls - Running/Paused - Second Half */}
      {hasStarted && period === "second" && !isFullTime && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={isRunning ? handlePause : handleStart}
            className={`px-4 py-2 rounded font-medium transition text-white ${
              isRunning
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isRunning ? "⏸️ Pause" : "▶️ Resume"}
          </button>

          <button
            onClick={handleAddMinute}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          >
            ➕ +1 min
          </button>

          <button
            onClick={handleSubtractMinute}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
            disabled={minute === 0}
          >
            ➖ -1 min
          </button>

          <button
            onClick={handleFullTime}
            className="px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
          >
            🏁 Full Time
          </button>

          <button
            onClick={handleReset}
            className="col-span-2 md:col-span-4 px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
          >
            🔄 Reset
          </button>
        </div>
      )}

      {/* Controls - Full Time */}
      {isFullTime && (
        <div className="grid grid-cols-1 gap-2">
          <div className="bg-red-600/30 border border-red-400 rounded px-4 py-3 text-center font-semibold text-lg">
            🏁 FULL TIME
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
          >
            🔄 Reset Match
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-500/20 border border-blue-400 rounded px-3 py-2 text-xs text-blue-100">
        ℹ️ Timer is saved automatically. It persists even when switching tabs or refreshing the page.
      </div>
    </div>
  );
}