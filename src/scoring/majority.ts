import type { Id } from '../domain/types';
import { compareKeys } from './judgeOrdinals';
import { ordinalLabel } from './tieBreaks';
import type { Candidate, ExplainStep, TieBreakContext, TieBreakRule } from './types';

export const majorityOf = (judgeCount: number) => Math.floor(judgeCount / 2) + 1;

interface Group {
  candidates: Candidate[];
  rule: string;
  detail: string;
}

/**
 * Majority placement: for each place in turn, find the entries that a majority of judges
 * placed at that place or better (widening the column until someone qualifies).
 * A single qualifier takes the place; several qualifiers are split by the tie-break rules.
 */
export function placeByMajority(
  candidates: Candidate[],
  judgeCount: number,
  tieBreaks: TieBreakRule[],
): { places: Map<Id, number>; steps: ExplainStep[] } {
  const majority = majorityOf(judgeCount);
  const entryCount = candidates.length;
  const places = new Map<Id, number>();
  const steps: ExplainStep[] = [];
  let remaining = [...candidates];
  let nextPlace = 1;

  while (remaining.length > 0) {
    let column = nextPlace;
    let qualified: Candidate[] = [];
    for (; column <= entryCount; column++) {
      qualified = remaining.filter((c) => c.ordinals.filter((o) => o <= column).length >= majority);
      if (qualified.length > 0) break;
    }
    // Every ordinal is <= entryCount, so the last column always qualifies everyone left.
    const ctx: TieBreakContext = { column, majority, entryCount };

    const groups: Group[] =
      qualified.length === 1
        ? [
            {
              candidates: qualified,
              rule: 'Majority',
              detail: `${countAt(qualified[0]!, column)} of ${judgeCount} judges placed ${ordinalLabel(column)} or better`,
            },
          ]
        : partition(qualified, tieBreaks, ctx);

    for (const g of groups) {
      const ids = g.candidates.map((c) => c.entryId);
      ids.forEach((id) => places.set(id, nextPlace));
      steps.push({ place: nextPlace, entryIds: ids, rule: g.rule, detail: g.detail });
      nextPlace += ids.length;
    }
    const placed = new Set(qualified.map((c) => c.entryId));
    remaining = remaining.filter((c) => !placed.has(c.entryId));
  }
  return { places, steps };
}

function countAt(c: Candidate, column: number) {
  return c.ordinals.filter((o) => o <= column).length;
}

/** Splits tied candidates using each rule in turn; unresolved groups stay tied. */
function partition(
  candidates: Candidate[],
  rules: TieBreakRule[],
  ctx: TieBreakContext,
  ruleIndex = 0,
): Group[] {
  const rule = rules[ruleIndex];
  if (!rule) {
    return [
      {
        candidates,
        rule: 'Tie',
        detail: `Tied after all rules at ${ordinalLabel(ctx.column)} or better`,
      },
    ];
  }
  const scored = candidates.map((c) => {
    const s = rule.score(c, ctx);
    return { c, key: Array.isArray(s) ? s : [s] };
  });
  scored.sort((a, b) => compareKeys(a.key, b.key));

  const buckets: (typeof scored)[] = [];
  for (const item of scored) {
    const last = buckets[buckets.length - 1];
    if (last && compareKeys(last[0]!.key, item.key) === 0) last.push(item);
    else buckets.push([item]);
  }

  if (buckets.length === 1) return partition(candidates, rules, ctx, ruleIndex + 1);

  return buckets.flatMap((bucket) => {
    const group = bucket.map((b) => b.c);
    if (group.length > 1) return partition(group, rules, ctx, ruleIndex + 1);
    return [
      {
        candidates: group,
        rule: rule.label,
        detail: rule.describe(group[0]!, ctx),
      },
    ];
  });
}
