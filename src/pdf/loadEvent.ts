import { db } from '../db/db';
import { byId, entryClub, entryMembers, entryName } from '../domain/entryName';
import { seatMark, seatSwaps, type SeatSwap } from '../domain/panels';
import { effectiveRotate, firstSkaters, partOrderPositions } from '../domain/startOrder';
import { eventSegments, eventTieBreakMarks, type Segment } from '../domain/segments';
import type { CompEvent, Competition, Id, Judge, SegmentKey } from '../domain/types';
import { markKey, indexMarks } from '../domain/markIndex';
import { calculateEvent, type EventResult } from '../scoring';

export interface EventRow {
  id: Id;
  name: string;
  club: string;
  members: string;
  skaterIds: Id[];
}

export interface EventData {
  competition: Competition;
  event: CompEvent;
  /** The event's number in the competition's running order, from 1. */
  number: number;
  segments: Segment[];
  /** Rotating start order: segment id -> position in `rows` of the entry that skates it first. */
  firstSkaters: Map<string, number>;
  /** Parts with their own start order: segment id -> positions in `rows` in the order the part is skated. */
  partOrders?: Map<string, number[]>;
  rows: EventRow[];
  judges: Judge[];
  /** Judges who sit in a seat for only some parts (see `domain/panels.ts`). */
  swaps?: SeatSwap[];
  referee?: Judge;
  assistantReferee?: Judge;
  mark: (key: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;
  result: EventResult;
  /** Set when the results are from one kind of part alone rather than the whole event (see `scopedResults.ts`). */
  scope?: { label: string; basedOn: string[]; notMarked: string[] };
}

/** Loads one event and scores it, outside React (for PDF generation). */
export async function loadEventData(eventId: Id): Promise<EventData> {
  const event = (await db.events.get(eventId))!;
  const competition = (await db.competitions.get(event.competitionId))!;
  const [siblings, dances, skaterList, judgeList, entries, marks] = await Promise.all([
    db.events.where({ competitionId: event.competitionId }).sortBy('order'),
    db.dances.where({ competitionId: event.competitionId }).toArray(),
    db.skaters.where({ competitionId: event.competitionId }).toArray(),
    db.judges.where({ competitionId: event.competitionId }).toArray(),
    db.entries.where({ eventId }).sortBy('startOrder'),
    db.marks.where({ eventId }).toArray(),
  ]);
  const skaters = byId(skaterList);
  const judgeMap = byId(judgeList);
  const segments = eventSegments(event, dances);
  const markMap = indexMarks(marks);
  const mark = seatMark(event, (k: SegmentKey, j: Id, e: Id) => markMap.get(markKey(k, j, e)));
  const result = calculateEvent({
    entryIds: entries.map((e) => e.id),
    judgeIds: event.judgeIds,
    segments,
    mark,
    tieBreakMarks: eventTieBreakMarks(event),
  });
  return {
    competition,
    event,
    number: siblings.findIndex((e) => e.id === eventId) + 1,
    segments,
    firstSkaters: firstSkaters(segments, entries.length, effectiveRotate(event, competition)),
    partOrders: partOrderPositions(
      event,
      segments,
      entries.map((e) => e.id),
    ),
    rows: entries.map((e) => ({
      id: e.id,
      name: entryName(e, skaters),
      club: entryClub(e, skaters),
      members: event.entryType === 'team' ? entryMembers(e, skaters) : '',
      skaterIds: e.skaterIds,
    })),
    judges: event.judgeIds.map((id) => judgeMap.get(id)!).filter(Boolean),
    swaps: seatSwaps(event, segments, (id) => judgeMap.get(id)),
    referee: event.refereeId ? judgeMap.get(event.refereeId) : undefined,
    assistantReferee: event.assistantRefereeId ? judgeMap.get(event.assistantRefereeId) : undefined,
    mark,
    result,
  };
}

export async function loadCompetitionEvents(competitionId: Id) {
  const events = await db.events.where({ competitionId }).sortBy('order');
  return Promise.all(events.map((e) => loadEventData(e.id)));
}
