export type Id = string;

export interface Competition {
  id: Id;
  name: string;
  date: string; // ISO yyyy-mm-dd
  venue: string;
  /** Club colours (hex, e.g. "#0b1d3a") for the competition's card and title band; unset = defaults. */
  primaryColor?: string;
  secondaryColor?: string;
  /** The programme's welcome message (blank lines separate paragraphs); unset = a standard welcome. */
  welcome?: string;
  createdAt: number;
  updatedAt: number;
}

/** Catalogue of compulsory dances, per competition so exports are self-contained. */
export interface Dance {
  id: Id;
  competitionId: Id;
  name: string;
}

/** Dance events are skated by solos, duos, couples or teams; figures & free events by singles or pairs. */
export type EntryType = 'solo' | 'duo' | 'couples' | 'team' | 'single' | 'pairs';
/** Dance: compulsory dances + free dance. Figures: compulsory figures + short/free programmes. */
export type EventDiscipline = 'dance' | 'figures';
/** Setup (no skaters yet) → ready (has skaters) → scoring (marks entered) → final (locked). */
export type EventStatus = 'setup' | 'ready' | 'scoring' | 'final';

export interface CompEvent {
  id: Id;
  competitionId: Id;
  name: string;
  order: number;
  entryType: EntryType;
  /** Ordered list of compulsory dance ids (0–10; usually 1–2 for solo, 3–4 for team). */
  compulsoryDanceIds: Id[];
  hasFreeDance: boolean;
  discipline: EventDiscipline;
  /** Ordered compulsory figures (0–4; figures events only). */
  figures: EventFigure[];
  /** Short and free programmes (A + B marks; figures events only). */
  hasShort: boolean;
  hasLong: boolean;
  /** Factors applied to each part's marks in a judge's sum, in hundredths (300 = ×3). */
  factors: Factors;
  /** Ordered judge panel; may be empty until the day. */
  judgeIds: Id[];
  /** The event's referee (a person from the judges roster; may also sit on the panel). Gives no marks. */
  refereeId?: Id;
  status: EventStatus;
}

export type FigureSide = 'L' | 'R';

/** A compulsory figure from the catalogue (`src/domain/figures.ts`), optionally on one side. */
export interface EventFigure {
  figureId: string;
  side?: FigureSide;
}

export interface Factors {
  figures: number;
  short: number;
  long: number;
}

export interface Skater {
  id: Id;
  competitionId: Id;
  name: string;
  club: string;
}

/** A competing unit in an event: a solo skater, a duo, or a team. */
export interface Entry {
  id: Id;
  eventId: Id;
  startOrder: number;
  skaterIds: Id[];
  /** Team name (teams) — optional display override for others. */
  teamName?: string;
  club?: string;
}

export interface Judge {
  id: Id;
  competitionId: Id;
  name: string;
}

/**
 * Segment keys identify what a mark is for:
 *  - `cd:<danceId>` compulsory dance (one mark)
 *  - `fd:A` / `fd:B` free dance A and B marks
 *  - `cf:<figureId>:<L|R|->` compulsory figure (one mark)
 *  - `sp:A` / `sp:B`, `lp:A` / `lp:B` short and free programme A and B marks
 */
export type SegmentKey =
  `cd:${string}` | 'fd:A' | 'fd:B' | `cf:${string}` | 'sp:A' | 'sp:B' | 'lp:A' | 'lp:B';

export interface Mark {
  eventId: Id;
  segmentKey: SegmentKey;
  judgeId: Id;
  entryId: Id;
  /** Integer tenths, 0–100 (57 = 5.7). */
  tenths: number;
}

export const MAX_COMPULSORY_DANCES = 10;
export const MAX_FIGURES = 4;
