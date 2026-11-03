import type { Id } from '../domain/types';
import { calculateEvent } from '../scoring';
import type { EventResult, PlacementRule, ScoringInput, TieBreakMark } from '../scoring/types';
import type { EventProfile, Part, PhaseCode } from './profiles';

/**
 * What the application stores after an event's entries: the table of victories and the results in
 * order of place. Worked out from Podium's own scoring (checked against 72 real events: every field
 * of every row, and every cell of the table inside the real entries).
 */
export interface TailRow {
  /** The entry's number in start order, from 1. */
  entry: number;
  /** The application's code for the rule that placed the entry. */
  ruleCode: number;
  place: number;
  /** Majority victories, in tenths. */
  majorityTenths: number;
  /** Separate majority victories among the tied entries (rules 6A/6B), in tenths; 0 when not tied. */
  separateTenths: number;
  /** All the judges' B marks of the free dance or long programme, in tenths; 0 for events without one. */
  bMarkTenths: number;
  /** All the judges' B marks of the short programme, in tenths (figures events); 0 for events without one. */
  shortBMarkTenths: number;
  /** Total victories, in tenths. */
  totalVictoriesTenths: number;
  /** Total sum, in thousandths of a mark. */
  sum: number;
  /** Which tie-break steps were tried: 1 majority, 2 separate victories, 4 and 8 the B marks, 16 total victories, 32 total sums. */
  steps: number;
}

export interface Tail {
  /** Victories of entry i over entry j in tenths (halves possible), N by N. */
  victories: number[][];
  /** In order of place. */
  rows: TailRow[];
}

const RULE_CODES: Record<PlacementRule, number> = {
  '5': 0,
  '6A': 1,
  '6B': 1,
  '7B': 22,
  '7C': 26,
  '7A': 28,
  // Not seen in the sample files (a shared place); the code of the last rule is the best guess.
  '8': 28,
};

const STEP_BITS = { '6A': 2, '6B': 2, '7C': 16, '7A': 32 } as const;

/** `bMarkTenths[i]` is entry i's total of the free dance B marks (or 0). */
export function tailFromResult(
  result: EventResult,
  entryIds: Id[],
  bMarkTenths: number[],
  shortBMarkTenths: number[] = [],
): Tail {
  const index = new Map(entryIds.map((id, i) => [id, i]));
  const victories = entryIds.map((a) =>
    entryIds.map((b) => (a === b ? 0 : Math.round((result.victories.get(a)?.get(b) ?? 0) * 10))),
  );
  const rows = result.overall.map((o): TailRow => {
    // Separate victories come from the first tie-break the entry was in.
    const first = result.steps.find((s) => s.contenders.includes(o.entryId) && s.trail.length > 0)?.trail[0];
    const separate =
      first && (first.rule === '6A' || first.rule === '6B')
        ? Math.round((first.values.find((v) => v.entryId === o.entryId)?.value ?? 0) * 10)
        : 0;
    const awarded = result.steps.find((s) => s.entryIds.includes(o.entryId));
    let steps = 1;
    let bMarkSteps = 0;
    for (const application of awarded?.trail ?? []) {
      if (application.rule === '7B') steps |= bMarkSteps++ === 0 ? 4 : 8;
      else steps |= STEP_BITS[application.rule];
    }
    return {
      entry: index.get(o.entryId)! + 1,
      ruleCode: RULE_CODES[o.rule],
      place: o.place,
      majorityTenths: Math.round(o.majorityVictories * 10),
      separateTenths: separate,
      bMarkTenths: bMarkTenths[index.get(o.entryId)!] ?? 0,
      shortBMarkTenths: shortBMarkTenths[index.get(o.entryId)!] ?? 0,
      totalVictoriesTenths: Math.round(o.totalVictories * 10),
      sum: o.totalSum,
      steps,
    };
  });
  return { victories, rows };
}

/** Which part of the event a scored segment is. */
function partOf(segment: ScoringInput['segments'][number]): Part {
  if (segment.kind === 'compulsory') return 'C';
  return segment.id === 'sp' ? 'S' : 'L';
}

/** The judges' B mark totals per entry, in tenths: the free dance or long programme, and the short programme. */
export interface BMarkTotals {
  long: number[];
  short?: number[];
}

/**
 * The tables for each phase of an event: each part alone or together with others (see profiles.ts),
 * each scored on its own. `bMarks` has each entry's totals of the B marks. `tieBreaksOf` gives the B marks that
 * break ties in a phase (default: the input's).
 */
export function phaseTails(
  profile: EventProfile,
  input: ScoringInput,
  bMarks: BMarkTotals,
  tieBreaksOf: (phase: PhaseCode) => TieBreakMark[] = () => input.tieBreakMarks ?? [],
): Record<PhaseCode, Tail> {
  const tails = {} as Record<PhaseCode, Tail>;
  for (const phase of profile.phases) {
    const parts = profile.parts[phase]!;
    // A part scored alone is not factored; a combined phase uses the segments' factors.
    const segments = input.segments
      .filter((segment) => parts.includes(partOf(segment)))
      .map((segment) => (parts.length > 1 ? segment : { ...segment, factor: 100 }));
    const result = calculateEvent({ ...input, segments, tieBreakMarks: tieBreaksOf(phase) });
    const zeros = input.entryIds.map(() => 0);
    // The long programme's B marks show in the phases that include it, the short programme's in every phase but the first.
    const long = parts.includes('L') ? bMarks.long : zeros;
    const short = phase === 1 ? zeros : (bMarks.short ?? zeros);
    tails[phase] = tailFromResult(result, input.entryIds, long, short);
  }
  return tails;
}
