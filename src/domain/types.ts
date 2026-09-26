export type Id = string;

export interface Competition {
  id: Id;
  name: string;
  date: string; // ISO yyyy-mm-dd
  venue: string;
  /** Club colours (hex, e.g. "#0b1d3a") for the competition's card and title band; unset = defaults. */
  primaryColor?: string;
  secondaryColor?: string;
  createdAt: number;
  updatedAt: number;
}

/** Catalogue of compulsory dances, per competition so exports are self-contained. */
export interface Dance {
  id: Id;
  competitionId: Id;
  name: string;
}

export type EntryType = 'solo' | 'duo' | 'team';
export type EventStatus = 'setup' | 'scoring' | 'final';

export interface CompEvent {
  id: Id;
  competitionId: Id;
  name: string;
  order: number;
  entryType: EntryType;
  /** Ordered list of compulsory dance ids (0–3). */
  compulsoryDanceIds: Id[];
  hasFreeDance: boolean;
  /** Ordered judge panel; may be empty until the day. */
  judgeIds: Id[];
  /** The event's referee (a person from the judges roster; may also sit on the panel). Gives no marks. */
  refereeId?: Id;
  status: EventStatus;
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
 */
export type SegmentKey = `cd:${string}` | 'fd:A' | 'fd:B';

export interface Mark {
  eventId: Id;
  segmentKey: SegmentKey;
  judgeId: Id;
  entryId: Id;
  /** Integer tenths, 0–100 (57 = 5.7). */
  tenths: number;
}

export const MAX_COMPULSORY_DANCES = 3;
