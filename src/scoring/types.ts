import type { Id, SegmentKey } from '../domain/types';

export interface ScoringSegment {
  id: string;
  name: string;
  kind: 'compulsory' | 'free';
  markKeys: SegmentKey[];
}

/** Returns the mark in tenths, or undefined if not entered. */
export type MarkLookup = (markKey: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;

export interface ScoringInput {
  entryIds: Id[];
  judgeIds: Id[];
  segments: ScoringSegment[];
  mark: MarkLookup;
}

/** Per-entry data a tie-break rule can use when ranking a segment. */
export interface Candidate {
  entryId: Id;
  /** ordinal given by each judge (same order as judgeIds) */
  ordinals: number[];
  /** total tenths awarded by each judge (A+B for free dance) */
  judgeTotals: number[];
}

export interface TieBreakContext {
  /** the place column being examined ("kth place or better") */
  column: number;
  majority: number;
  entryCount: number;
}

/**
 * A tie-break rule scores each candidate; lower score ranks higher.
 * Candidates with equal scores remain tied and go to the next rule.
 */
export interface TieBreakRule {
  id: string;
  label: string;
  score: (c: Candidate, ctx: TieBreakContext) => number | number[];
  describe: (c: Candidate, ctx: TieBreakContext) => string;
}

export interface ExplainStep {
  place: number;
  entryIds: Id[];
  rule: string;
  detail: string;
}

export interface SegmentResult {
  segmentId: string;
  name: string;
  complete: boolean;
  missingMarks: number;
  /** judgeId -> entryId -> ordinal */
  ordinals: Map<Id, Map<Id, number>>;
  /** judgeId -> entryId -> total tenths */
  judgeTotals: Map<Id, Map<Id, number>>;
  /** entryId -> place (only when complete) */
  places: Map<Id, number>;
  steps: ExplainStep[];
}

export interface OverallRow {
  entryId: Id;
  place: number;
  /** combined score used for ranking (e.g. sum of weighted segment places) */
  score: number;
  segmentPlaces: (number | undefined)[];
  totalTenths: number;
  tied: boolean;
  /** Each judge's ranking of this entry for the whole event (same order as judgeIds). */
  judgeRanks: number[];
  /** Number of other entries that a majority of judges ranked this entry above. */
  majorVictories: number;
}

export interface EventResult {
  complete: boolean;
  missingMarks: number;
  totalMarks: number;
  majority: number;
  segments: SegmentResult[];
  overall: OverallRow[];
  overallSteps: ExplainStep[];
}

export type JudgeTieRule = 'share' | 'freeDanceB' | 'freeDanceA';

export interface ScoringConfig {
  /** How to split equal totals from one judge when forming ordinals. */
  judgeTieRules: JudgeTieRule[];
  /** Ordered tie-break rules applied when several entries reach a majority together. */
  tieBreaks: TieBreakRule[];
  /** Factor applied to each segment place when combining (default 1). */
  segmentFactor: (segment: ScoringSegment) => number;
}
