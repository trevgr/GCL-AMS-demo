"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AttendanceClient from "./AttendanceClient";
import MatchLineupClient from "./MatchLineupClient";
import MatchEventClient from "./MatchEventClient";
import MatchTimer from "./MatchTimer";

type SessionRow = {
  id: number;
  team_id: number;
  session_date: string;
  session_type: string;
  theme: string | null;
  team: {
    id: number;
    name: string;
    age_group: string;
    season: string;
  } | null;
};

type Player = {
  id: number;
  name: string;
  dob: string;
  active: boolean;
  team_id?: number;
};

type Team = {
  id: number;
  name: string;
};

type MatchDetails = {
  session_id: number;
  opposition: string;
  venue_type: string;
  venue_name: string | null;
  competition: string | null;
  formation: string | null;
  goals_for: number;
  goals_against: number;
};

type MatchLineupRow = {
  player_id: number;
  role: "starter" | "sub";
  position: string | null;
  shirt_number: number | null;
  is_captain: boolean;
};

function sideCountFromAgeGroup(ageGroup: string | null | undefined): number {
  if (!ageGroup) return 11;
  const m = ageGroup.toUpperCase().match(/U(\d{1,2})/);
  const u = m ? Number(m[1]) : NaN;
  if (Number.isNaN(u)) return 11;
  if (u <= 11) return 7;
  if (u === 12) return 9;
  if (u >= 13 && u <= 17) return 11;
  return 11;
}

type Props = {
  sessionData: SessionRow;
  initialPlayers: Player[];
  sessionId: number;
};

export default function SessionContent({ 
  sessionData, 
  initialPlayers,
  sessionId 
}: Props) {
  const [activeTab, setActiveTab] = useState("lineup");
  const [isMatch, setIsMatch] = useState(false);
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [matchEvents, setMatchEvents] = useState<any[]>([]);
  const [players, setPlayers] = useState(initialPlayers);
  const [teams, setTeams] = useState<Team[]>([]);
  const [lineup, setLineup] = useState<MatchLineupRow[]>([]);
  const [loadingLineup, setLoadingLineup] = useState(true);

  // Determine if it's a match
  useEffect(() => {
    setIsMatch((sessionData.session_type || "").toLowerCase() === "match");
  }, [sessionData.session_type]);

  // Load match details and teams
  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        // Fetch match details
        const matchResponse = await fetch(`/api/sessions/${sessionId}/match-details`);
        if (matchResponse.ok) {
          const matchData = await matchResponse.json();
          setMatchDetails(matchData);
        }

        // Fetch teams
        const teamsResponse = await fetch("/api/teams");
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          setTeams(teamsData);
        }
      } catch (err) {
        console.error("Failed to load match data", err);
      }
    };

    if (isMatch) {
      fetchMatchData();
    }
  }, [isMatch, sessionId]);

  // Load lineup for this session
  useEffect(() => {
    const fetchLineup = async () => {
      try {
        setLoadingLineup(true);
        const response = await fetch(`/api/sessions/${sessionId}/lineup`);
        if (response.ok) {
          const data = await response.json();
          setLineup(data);
        }
      } catch (err) {
        console.error("Failed to load lineup", err);
      } finally {
        setLoadingLineup(false);
      }
    };

    if (isMatch) {
      fetchLineup();
    }
  }, [isMatch, sessionId]);

  // Load match events for live scorecard
  useEffect(() => {
    const fetchMatchEvents = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/match-events`);
        if (response.ok) {
          const data = await response.json();
          setMatchEvents(data);
        }
      } catch (err) {
        console.error("Failed to load match events", err);
      }
    };

    // Initial load
    fetchMatchEvents();

    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchMatchEvents, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Calculate live score from events
  const calculateScore = () => {
    let goalsFor = 0;
    let goalsAgainst = 0;

    matchEvents.forEach((evt: any) => {
      if (evt.event_type === "goal") {
        if (evt.goal_type === "scored") {
          goalsFor++;
        } else if (evt.goal_type === "conceded") {
          goalsAgainst++;
        }
      }
    });

    return { goalsFor, goalsAgainst };
  };

  const score = calculateScore();
  const targetStarters = isMatch ? sideCountFromAgeGroup(sessionData.team?.age_group) : 11;
  const isLineupComplete = lineup.filter((l) => l.role === "starter").length === targetStarters;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {sessionData.team?.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {sessionData.session_type === "match"
                  ? `vs ${matchDetails?.opposition || "TBD"}`
                  : sessionData.session_type}
                {" • "}
                {sessionData.team?.age_group}
              </p>
            </div>
            <Link
              href="/sessions"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to sessions
            </Link>
          </div>

          {/* Live Scorecard - Only show if it's a match */}
          {isMatch && (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg p-4 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs uppercase text-slate-400 mb-1">
                    Our Team
                  </div>
                  <div className="text-4xl font-bold">{score.goalsFor}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-400 mb-1">
                    vs {matchDetails?.opposition || "Opposition"}
                  </div>
                  <div className="text-4xl font-bold">{score.goalsAgainst}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-400 mb-1">
                    Match Status
                  </div>
                  <div className="text-lg font-bold">
                    {score.goalsFor > score.goalsAgainst
                      ? "🟢 Leading"
                      : score.goalsFor < score.goalsAgainst
                      ? "🔴 Losing"
                      : score.goalsFor === 0 && score.goalsAgainst === 0
                      ? "⏱️ Started"
                      : "🟡 Level"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Timer - Always Visible if Match */}
        {isMatch && (
          <div className="mb-6">
            <MatchTimer 
              sessionId={sessionId} 
              onMinuteChange={setCurrentMinute}
            />
          </div>
        )}

        {/* Tab Navigation */}
        {isMatch && (
          <div className="mb-6 border-b border-gray-200 flex gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("lineup")}
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "lineup"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              📋 Lineup
            </button>
            <button
              onClick={() => setActiveTab("match-events")}
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "match-events"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              ⚽ Match Events
            </button>
            <button
              onClick={() => setActiveTab("match-details")}
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "match-details"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              📈 Match Details
            </button>
          </div>
        )}

        {/* Tab Content */}
        {isMatch ? (
          <>
            {activeTab === "lineup" && (
              !loadingLineup ? (
                <MatchLineupClient
                  sessionId={sessionId}
                  teamName={sessionData.team?.name || ""}
                  ageGroup={sessionData.team?.age_group || ""}
                  opposition={matchDetails?.opposition || ""}
                  targetStarters={targetStarters}
                  players={players}
                  teams={teams}
                  initialLineup={lineup}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">Loading lineup...</div>
              )
            )}

            {activeTab === "match-events" && (
              <MatchEventClient
                sessionId={sessionId}
                players={players}
                teams={teams}
                lineupComplete={isLineupComplete}
                currentMinute={currentMinute}
              />
            )}

            {activeTab === "match-details" && (
              <section className="space-y-6">
                {/* Match Summary Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4">Match Summary</h2>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="text-xs uppercase text-slate-400 mb-1">Our team</div>
                      <div className="text-3xl font-bold">{matchDetails?.goals_for ?? 0}</div>
                      <div className="text-sm text-slate-300 mt-2">
                        {matchDetails?.opposition ?? "Opposition"}
                      </div>
                      <div className="text-3xl font-bold mt-1">
                        {matchDetails?.goals_against ?? 0}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase text-slate-400 mb-1">Venue</div>
                      <div className="text-sm text-slate-200">
                        {matchDetails?.venue_name || "Not specified"}
                      </div>
                      <div className="text-xs text-slate-400 mt-2">
                        {matchDetails?.venue_type || "N/A"}
                      </div>
                      {matchDetails?.competition && (
                        <div className="text-xs text-slate-400 mt-3 bg-slate-700 rounded px-2 py-1">
                          {matchDetails.competition}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Match Details Grid with Formation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-600 font-semibold mb-2">
                      Opposition
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {matchDetails?.opposition || "Not recorded"}
                    </div>
                  </div>

                  <div className="bg-white border rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-600 font-semibold mb-2">
                      Formation
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {matchDetails?.formation || "Not recorded"}
                    </div>
                  </div>

                  <div className="bg-white border rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-600 font-semibold mb-2">
                      Result
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {matchDetails
                        ? matchDetails.goals_for > matchDetails.goals_against
                          ? "🟢 Win"
                          : matchDetails.goals_for < matchDetails.goals_against
                          ? "🔴 Loss"
                          : "🟡 Draw"
                        : "Not recorded"}
                    </div>
                  </div>
                </div>

                {/* Info Message */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs text-amber-900">
                    <strong>Note:</strong> Match details including opposition, venue, competition, 
                    formation and final score are typically recorded before or after the match. 
                    Real-time events (goals, cards, substitutions) are captured in the 
                    <Link href={`/sessions/${sessionId}`} className="text-amber-700 hover:underline font-semibold ml-1">
                      Match events tab
                    </Link>.
                  </p>
                </div>
              </section>
            )}
          </>
        ) : (
          <AttendanceClient
            sessionId={sessionId}
            players={players}
            initialAttendance={[]}
            initialFeedback={[]}
            coachCounts={{}}
          />
        )}
      </main>
    </div>
  );
}