// lib/ageGroups.ts

export type AgeGroupConfig = {
  min: number; // e.g. 5  => U5
  max: number; // e.g. 18 => U18
};

/**
 * Default: U5–U18
 */
const DEFAULT_AGE_GROUP_CONFIG: AgeGroupConfig = {
  min: 5,
  max: 18,
};

/**
 * Calculate age group label (e.g. "U11") for a player in a given season,
 * based on date of birth and season start date.
 *
 * Rule (matching our SQL function):
 *   age_group_number = seasonYear - birthYear + 1
 *
 * Example:
 *   dob: 2015-03-10, seasonStart: 2025-08-01
 *   => 2025 - 2015 + 1 = 11  => "U11"
 */
export function getAgeGroupForSeason(
  dob: Date | string | null | undefined,
  seasonStart: Date | string | null | undefined,
  config: AgeGroupConfig = DEFAULT_AGE_GROUP_CONFIG,
): string | null {
  if (!dob || !seasonStart) return null;

  const dobDate =
    dob instanceof Date ? dob : new Date(dob);
  const seasonStartDate =
    seasonStart instanceof Date ? seasonStart : new Date(seasonStart);

  if (Number.isNaN(dobDate.getTime()) || Number.isNaN(seasonStartDate.getTime())) {
    return null;
  }

  const birthYear = dobDate.getFullYear();
  const seasonYear = seasonStartDate.getFullYear();

  const n = seasonYear - birthYear + 1;

  if (n < config.min || n > config.max) {
    return null;
  }

  return `U${n}`;
}
export type SeasonInfo = {
  id: number;
  name: string;       // e.g. "2025/26"
  startDate: string;  // ISO date, e.g. "2025-08-01"
  endDate?: string;
};

/**
 * Check if a player's DOB maps to the same age_group as the team,
 * for the given season.
 */
export function playerMatchesTeamAgeGroup(
  playerDob: Date | string | null | undefined,
  teamAgeGroup: string,
  season: SeasonInfo,
  config: AgeGroupConfig = DEFAULT_AGE_GROUP_CONFIG,
): boolean {
  const calculated = getAgeGroupForSeason(playerDob, season.startDate, config);
  if (!calculated) return false;

  // Normalise both sides (e.g. "u11" vs "U11")
  const normalisedCalculated = calculated.toUpperCase();
  const normalisedTeam = teamAgeGroup.toUpperCase();

  return normalisedCalculated === normalisedTeam;
}
