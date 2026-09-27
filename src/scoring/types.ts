import type { Id, SegmentKey } from '../domain/types';

export interface ScoringSegment {
  id: string;
  name: string;
  kind: 'compulsory' | 'free';
  markKeys: SegmentKey[];
  /** Multiplies the segment's marks in a judge's sum, in hundredths (default 100 = ×1). */
  factor?: number;
}

/** A B (artistic impression) mark that splits equal sums (rule 3) and breaks ties (rule 7B). */
export interface TieBreakMark {
  key: SegmentKey;
  /** e.g. "free dance", "long programme" */
  label: string;
}

/**
 * Judge sums are integers in thousandths of a mark: tenths × a factor in hundredths, so factored
 * sums (e.g. 8.5 × 1.25 = 10.625) stay exact.
 */
export const SUM_PER_POINT = 1000;

/** Returns the mark in tenths, or undefined if not entered. */
export type MarkLookup = (markKey: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;

export interface ScoringInput {
  entryIds: Id[];
  judgeIds: Id[];
  segments: ScoringSegment[];
  mark: MarkLookup;
  /**
   * B marks that split equal sums and break ties, in the order applied (one 7B step each). Those
   * whose segment isn't among `segments` are ignored.
   */
  tieBreakMarks: TieBreakMark[];
}

/**
 * CIPA placement rules, numbered as in the CIPA scoring manual:
 *  - `5`  most majority victories (no tie)
 *  - `6A` / `6B` separate victories between the tied entries (3 or more tied / 2 tied)
 *  - `7B` total B (artistic impression) marks of one part (free dance, long or short programme)
 *  - `7C` total victories
 *  - `7A` total sums
 *  - `8`  still equal: the place is shared
 */
export type PlacementRule = '5' | '6A' | '6B' | '7B' | '7C' | '7A' | '8';

/** One tie-break rule applied to the entries still in contention for a place. */
export interface RuleApplication {
  rule: Exclude<PlacementRule, '5' | '8'>;
  /** Each contender's value under the rule; the highest value stays in contention. */
  values: { entryId: Id; value: number }[];
  /** 7B: whose B marks were totalled, e.g. "long programme". */
  label?: string;
}

/** How one place (or a shared place) was awarded. */
export interface PlacementStep {
  place: number;
  /** Entries awarded this place (more than one only under rule 8). */
  entryIds: Id[];
  /** The rule that decided the place. */
  rule: PlacementRule;
  /** Majority victories the entries were tied on (tie steps only). */
  tiedOn?: number;
  /** Entries tied for this place when the tie-break started (tie steps only). */
  contenders: Id[];
  /** The tie-break rules applied, in order (tie steps only). */
  trail: RuleApplication[];
}

/** A judge who gave two entries the same sum (rule 3). */
export interface JudgeTie {
  judgeId: Id;
  entryIds: [Id, Id];
  /** The equal sum, in thousandths (see SUM_PER_POINT). */
  sum: number;
  /** Winner on a B mark, or undefined for a half victory each. */
  winner?: Id;
  /** The B marks compared, in order, until one differed (tenths). */
  bMarks?: { label: string; marks: [number, number] }[];
}

export interface SegmentResult {
  segmentId: string;
  name: string;
  complete: boolean;
  missingMarks: number;
  /** judgeId -> entryId -> that judge's ranking for this dance (shown while scoring) */
  ordinals: Map<Id, Map<Id, number>>;
  /** judgeId -> entryId -> total tenths for this dance */
  judgeTotals: Map<Id, Map<Id, number>>;
}

export interface OverallRow {
  entryId: Id;
  place: number;
  /** The place is shared with another entry (rule 8). */
  tied: boolean;
  /** The rule that decided the place: `5` unless the entry was tied on majority victories. */
  rule: PlacementRule;
  /** Majority victories (halves possible). */
  majorityVictories: number;
  /** Total victories: every judge victory over every other entry (halves possible). */
  totalVictories: number;
  /** Total sums: all judges' sums, in thousandths (see SUM_PER_POINT). */
  totalSum: number;
  /** Each judge's (factored) sum for the event, in thousandths (same order as judgeIds). */
  judgeSums: number[];
  /** Each judge's ranking of this entry for the event, by sum (same order as judgeIds). */
  judgeRanks: number[];
}

export interface EventResult {
  complete: boolean;
  missingMarks: number;
  totalMarks: number;
  majority: number;
  /** The B marks that split equal sums and break ties (rules 3 and 7B), in order. */
  tieBreakMarks: TieBreakMark[];
  segments: SegmentResult[];
  /** Table of victories: entryId -> opponent entryId -> judge victories (halves possible). */
  victories: Map<Id, Map<Id, number>>;
  judgeTies: JudgeTie[];
  /** Placings in order (empty until every mark is in). */
  overall: OverallRow[];
  steps: PlacementStep[];
}
