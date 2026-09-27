import type { Id } from '../domain/types';
import type { MarkLookup, ScoringSegment } from './types';

/**
 * Ranks one judge's marks for a dance (1 = best), for display while scoring. Totals are compared
 * first (A+B for a free dance or programme) and equal A+B totals are split by the B mark, as in
 * CIPA rule 3; any remaining tie shares the better ranking (1, 2, 2, 4).
 */
export function judgeOrdinals(
  segment: ScoringSegment,
  judgeId: Id,
  entryIds: Id[],
  mark: MarkLookup,
): { ordinals: Map<Id, number>; totals: Map<Id, number> } {
  const totals = new Map<Id, number>();
  const keyOf = (entryId: Id): number[] => {
    const total = segment.markKeys.reduce((s, k) => s + (mark(k, judgeId, entryId) ?? 0), 0);
    totals.set(entryId, total);
    const b = segment.markKeys[1];
    return segment.kind === 'free' && b ? [-total, -(mark(b, judgeId, entryId) ?? 0)] : [-total];
  };

  const keyed = entryIds.map((entryId) => ({ entryId, key: keyOf(entryId) }));
  keyed.sort((a, b) => compareKeys(a.key, b.key));

  const ordinals = new Map<Id, number>();
  keyed.forEach((item, i) => {
    const prev = keyed[i - 1];
    if (prev && compareKeys(prev.key, item.key) === 0) {
      ordinals.set(item.entryId, ordinals.get(prev.entryId)!);
    } else {
      ordinals.set(item.entryId, i + 1);
    }
  });
  return { ordinals, totals };
}

export function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
