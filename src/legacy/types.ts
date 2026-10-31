/** What was read from one Calculating For Windows event file (`DATAnnnB.ROL`). See docs/legacy-format.md. */

/** Notes from reading or converting; `warning`s mean something was skipped or guessed. */
export interface LegacyWarning {
  level: 'info' | 'warning';
  /** The event the note is about, when it is about one. */
  event?: string;
  message: string;
}

/** The legacy "Type" of an event: only Solo Dance, Couples Dance, Single and Pairs events are imported. */
export type LegacyEventKind = 'dance' | 'couples' | 'single' | 'pairs' | 'unsupported';

/** A compulsory dance (dance events, `code` is the legacy dance number) or figure (`code` is the figure number). */
export interface LegacyCompulsory {
  code: number;
  side?: 'L' | 'R';
}

/** A factor as the legacy app stores it: a fraction, e.g. 3/2. */
export interface LegacyFraction {
  numerator: number;
  denominator: number;
}

/**
 * One judge-by-judge set of marks, in tenths. Index 0-3 are compulsory dances or figures 1-4, 4-5
 * the short programme A and B, 6-7 the free dance or long programme A and B; `null` when not marked.
 */
export type LegacyBlocks = (number[] | null)[];

export interface LegacyEntry {
  name: string;
  /** The second skater's name in a pairs or couples event. */
  partner: string;
  club: string;
  blocks: LegacyBlocks;
}

export interface LegacyEvent {
  fileName: string;
  competition: { name: string; venue: string; date: string };
  name: string;
  /** The raw event type byte (8 = Solo Dance, 7 = Couples Dance, 0 = Single, 1 = Pairs). */
  typeCode: number;
  kind: LegacyEventKind;
  judges: string[];
  referee: string;
  compulsory: LegacyCompulsory[];
  hasShort: boolean;
  hasLong: boolean;
  factors: { compulsory: LegacyFraction; short: LegacyFraction; long: LegacyFraction };
  entries: LegacyEntry[];
  warnings: LegacyWarning[];
}

/** Events that belong to one competition (the same name, venue and date). */
export interface LegacyCompetition {
  name: string;
  venue: string;
  date: string;
  events: LegacyEvent[];
}
