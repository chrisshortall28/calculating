import { db } from '../db/db';
import { byId, entryClub, entryMembers, entryName } from '../domain/entryName';
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
  segments: Segment[];
  rows: EventRow[];
  judges: Judge[];
  referee?: Judge;
  mark: (key: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;
  result: EventResult;
}

/** Loads one event and scores it, outside React (for PDF generation). */
export async function loadEventData(eventId: Id): Promise<EventData> {
  const event = (await db.events.get(eventId))!;
  const competition = (await db.competitions.get(event.competitionId))!;
  const [dances, skaterList, judgeList, entries, marks] = await Promise.all([
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
  const mark = (k: SegmentKey, j: Id, e: Id) => markMap.get(markKey(k, j, e));
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
    segments,
    rows: entries.map((e) => ({
      id: e.id,
      name: entryName(e, skaters),
      club: entryClub(e, skaters),
      members: event.entryType === 'team' ? entryMembers(e, skaters) : '',
      skaterIds: e.skaterIds,
    })),
    judges: event.judgeIds.map((id) => judgeMap.get(id)!).filter(Boolean),
    referee: event.refereeId ? judgeMap.get(event.refereeId) : undefined,
    mark,
    result,
  };
}

export async function loadCompetitionEvents(competitionId: Id) {
  const events = await db.events.where({ competitionId }).sortBy('order');
  return Promise.all(events.map((e) => loadEventData(e.id)));
}
