import type { Id } from '../domain/types';

/**
 * Each judge's ranking of every entry for the whole event, from that judge's total points
 * across all dances (1 = highest). Equal totals share the better ranking (1, 2, 2, 4).
 *
 * @param totals judgeId -> entryId -> that judge's total tenths for the event
 * @returns judgeId -> entryId -> ranking
 */
export function judgeEventRankings(
  entryIds: Id[],
  totals: Map<Id, Map<Id, number>>,
): Map<Id, Map<Id, number>> {
  const rankings = new Map<Id, Map<Id, number>>();
  for (const [judgeId, byEntry] of totals) {
    const total = (e: Id) => byEntry.get(e) ?? 0;
    const sorted = [...entryIds].sort((a, b) => total(b) - total(a));
    const ranks = new Map<Id, number>();
    sorted.forEach((e, i) => {
      const prev = sorted[i - 1];
      ranks.set(e, prev !== undefined && total(prev) === total(e) ? ranks.get(prev)! : i + 1);
    });
    rankings.set(judgeId, ranks);
  }
  return rankings;
}

/**
 * Major victories: for each entry, the number of other entries that a majority of judges
 * (more than half) ranked it above. Judges who rank the pair equally count for neither.
 */
export function majorVictories(
  entryIds: Id[],
  judgeIds: Id[],
  rankings: Map<Id, Map<Id, number>>,
): Map<Id, number> {
  const majority = Math.floor(judgeIds.length / 2) + 1;
  const victories = new Map<Id, number>();
  for (const a of entryIds) {
    let count = 0;
    for (const b of entryIds) {
      if (a === b) continue;
      const judgesPreferringA = judgeIds.filter(
        (j) => rankings.get(j)!.get(a)! < rankings.get(j)!.get(b)!,
      ).length;
      if (judgesPreferringA >= majority) count++;
    }
    victories.set(a, count);
  }
  return victories;
}
