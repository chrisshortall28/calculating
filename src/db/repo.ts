import type {
  CompEvent,
  Competition,
  Entry,
  EntryType,
  Id,
  Judge,
  Mark,
  SegmentKey,
  Skater,
} from '../domain/types';
import { cdKey } from '../domain/segments';
import { db, newId, type MarkPK } from './db';

export const DEFAULT_DANCES = [
  'Glide Waltz',
  'Skaters March',
  'Dutch Waltz',
  'Canasta Tango',
  'Fourteen Step',
  'Rocker Foxtrot',
  'Harris Tango',
  'Kilian',
  'Westminster Waltz',
  'Blues',
  'Quickstep',
  'Paso Doble',
  'Starlight Waltz',
  'Viennese Waltz',
  'Argentine Tango',
  'Tango Delanco',
  'Denver Shuffle',
  'Siesta Tango',
];

const touch = (competitionId: Id) => db.competitions.update(competitionId, { updatedAt: Date.now() });

async function competitionOfEvent(eventId: Id) {
  const ev = await db.events.get(eventId);
  if (ev) await touch(ev.competitionId);
}

// ---------- Competitions ----------

export async function createCompetition(
  data: Pick<Competition, 'name' | 'date' | 'venue' | 'primaryColor' | 'secondaryColor'>,
) {
  const now = Date.now();
  const comp: Competition = { id: newId(), ...data, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.competitions, db.dances, async () => {
    await db.competitions.add(comp);
    await db.dances.bulkAdd(DEFAULT_DANCES.map((name) => ({ id: newId(), competitionId: comp.id, name })));
  });
  return comp.id;
}

export async function updateCompetition(id: Id, data: Partial<Omit<Competition, 'id'>>) {
  await db.competitions.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteCompetition(id: Id) {
  await db.transaction('rw', db.tables, async () => {
    const eventIds = await db.events.where({ competitionId: id }).primaryKeys();
    await db.marks.where('eventId').anyOf(eventIds).delete();
    await db.entries.where('eventId').anyOf(eventIds).delete();
    await db.events.bulkDelete(eventIds);
    await db.dances.where({ competitionId: id }).delete();
    await db.skaters.where({ competitionId: id }).delete();
    await db.judges.where({ competitionId: id }).delete();
    await db.competitions.delete(id);
  });
}

// ---------- Dances ----------

export async function addDance(competitionId: Id, name: string) {
  const id = newId();
  await db.dances.add({ id, competitionId, name });
  return id;
}

export const renameDance = (id: Id, name: string) => db.dances.update(id, { name });

export async function deleteDance(id: Id) {
  const dance = await db.dances.get(id);
  if (!dance) return;
  await db.transaction('rw', db.dances, db.events, db.marks, async () => {
    const events = await db.events.where({ competitionId: dance.competitionId }).toArray();
    for (const ev of events.filter((e) => e.compulsoryDanceIds.includes(id))) {
      await db.events.update(ev.id, {
        compulsoryDanceIds: ev.compulsoryDanceIds.filter((d) => d !== id),
      });
      await db.marks
        .where({ eventId: ev.id })
        .filter((m) => m.segmentKey === cdKey(id))
        .delete();
    }
    await db.dances.delete(id);
  });
}

// ---------- Events ----------

export async function createEvent(
  competitionId: Id,
  data: Pick<CompEvent, 'name' | 'entryType' | 'compulsoryDanceIds' | 'hasFreeDance'>,
) {
  const count = await db.events.where({ competitionId }).count();
  const id = newId();
  await db.events.add({ id, competitionId, order: count, judgeIds: [], status: 'setup', ...data });
  await touch(competitionId);
  return id;
}

/** Marks that would be removed if the event's dances/judges changed as given. */
export async function marksAffectedByEventChange(eventId: Id, next: Partial<CompEvent>) {
  const ev = await db.events.get(eventId);
  if (!ev) return 0;
  const keys = new Set<SegmentKey>((next.compulsoryDanceIds ?? ev.compulsoryDanceIds).map(cdKey));
  if (next.hasFreeDance ?? ev.hasFreeDance) {
    keys.add('fd:A');
    keys.add('fd:B');
  }
  const judges = new Set(next.judgeIds ?? ev.judgeIds);
  return db.marks
    .where({ eventId })
    .filter((m) => !keys.has(m.segmentKey) || !judges.has(m.judgeId))
    .count();
}

export async function updateEvent(eventId: Id, data: Partial<Omit<CompEvent, 'id'>>) {
  await db.transaction('rw', db.events, db.marks, db.competitions, async () => {
    await db.events.update(eventId, data);
    const ev = (await db.events.get(eventId))!;
    const keys = new Set<string>(ev.compulsoryDanceIds.map(cdKey));
    if (ev.hasFreeDance) {
      keys.add('fd:A');
      keys.add('fd:B');
    }
    const judges = new Set(ev.judgeIds);
    await db.marks
      .where({ eventId })
      .filter((m) => !keys.has(m.segmentKey) || !judges.has(m.judgeId))
      .delete();
    await touch(ev.competitionId);
  });
}

export const setEventStatus = (eventId: Id, status: CompEvent['status']) =>
  db.events.update(eventId, { status });

export async function deleteEvent(eventId: Id) {
  await competitionOfEvent(eventId);
  await db.transaction('rw', db.events, db.entries, db.marks, async () => {
    await db.marks.where({ eventId }).delete();
    await db.entries.where({ eventId }).delete();
    await db.events.delete(eventId);
  });
}

export async function reorderEvents(orderedIds: Id[]) {
  await db.transaction('rw', db.events, async () => {
    await Promise.all(orderedIds.map((id, order) => db.events.update(id, { order })));
  });
}

// ---------- Skaters ----------

export async function addSkater(competitionId: Id, data: Pick<Skater, 'name' | 'club'>) {
  const id = newId();
  await db.skaters.add({ id, competitionId, ...data });
  return id;
}

export async function addSkaters(competitionId: Id, list: Pick<Skater, 'name' | 'club'>[]) {
  await db.skaters.bulkAdd(list.map((data) => ({ id: newId(), competitionId, ...data })));
}

export const updateSkater = (id: Id, data: Partial<Pick<Skater, 'name' | 'club'>>) =>
  db.skaters.update(id, data);

/** Deleting a skater removes them from entries; entries left empty are deleted with their marks. */
export async function deleteSkater(id: Id) {
  await db.transaction('rw', db.skaters, db.entries, db.marks, async () => {
    const entries = await db.entries.filter((e) => e.skaterIds.includes(id)).toArray();
    for (const e of entries) {
      const skaterIds = e.skaterIds.filter((s) => s !== id);
      if (skaterIds.length === 0 && !e.teamName) await deleteEntryTx(e.id);
      else await db.entries.update(e.id, { skaterIds });
    }
    await db.skaters.delete(id);
  });
}

// ---------- Entries ----------

export async function addEntry(eventId: Id, data: Pick<Entry, 'skaterIds' | 'teamName' | 'club'>) {
  const count = await db.entries.where({ eventId }).count();
  const id = newId();
  await db.entries.add({ id, eventId, startOrder: count, ...data });
  await competitionOfEvent(eventId);
  return id;
}

export const updateEntry = (id: Id, data: Partial<Pick<Entry, 'skaterIds' | 'teamName' | 'club'>>) =>
  db.entries.update(id, data);

async function deleteEntryTx(id: Id) {
  await db.marks.where({ entryId: id }).delete();
  await db.entries.delete(id);
}

export async function deleteEntry(id: Id) {
  await db.transaction('rw', db.entries, db.marks, async () => {
    const entry = await db.entries.get(id);
    await deleteEntryTx(id);
    if (entry) {
      const rest = await db.entries.where({ eventId: entry.eventId }).sortBy('startOrder');
      await Promise.all(rest.map((e, i) => db.entries.update(e.id, { startOrder: i })));
    }
  });
}

export async function reorderEntries(orderedIds: Id[]) {
  await db.transaction('rw', db.entries, async () => {
    await Promise.all(orderedIds.map((id, startOrder) => db.entries.update(id, { startOrder })));
  });
}

// ---------- Judges ----------

export async function addJudge(competitionId: Id, name: string) {
  const id = newId();
  await db.judges.add({ id, competitionId, name });
  return id;
}

export const updateJudge = (id: Id, data: Partial<Pick<Judge, 'name'>>) => db.judges.update(id, data);

export async function deleteJudge(id: Id) {
  const judge = await db.judges.get(id);
  if (!judge) return;
  await db.transaction('rw', db.judges, db.events, db.marks, async () => {
    const events = await db.events.where({ competitionId: judge.competitionId }).toArray();
    for (const ev of events.filter((e) => e.judgeIds.includes(id) || e.refereeId === id)) {
      await db.events.update(ev.id, {
        judgeIds: ev.judgeIds.filter((j) => j !== id),
        ...(ev.refereeId === id ? { refereeId: undefined } : {}),
      });
    }
    await db.marks.where({ judgeId: id }).delete();
    await db.judges.delete(id);
  });
}

// ---------- Marks ----------

export async function setMark(
  pk: { eventId: Id; segmentKey: SegmentKey; judgeId: Id; entryId: Id },
  tenths: number | null,
) {
  const key: MarkPK = [pk.eventId, pk.segmentKey, pk.judgeId, pk.entryId];
  if (tenths === null) await db.marks.delete(key);
  else await db.marks.put({ ...pk, tenths } satisfies Mark);
}

/** Deletes every mark in the event, for all dances and judges. */
export async function clearMarks(eventId: Id) {
  await db.marks.where({ eventId }).delete();
  await competitionOfEvent(eventId);
}

export const entryTypeLabel: Record<EntryType, string> = {
  solo: 'Solo',
  duo: 'Duo',
  team: 'Team',
};
