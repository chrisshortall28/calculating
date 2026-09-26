import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { exportCompetition, importCompetition, parseCompetitionFile } from './competitionFile';

async function seed() {
  const compId = await repo.createCompetition({ name: 'Spring Open', date: '2026-10-01', venue: 'Rink' });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  const waltz = dances.find((d) => d.name === 'Glide Waltz')!;
  const eventId = await repo.createEvent(compId, {
    name: 'Novice Solo',
    entryType: 'solo',
    compulsoryDanceIds: [waltz.id],
    hasFreeDance: true,
  });
  const s1 = await repo.addSkater(compId, { name: 'Ann', club: 'A' });
  const s2 = await repo.addSkater(compId, { name: 'Bea', club: 'B' });
  const e1 = await repo.addEntry(eventId, { skaterIds: [s1] });
  const e2 = await repo.addEntry(eventId, { skaterIds: [s2] });
  const j1 = await repo.addJudge(compId, 'Judge One');
  await repo.updateEvent(eventId, { judgeIds: [j1] });
  await repo.setMark({ eventId, segmentKey: `cd:${waltz.id}`, judgeId: j1, entryId: e1 }, 57);
  await repo.setMark({ eventId, segmentKey: 'fd:A', judgeId: j1, entryId: e2 }, 61);
  return { compId, eventId, j1, e1, e2, waltz };
}

/** Structure with ids replaced by their position, for comparing copies. */
function normalise(file: Awaited<ReturnType<typeof exportCompetition>>) {
  const idx = new Map<string, string>();
  const n = (id: string) => {
    if (!idx.has(id)) idx.set(id, `#${idx.size}`);
    return idx.get(id)!;
  };
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  file.dances.sort(byName);
  file.skaters.sort(byName);
  file.judges.sort(byName);
  file.events.sort((a, b) => a.order - b.order);
  file.entries.sort((a, b) => a.startOrder - b.startOrder);
  n(file.competition.id);
  file.dances.forEach((d) => n(d.id));
  file.skaters.forEach((s) => n(s.id));
  file.judges.forEach((j) => n(j.id));
  file.events.forEach((e) => n(e.id));
  file.entries.forEach((e) => n(e.id));
  return {
    dances: file.dances.map((d) => d.name).sort(),
    events: file.events.map((e) => ({
      ...e,
      id: n(e.id),
      competitionId: n(e.competitionId),
      compulsoryDanceIds: e.compulsoryDanceIds.map(n),
      judgeIds: e.judgeIds.map(n),
    })),
    entries: file.entries.map((e) => ({
      ...e,
      id: n(e.id),
      eventId: n(e.eventId),
      skaterIds: e.skaterIds.map(n),
    })),
    marks: file.marks
      .map((m) => ({
        ...m,
        eventId: n(m.eventId),
        judgeId: n(m.judgeId),
        entryId: n(m.entryId),
        segmentKey: m.segmentKey.startsWith('cd:') ? `cd:${n(m.segmentKey.slice(3))}` : m.segmentKey,
      }))
      .sort((a, b) => a.tenths - b.tenths),
  };
}

describe('competition file round trip', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('imports a copy with new ids and identical content', async () => {
    const { compId } = await seed();
    const original = await exportCompetition(compId);
    const parsed = parseCompetitionFile(JSON.parse(JSON.stringify(original)));
    const copyId = await importCompetition(parsed, 'copy');
    expect(copyId).not.toBe(compId);
    const copy = await exportCompetition(copyId);
    expect(copy.competition.name).toBe('Spring Open (imported)');
    expect(normalise(copy)).toEqual(normalise(original));
    expect(await db.competitions.count()).toBe(2);
  });

  it('replace restores deleted data', async () => {
    const { compId, eventId } = await seed();
    const original = await exportCompetition(compId);
    await repo.deleteEvent(eventId);
    expect(await db.marks.count()).toBe(0);
    await importCompetition(original, 'replace');
    const restored = await exportCompetition(compId);
    expect(restored.marks).toHaveLength(2);
    expect(restored.entries).toHaveLength(2);
    expect(await db.competitions.count()).toBe(1);
  });

  it('rejects invalid files', () => {
    expect(() => parseCompetitionFile({ app: 'other' })).toThrow(/Not a valid Podium/);
  });

  it('removing a judge from the panel removes their marks', async () => {
    const { eventId } = await seed();
    expect(await repo.marksAffectedByEventChange(eventId, { judgeIds: [] })).toBe(2);
    await repo.updateEvent(eventId, { judgeIds: [] });
    expect(await db.marks.count()).toBe(0);
  });

  it('removing the free dance removes only its marks', async () => {
    const { eventId } = await seed();
    await repo.updateEvent(eventId, { hasFreeDance: false });
    const marks = await db.marks.toArray();
    expect(marks.map((m) => m.tenths)).toEqual([57]);
  });
});
