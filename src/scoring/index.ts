import type { Id } from '../domain/types';
import { compareKeys, judgeOrdinals } from './judgeOrdinals';
import type {
  EventResult,
  JudgeTie,
  OverallRow,
  PlacementStep,
  RuleApplication,
  ScoringInput,
  SegmentResult,
  TieBreakMark,
} from './types';

export * from './types';
export {
  RULES,
  ruleLabel,
  ruleName,
  explainJudgeTie,
  explainStep,
  formatRuleValue,
  formatSum,
  formatVictories,
  ordinalLabel,
} from './rules';

/** The lowest whole number greater than half the judges: 2 of 3, 3 of 5, 4 of 7. */
export const majorityOf = (judgeCount: number) => Math.floor(judgeCount / 2) + 1;

/**
 * Scores an event by the CIPA system (majority rule):
 *  1. Each judge's SUM for an entry is the total of all their marks for it (every dance or figure;
 *     A+B for the free dance and programmes), each part multiplied by its factor (dance: none;
 *     singles and pairs: e.g. long programme ×3).
 *  2. Rule 2/3 — every pair of entries is compared judge by judge: the higher sum wins that judge's
 *     victory. Equal sums go to the higher B mark (`tieBreakMarks` in order: the free dance; the
 *     long, then short programme; none with figures); still equal, half a victory each.
 *  3. Rule 4 — an entry that wins more than half the judges' victories against another has a
 *     majority victory over it (exactly half: half a majority victory each).
 *  4. Rule 5 — most majority victories takes the highest open place; entries tied on majority
 *     victories are separated by rules 6, 7B (once per tie-break mark), 7C, 7A in turn, then share
 *     the place (rule 8).
 */
export function calculateEvent(input: ScoringInput): EventResult {
  const { entryIds, judgeIds, segments, mark } = input;
  const keys = new Set(segments.flatMap((s) => s.markKeys));
  const tieBreakMarks = input.tieBreakMarks.filter((t) => keys.has(t.key));
  let missingMarks = 0;
  let totalMarks = 0;

  const segmentResults: SegmentResult[] = segments.map((segment) => {
    let missing = 0;
    for (const key of segment.markKeys)
      for (const j of judgeIds) for (const e of entryIds) if (mark(key, j, e) === undefined) missing++;
    missingMarks += missing;
    totalMarks += segment.markKeys.length * judgeIds.length * entryIds.length;

    const ordinals = new Map<Id, Map<Id, number>>();
    const judgeTotals = new Map<Id, Map<Id, number>>();
    for (const judgeId of judgeIds) {
      const r = judgeOrdinals(segment, judgeId, entryIds, mark);
      ordinals.set(judgeId, r.ordinals);
      judgeTotals.set(judgeId, r.totals);
    }
    return {
      segmentId: segment.id,
      name: segment.name,
      complete: missing === 0 && judgeIds.length > 0 && entryIds.length > 0,
      missingMarks: missing,
      ordinals,
      judgeTotals,
    };
  });

  const complete = segments.length > 0 && judgeIds.length > 0 && segmentResults.every((s) => s.complete);
  const base = {
    complete,
    missingMarks,
    totalMarks,
    majority: majorityOf(judgeIds.length),
    tieBreakMarks,
    segments: segmentResults,
  };
  if (!complete) return { ...base, victories: new Map(), judgeTies: [], overall: [], steps: [] };
  return { ...base, ...placeEvent(input, segmentResults, tieBreakMarks) };
}

function placeEvent(
  { entryIds, judgeIds, segments, mark }: ScoringInput,
  segmentResults: SegmentResult[],
  tieBreakMarks: TieBreakMark[],
): Pick<EventResult, 'victories' | 'judgeTies' | 'overall' | 'steps'> {
  const judgeCount = judgeIds.length;
  // Tenths × factor in hundredths: thousandths of a mark (SUM_PER_POINT).
  const sum = (j: Id, e: Id) =>
    segmentResults.reduce((t, s, i) => t + s.judgeTotals.get(j)!.get(e)! * (segments[i]!.factor ?? 100), 0);
  const sums = new Map(judgeIds.map((j) => [j, new Map(entryIds.map((e) => [e, sum(j, e)]))]));
  const bMarks = (j: Id, e: Id) => tieBreakMarks.map((t) => mark(t.key, j, e) ?? 0);

  // Rules 2 and 3: the table of victories.
  const victories = new Map(entryIds.map((e) => [e, new Map<Id, number>()]));
  const judgeTies: JudgeTie[] = [];
  entryIds.forEach((a, ai) => {
    for (const b of entryIds.slice(ai + 1)) {
      let forA = 0;
      for (const j of judgeIds) {
        const sa = sums.get(j)!.get(a)!;
        const sb = sums.get(j)!.get(b)!;
        if (sa !== sb) {
          forA += sa > sb ? 1 : 0;
          continue;
        }
        // Rule 3: the B marks in order until one differs; still equal, half a victory each.
        const ba = bMarks(j, a);
        const bb = bMarks(j, b);
        const decider = ba.findIndex((m, i) => m !== bb[i]);
        const winner = decider < 0 ? undefined : ba[decider]! > bb[decider]! ? a : b;
        forA += winner === undefined ? 0.5 : winner === a ? 1 : 0;
        const compared = tieBreakMarks.slice(0, decider < 0 ? undefined : decider + 1);
        judgeTies.push({
          judgeId: j,
          entryIds: [a, b],
          sum: sa,
          winner,
          ...(compared.length > 0 && {
            bMarks: compared.map((t, i) => ({ label: t.label, marks: [ba[i]!, bb[i]!] as [number, number] })),
          }),
        });
      }
      victories.get(a)!.set(b, forA);
      victories.get(b)!.set(a, judgeCount - forA);
    }
  });

  const v = (a: Id, b: Id) => victories.get(a)!.get(b)!;
  const others = (e: Id) => entryIds.filter((o) => o !== e);
  // Rule 4: a majority victory over each entry beaten by more than half the judges.
  const majorityVictories = new Map(
    entryIds.map((e) => [
      e,
      others(e).reduce(
        (n, o) => n + (v(e, o) * 2 > judgeCount ? 1 : v(e, o) * 2 === judgeCount ? 0.5 : 0),
        0,
      ),
    ]),
  );
  const totalVictories = new Map(entryIds.map((e) => [e, others(e).reduce((n, o) => n + v(e, o), 0)]));
  const totalSums = new Map(entryIds.map((e) => [e, judgeIds.reduce((t, j) => t + sums.get(j)!.get(e)!, 0)]));
  const totalB = (e: Id, t: TieBreakMark) => judgeIds.reduce((n, j) => n + (mark(t.key, j, e) ?? 0), 0);

  type Step = { rule: RuleApplication['rule']; tieBreak?: TieBreakMark };
  const ruleValue = ({ rule, tieBreak }: Step, e: Id, tied: Id[]): number => {
    switch (rule) {
      case '6A':
      case '6B':
        return tied.filter((o) => o !== e).reduce((n, o) => n + v(e, o), 0);
      case '7B':
        return totalB(e, tieBreak!);
      case '7C':
        return totalVictories.get(e)!;
      case '7A':
        return totalSums.get(e)!;
    }
  };

  // Rule 5: highest open place by majority victories; ties go through rules 6–8.
  const steps: PlacementStep[] = [];
  const byMv = [...entryIds].sort((a, b) => majorityVictories.get(b)! - majorityVictories.get(a)!);
  let nextPlace = 1;
  for (let i = 0; i < byMv.length;) {
    const mv = majorityVictories.get(byMv[i]!)!;
    const pool = byMv.filter((e) => majorityVictories.get(e) === mv);
    i += pool.length;
    if (pool.length === 1) {
      steps.push({ place: nextPlace++, entryIds: pool, rule: '5', contenders: pool, trail: [] });
      continue;
    }
    const tied = pool;
    const sequence: Step[] = [
      { rule: tied.length >= 3 ? '6A' : '6B' },
      ...tieBreakMarks.map((tieBreak) => ({ rule: '7B' as const, tieBreak })),
      { rule: '7C' },
      { rule: '7A' },
    ];
    // Continue through the rules until every tied entry is placed: a rule that separates the
    // entries places them in its order, and entries still level on it go on to the next rule
    // (entries with less drop out of contention for the higher places).
    const resolve = (group: Id[], ruleIndex: number, trail: RuleApplication[]) => {
      const step = sequence[ruleIndex];
      if (!step) {
        steps.push({ place: nextPlace, entryIds: group, rule: '8', tiedOn: mv, contenders: tied, trail });
        nextPlace += group.length;
        return;
      }
      const { rule, tieBreak } = step;
      const values = group.map((entryId) => ({ entryId, value: ruleValue(step, entryId, tied) }));
      const path = [...trail, { rule, values, ...(tieBreak && { label: tieBreak.label }) }];
      const levels = [...new Set(values.map((x) => x.value))].sort((a, b) => b - a);
      for (const level of levels) {
        const atLevel = values.filter((x) => x.value === level).map((x) => x.entryId);
        if (atLevel.length === 1)
          steps.push({
            place: nextPlace++,
            entryIds: atLevel,
            rule,
            tiedOn: mv,
            contenders: tied,
            trail: path,
          });
        else resolve(atLevel, ruleIndex + 1, path);
      }
    };
    resolve(tied, 0, []);
  }

  const judgeRanks = new Map(
    judgeIds.map((j) => [j, rankBySum(entryIds, (e) => [sums.get(j)!.get(e)!, ...bMarks(j, e)])]),
  );
  const overall: OverallRow[] = steps.flatMap((s) =>
    s.entryIds.map((entryId) => ({
      entryId,
      place: s.place,
      tied: s.entryIds.length > 1,
      rule: s.rule,
      majorityVictories: majorityVictories.get(entryId)!,
      totalVictories: totalVictories.get(entryId)!,
      totalSum: totalSums.get(entryId)!,
      judgeSums: judgeIds.map((j) => sums.get(j)!.get(entryId)!),
      judgeRanks: judgeIds.map((j) => judgeRanks.get(j)!.get(entryId)!),
    })),
  );
  return { victories, judgeTies, overall, steps };
}

/**
 * Ranks entries by one judge's sums, highest first; equal sums go to the higher B marks in order
 * (as rule 3), and any remaining tie shares the better ranking (1, 2, 2, 4).
 */
function rankBySum(entryIds: Id[], key: (e: Id) => number[]): Map<Id, number> {
  const cmp = (a: Id, b: Id) => compareKeys(key(b), key(a));
  const sorted = [...entryIds].sort(cmp);
  const ranks = new Map<Id, number>();
  sorted.forEach((e, i) => {
    const prev = sorted[i - 1];
    ranks.set(e, prev !== undefined && cmp(prev, e) === 0 ? ranks.get(prev)! : i + 1);
  });
  return ranks;
}
