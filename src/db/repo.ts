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
import {
  cleanSwaps,
  duplicateJudges,
  isMarkValid,
  keysOfSegment,
  occupant,
  renameJudgeInSwaps,
  segmentIdOfKey,
  segmentPanel,
} from '../domain/panels';
import { cdKey, eventMarkKeys } from '../domain/segments';
import { db, newId, type MarkPK } from './db';

/** Dances a new competition starts with: the WorldSkate 2026 Dance Book's dances plus other
 * established compulsory dances, alphabetically. Each competition can add or remove its own. */
export const DEFAULT_DANCES = [
  'And Foxtrot',
  'Argentine Tango',
  'Bachata',
  'Blues',
  'Canasta Tango',
  'City Blues',
  'Denver Shuffle',
  'Easy Paso',
  'Fourteen Step',
  'Glide Waltz',
  'Harris Tango',
  'Italian Foxtrot',
  'Kilian',
  'Olympic Foxtrot',
  'Paso Doble',
  'Quickstep',
  'Rocker Foxtrot',
  'Roller Samba',
  'Siesta Tango',
  'Skaters March',
  'Starlight Waltz',
  'Sweet Tango',
  'Swing Foxtrot',
  'Terenzi Waltz',
  'Tudor Waltz',
  'Viennese Waltz',
  'Westminster Waltz',
];

const touch = (competitionId: Id) => db.competitions.update(competitionId, { updatedAt: Date.now() });

async function competitionOfEvent(eventId: Id) {
  const ev = await db.events.get(eventId);
  if (ev) await touch(ev.competitionId);
}

// ---------- Competitions ----------

export async function createCompetition(
  data: Pick<
    Competition,
    'name' | 'date' | 'venue' | 'primaryColor' | 'secondaryColor' | 'welcome' | 'rotateStartOrder'
  >,
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
  data: Pick<
    CompEvent,
    | 'name'
    | 'entryType'
    | 'discipline'
    | 'compulsoryDanceIds'
    | 'hasFreeDance'
    | 'figures'
    | 'hasShort'
    | 'hasLong'
    | 'factors'
  >,
) {
  const count = await db.events.where({ competitionId }).count();
  const id = newId();
  await db.events.add({ id, competitionId, order: count, judgeIds: [], status: 'setup', ...data });
  await touch(competitionId);
  return id;
}

/** Marks that would be removed if the event's parts/judges changed as given. */
export async function marksAffectedByEventChange(eventId: Id, next: Partial<CompEvent>) {
  const ev = await db.events.get(eventId);
  if (!ev) return 0;
  const merged = { ...ev, ...next };
  const kept = { ...merged, judgeSwaps: cleanSwaps(merged) };
  const keys = eventMarkKeys(kept);
  return db.marks
    .where({ eventId })
    .filter((m) => !isMarkValid(kept, m, keys))
    .count();
}

/** Drops swaps that no longer apply, and the marks that no longer belong to the event. Call inside a transaction. */
async function tidyEvent(eventId: Id) {
  const ev = (await db.events.get(eventId))!;
  const judgeSwaps = cleanSwaps(ev);
  if (JSON.stringify(judgeSwaps) !== JSON.stringify(ev.judgeSwaps))
    await db.events.update(eventId, { judgeSwaps });
  const tidy = { ...ev, judgeSwaps };
  const keys = eventMarkKeys(tidy);
  await db.marks
    .where({ eventId })
    .filter((m) => !isMarkValid(tidy, m, keys))
    .delete();
  return ev.competitionId;
}

/**
 * A different judge takes over a seat on the panel, for the whole event: the new judge sits where the old one
 * did, in every section, and all of the old judge's marks in the event become the new judge's. For fixing a
 * wrong choice; the referee is left as it is.
 */
export async function replaceEventJudge(eventId: Id, oldId: Id, newId: Id) {
  await db.transaction('rw', db.events, db.marks, db.judges, db.competitions, async () => {
    const ev = await db.events.get(eventId);
    if (!ev) throw new Error('Event not found');
    const incoming = await db.judges.get(newId);
    if (!incoming || incoming.competitionId !== ev.competitionId) throw new Error('Judge not found');
    if (!ev.judgeIds.includes(oldId)) throw new Error('That judge is not on the panel');
    const sitting = new Set([
      ...ev.judgeIds,
      ...Object.values(ev.judgeSwaps ?? {}).flatMap((seats) => Object.values(seats)),
    ]);
    if (sitting.has(newId)) throw new Error(`${incoming.name} is already judging this event`);
    await db.events.update(eventId, {
      judgeIds: ev.judgeIds.map((j) => (j === oldId ? newId : j)),
      judgeSwaps: renameJudgeInSwaps(ev.judgeSwaps, oldId, newId),
    });
    const marks = await db.marks
      .where({ eventId })
      .filter((m) => m.judgeId === oldId)
      .toArray();
    await db.marks.bulkDelete(marks.map(markPk));
    await db.marks.bulkPut(marks.map((m) => ({ ...m, judgeId: newId })));
    await touch(ev.competitionId);
  });
}

const markPk = (m: Mark): MarkPK => [m.eventId, m.segmentKey, m.judgeId, m.entryId];

/** What happens to the marks the outgoing judge already gave when someone else takes their seat for a part. */
export type SectionMarks = 'move' | 'delete';

/** How many marks the judges now in the seat have entered in the parts (to ask before changing it). */
export async function countSectionMarks(eventId: Id, segmentIds: string[], seatId: Id) {
  const ev = await db.events.get(eventId);
  if (!ev) return 0;
  let count = 0;
  for (const segmentId of segmentIds) {
    const judgeId = occupant(ev, segmentId, seatId);
    const keys = new Set(keysOfSegment(ev, segmentId));
    count += await db.marks
      .where({ eventId })
      .filter((m) => m.judgeId === judgeId && keys.has(m.segmentKey))
      .count();
  }
  return count;
}

/**
 * Puts `substituteId` in the seat for the given parts (`null`: back to the seat's own judge). The outgoing
 * judge's marks for those parts move to the incoming judge or are deleted, as `marks` says.
 */
export async function setSectionJudge(
  eventId: Id,
  segmentIds: string[],
  seatId: Id,
  substituteId: Id | null,
  marks: SectionMarks,
) {
  await db.transaction('rw', db.events, db.marks, db.judges, db.competitions, async () => {
    const ev = await db.events.get(eventId);
    if (!ev) throw new Error('Event not found');
    if (!ev.judgeIds.includes(seatId)) throw new Error('That judge is not on the panel');
    const known = new Set([...eventMarkKeys(ev)].map(segmentIdOfKey));
    const incoming = substituteId ?? seatId;
    if (substituteId && !(await db.judges.get(substituteId))) throw new Error('Judge not found');
    const swaps = structuredClone(ev.judgeSwaps ?? {});
    const moves: { segmentId: string; from: Id }[] = [];
    for (const segmentId of segmentIds) {
      if (!known.has(segmentId)) throw new Error('That part is not in this event');
      const from = occupant({ judgeSwaps: swaps }, segmentId, seatId);
      if (from === incoming) continue;
      const seats = { ...swaps[segmentId] };
      if (substituteId) seats[seatId] = substituteId;
      else delete seats[seatId];
      swaps[segmentId] = seats;
      const dup = duplicateJudges(segmentPanel({ judgeIds: ev.judgeIds, judgeSwaps: swaps }, segmentId));
      if (dup.length > 0) {
        const name = (await db.judges.get(dup[0]!))?.name ?? 'That judge';
        throw new Error(`${name} is already judging another seat in that part`);
      }
      moves.push({ segmentId, from });
    }
    await db.events.update(eventId, { judgeSwaps: cleanSwaps({ ...ev, judgeSwaps: swaps }) });
    for (const { segmentId, from } of moves) {
      const keys = new Set(keysOfSegment(ev, segmentId));
      const old = await db.marks
        .where({ eventId })
        .filter((m) => m.judgeId === from && keys.has(m.segmentKey))
        .toArray();
      await db.marks.bulkDelete(old.map(markPk));
      if (marks === 'move') await db.marks.bulkPut(old.map((m) => ({ ...m, judgeId: incoming })));
    }
    await touch(ev.competitionId);
  });
}

export async function updateEvent(eventId: Id, data: Partial<Omit<CompEvent, 'id'>>) {
  await db.transaction('rw', db.events, db.marks, db.competitions, async () => {
    await db.events.update(eventId, data);
    await touch(await tidyEvent(eventId));
  });
}

export const setEventStatus = (eventId: Id, status: CompEvent['status']) =>
  db.events.update(eventId, { status });

/** The status a setup/ready event has, given whether it has any entries; later statuses are unchanged. */
export const statusForEntries = (status: CompEvent['status'], entryCount: number): CompEvent['status'] =>
  status === 'setup' || status === 'ready' ? (entryCount > 0 ? 'ready' : 'setup') : status;

/** Moves an event between setup and ready as entries are added or all removed. Call inside a transaction on events and entries. */
async function syncReadyStatus(eventId: Id) {
  const ev = await db.events.get(eventId);
  if (!ev) return;
  const status = statusForEntries(ev.status, await db.entries.where({ eventId }).count());
  if (status !== ev.status) await db.events.update(eventId, { status });
}

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
  await db.transaction('rw', db.skaters, db.entries, db.marks, db.events, async () => {
    const entries = await db.entries.filter((e) => e.skaterIds.includes(id)).toArray();
    for (const e of entries) {
      const skaterIds = e.skaterIds.filter((s) => s !== id);
      if (skaterIds.length === 0 && !e.teamName) await deleteEntryTx(e.id);
      else await db.entries.update(e.id, { skaterIds });
    }
    await db.skaters.delete(id);
    for (const eventId of new Set(entries.map((e) => e.eventId))) await syncReadyStatus(eventId);
  });
}

// ---------- Entries ----------

export async function addEntry(eventId: Id, data: Pick<Entry, 'skaterIds' | 'teamName' | 'club'>) {
  const id = newId();
  await db.transaction('rw', db.entries, db.events, async () => {
    const count = await db.entries.where({ eventId }).count();
    await db.entries.add({ id, eventId, startOrder: count, ...data });
    await syncReadyStatus(eventId);
  });
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
  await db.transaction('rw', db.entries, db.marks, db.events, async () => {
    const entry = await db.entries.get(id);
    await deleteEntryTx(id);
    if (entry) {
      const rest = await db.entries.where({ eventId: entry.eventId }).sortBy('startOrder');
      await Promise.all(rest.map((e, i) => db.entries.update(e.id, { startOrder: i })));
      await syncReadyStatus(entry.eventId);
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
  await db.transaction('rw', db.judges, db.events, db.marks, db.competitions, async () => {
    const events = await db.events.where({ competitionId: judge.competitionId }).toArray();
    const usesJudge = (e: CompEvent) =>
      e.judgeIds.includes(id) ||
      e.refereeId === id ||
      e.assistantRefereeId === id ||
      Object.values(e.judgeSwaps ?? {}).some((seats) => id in seats || Object.values(seats).includes(id));
    const affected = events.filter(usesJudge);
    for (const ev of affected) {
      // A judge who sat in a seat only for some parts leaves that seat to its own judge again.
      const judgeSwaps = ev.judgeSwaps
        ? Object.fromEntries(
            Object.entries(ev.judgeSwaps).map(([segmentId, seats]) => [
              segmentId,
              Object.fromEntries(Object.entries(seats).filter(([seat, sub]) => seat !== id && sub !== id)),
            ]),
          )
        : undefined;
      await db.events.update(ev.id, {
        judgeIds: ev.judgeIds.filter((j) => j !== id),
        ...(ev.judgeSwaps ? { judgeSwaps } : {}),
        ...(ev.refereeId === id ? { refereeId: undefined } : {}),
        ...(ev.assistantRefereeId === id ? { assistantRefereeId: undefined } : {}),
      });
    }
    await db.marks.where({ judgeId: id }).delete();
    await db.judges.delete(id);
    for (const ev of affected) await tidyEvent(ev.id);
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
  couples: 'Couples',
  team: 'Team',
  single: 'Single',
  pairs: 'Pairs',
};
