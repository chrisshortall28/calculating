import type { Id } from '../domain/types';
import { judgeOrdinals } from './judgeOrdinals';
import { majorityOf, placeByMajority } from './majority';
import { judgeEventRankings, majorVictories } from './majorVictories';
import { DEFAULT_TIE_BREAKS } from './tieBreaks';
import type {
  Candidate,
  EventResult,
  ExplainStep,
  OverallRow,
  ScoringConfig,
  ScoringInput,
  SegmentResult,
} from './types';

export * from './types';
export { ALL_TIE_BREAKS, DEFAULT_TIE_BREAKS, ordinalLabel } from './tieBreaks';

export const DEFAULT_CONFIG: ScoringConfig = {
  judgeTieRules: ['freeDanceB', 'share'],
  tieBreaks: DEFAULT_TIE_BREAKS,
  segmentFactor: () => 1,
};

export function calculateEvent(input: ScoringInput, config: ScoringConfig = DEFAULT_CONFIG): EventResult {
  const { entryIds, judgeIds, segments, mark } = input;
  let missingMarks = 0;
  let totalMarks = 0;

  const segmentResults: SegmentResult[] = segments.map((segment) => {
    let missing = 0;
    for (const key of segment.markKeys)
      for (const j of judgeIds) for (const e of entryIds) if (mark(key, j, e) === undefined) missing++;
    const total = segment.markKeys.length * judgeIds.length * entryIds.length;
    missingMarks += missing;
    totalMarks += total;

    const ordinals = new Map<Id, Map<Id, number>>();
    const judgeTotals = new Map<Id, Map<Id, number>>();
    for (const judgeId of judgeIds) {
      const r = judgeOrdinals(segment, judgeId, entryIds, mark, config.judgeTieRules);
      ordinals.set(judgeId, r.ordinals);
      judgeTotals.set(judgeId, r.totals);
    }

    const complete = missing === 0 && judgeIds.length > 0 && entryIds.length > 0;
    let places = new Map<Id, number>();
    let steps: ExplainStep[] = [];
    if (complete) {
      const candidates: Candidate[] = entryIds.map((entryId) => ({
        entryId,
        ordinals: judgeIds.map((j) => ordinals.get(j)!.get(entryId)!),
        judgeTotals: judgeIds.map((j) => judgeTotals.get(j)!.get(entryId)!),
      }));
      ({ places, steps } = placeByMajority(candidates, judgeIds.length, config.tieBreaks));
    }
    return {
      segmentId: segment.id,
      name: segment.name,
      complete,
      missingMarks: missing,
      ordinals,
      judgeTotals,
      places,
      steps,
    };
  });

  const complete = segments.length > 0 && judgeIds.length > 0 && segmentResults.every((s) => s.complete);
  const { overall, steps: overallSteps } = complete
    ? combine(input, segmentResults, config)
    : { overall: [], steps: [] };

  return {
    complete,
    missingMarks,
    totalMarks,
    majority: majorityOf(judgeIds.length),
    segments: segmentResults,
    overall,
    overallSteps,
  };
}

/**
 * Combines segment places into the event result: lowest weighted sum of places wins.
 * Ties go to the better free dance place, then the higher total points.
 */
function combine(
  input: ScoringInput,
  segmentResults: SegmentResult[],
  config: ScoringConfig,
): { overall: OverallRow[]; steps: ExplainStep[] } {
  const { entryIds, judgeIds, segments } = input;
  const freeIndex = segments.findIndex((s) => s.kind === 'free');

  // Each judge's total for the event (all dances), their ranking of entries, and major victories.
  const eventTotals = new Map(
    judgeIds.map((j) => [
      j,
      new Map(
        entryIds.map((e) => [
          e,
          segmentResults.reduce((sum, s) => sum + (s.judgeTotals.get(j)?.get(e) ?? 0), 0),
        ]),
      ),
    ]),
  );
  const rankings = judgeEventRankings(entryIds, eventTotals);
  const victories = majorVictories(entryIds, judgeIds, rankings);

  const rows = entryIds.map((entryId) => {
    const segmentPlaces = segmentResults.map((s) => s.places.get(entryId));
    const score = segments.reduce(
      (sum, seg, i) => sum + config.segmentFactor(seg) * (segmentPlaces[i] ?? 0),
      0,
    );
    const totalTenths = segmentResults.reduce(
      (sum, s) => sum + [...s.judgeTotals.values()].reduce((t, m) => t + (m.get(entryId) ?? 0), 0),
      0,
    );
    const freePlace = freeIndex >= 0 ? (segmentPlaces[freeIndex] ?? 0) : 0;
    return { entryId, segmentPlaces, score, totalTenths, freePlace };
  });

  // A single-segment event's result is the segment result, ties included.
  const single = segments.length === 1;
  const keys = (r: (typeof rows)[number]) => (single ? [r.score] : [r.score, r.freePlace, -r.totalTenths]);
  rows.sort((a, b) => {
    const ka = keys(a);
    const kb = keys(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!;
    return 0;
  });

  const overall: OverallRow[] = [];
  const steps: ExplainStep[] = [];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    const same = (o?: typeof r) => o && keys(o).every((k, idx) => k === keys(r)[idx]);
    const place = prev && same(prev) ? overall[i - 1]!.place : i + 1;
    const tied = !!(same(prev) || same(next));
    overall.push({
      ...r,
      place,
      tied,
      judgeRanks: judgeIds.map((j) => rankings.get(j)!.get(r.entryId)!),
      majorVictories: victories.get(r.entryId)!,
    });

    if (single) return;
    const decider = (o?: typeof r) =>
      !o
        ? null
        : o.score !== r.score
          ? null
          : o.freePlace !== r.freePlace
            ? 'Better free dance place'
            : o.totalTenths !== r.totalTenths
              ? 'Higher total points'
              : 'Tie';
    const rule = decider(prev) ?? decider(next) ?? 'Sum of places';
    if (prev && same(prev)) steps[steps.length - 1]!.entryIds.push(r.entryId);
    else
      steps.push({
        place,
        entryIds: [r.entryId],
        rule,
        detail: `places ${r.segmentPlaces.join(' + ')} = ${r.score}; total points ${(r.totalTenths / 10).toFixed(1)}`,
      });
  });

  if (single) steps.push(...segmentResults[0]!.steps);
  return { overall, steps };
}
