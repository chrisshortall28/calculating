import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Id } from '../domain/types';

export function useCompetition(compId: Id | undefined) {
  return useLiveQuery(() => (compId ? db.competitions.get(compId) : undefined), [compId]);
}

export function useDances(compId: Id) {
  return useLiveQuery(
    () =>
      db.dances
        .where({ competitionId: compId })
        .toArray()
        .then((d) => d.sort((a, b) => a.name.localeCompare(b.name))),
    [compId],
  );
}

export function useSkaters(compId: Id) {
  return useLiveQuery(
    () =>
      db.skaters
        .where({ competitionId: compId })
        .toArray()
        .then((s) => s.sort((a, b) => a.name.localeCompare(b.name))),
    [compId],
  );
}

export function useJudges(compId: Id) {
  return useLiveQuery(
    () =>
      db.judges
        .where({ competitionId: compId })
        .toArray()
        .then((j) => j.sort((a, b) => a.name.localeCompare(b.name))),
    [compId],
  );
}

export function useEvents(compId: Id) {
  return useLiveQuery(() => db.events.where({ competitionId: compId }).sortBy('order'), [compId]);
}

export function useEvent(eventId: Id | undefined) {
  return useLiveQuery(() => (eventId ? db.events.get(eventId) : undefined), [eventId]);
}

export function useEntries(eventId: Id) {
  return useLiveQuery(() => db.entries.where({ eventId }).sortBy('startOrder'), [eventId]);
}

export function useMarks(eventId: Id) {
  return useLiveQuery(() => db.marks.where({ eventId }).toArray(), [eventId]);
}
