// lib/sideCount.ts
export function sideCountFromAgeGroup(ageGroup: string | null | undefined): number {
  if (!ageGroup) return 11;

  const m = ageGroup.toUpperCase().match(/U(\d{1,2})/);
  const u = m ? Number(m[1]) : NaN;
  if (Number.isNaN(u)) return 11;

  if (u <= 11) return 7;     // U10, U11 (and younger if you ever add)
  if (u === 12) return 9;    // U12
  if (u >= 13 && u <= 17) return 11; // U13–U17
  return 11;
}
