import type { Id } from '../domain/types';
import type { JudgeTieRule, MarkLookup, ScoringSegment } from './types';

/**
 * Converts one judge's marks for a segment into ordinals (1 = best).
 * Totals are compared first (A+B for free dance); equal totals are split by the
 * configured rules, and any remaining ties share the better ordinal (1, 2, 2, 4).
 */
export function judgeOrdinals(
  segment: ScoringSegment,
  judgeId: Id,
  entryIds: Id[],
  mark: MarkLookup,
  tieRules: JudgeTieRule[],
): { ordinals: Map<Id, number>; totals: Map<Id, number> } {
  const totals = new Map<Id, number>();
  const keyOf = (entryId: Id): number[] => {
    const total = segment.markKeys.reduce((s, k) => s + (mark(k, judgeId, entryId) ?? 0), 0);
    totals.set(entryId, total);
    const key = [-total];
    for (const rule of tieRules) {
      if (segment.kind !== 'free') continue;
      if (rule === 'freeDanceB') key.push(-(mark('fd:B', judgeId, entryId) ?? 0));
      if (rule === 'freeDanceA') key.push(-(mark('fd:A', judgeId, entryId) ?? 0));
    }
    return key;
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
