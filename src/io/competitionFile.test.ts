import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { danceEventDefaults } from '../domain/segments';
import * as repo from '../db/repo';
import {
  exportCompetition,
  FORMAT_VERSION,
  importCompetition,
  importEventsInto,
  parseCompetitionFile,
  ORDERS_FORMAT_VERSION,
  SWAPS_FORMAT_VERSION,
} from './competitionFile';

async function seed() {
  const compId = await repo.createCompetition({ name: 'Spring Open', date: '2026-10-01', venue: 'Rink' });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  const waltz = dances.find((d) => d.name === 'Glide Waltz')!;
  const eventId = await repo.createEvent(compId, {
    name: 'Novice Solo',
    entryType: 'solo',
    compulsoryDanceIds: [waltz.id],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  const s1 = await repo.addSkater(compId, { name: 'Ann', club: 'A' });
  const s2 = await repo.addSkater(compId, { name: 'Bea', club: 'B' });
  const e1 = await repo.addEntry(eventId, { skaterIds: [s1] });
  const e2 = await repo.addEntry(eventId, { skaterIds: [s2] });
  const j1 = await repo.addJudge(compId, 'Judge One');
  const ref = await repo.addJudge(compId, 'Referee Person');
  await repo.updateEvent(eventId, { judgeIds: [j1], refereeId: ref });
  await repo.setMark({ eventId, segmentKey: `cd:${waltz.id}`, judgeId: j1, entryId: e1 }, 57);
  await repo.setMark({ eventId, segmentKey: 'fd:A', judgeId: j1, entryId: e2 }, 61);
  return { compId, eventId, j1, ref, e1, e2, waltz };
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
      refereeId: e.refereeId && n(e.refereeId),
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

  it('keeps the referee when importing a copy', async () => {
    const { compId } = await seed();
    const copyId = await importCompetition(await exportCompetition(compId), 'copy');
    const [event] = await db.events.where({ competitionId: copyId }).toArray();
    const referee = await db.judges.get(event!.refereeId!);
    expect(referee).toMatchObject({ competitionId: copyId, name: 'Referee Person' });
  });

  it('deleting a judge clears them as referee', async () => {
    const { eventId, ref } = await seed();
    await repo.deleteJudge(ref);
    expect((await db.events.get(eventId))!.refereeId).toBeUndefined();
  });

  it('a judge can also be the referee; deleting them clears both roles', async () => {
    const { eventId, j1 } = await seed();
    await repo.updateEvent(eventId, { refereeId: j1 });
    await repo.deleteJudge(j1);
    const ev = (await db.events.get(eventId))!;
    expect(ev.judgeIds).toEqual([]);
    expect(ev.refereeId).toBeUndefined();
  });

  it('removing the free dance removes only its marks', async () => {
    const { eventId } = await seed();
    await repo.updateEvent(eventId, { hasFreeDance: false });
    const marks = await db.marks.toArray();
    expect(marks.map((m) => m.tenths)).toEqual([57]);
  });
});

describe('figures & free events in files', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('round-trips a figures event with its figures, programmes and factors', async () => {
    const compId = await repo.createCompetition({ name: 'Figures Open', date: '2026-10-01', venue: 'Rink' });
    const eventId = await repo.createEvent(compId, {
      name: 'Junior Figures & Free',
      entryType: 'pairs',
      compulsoryDanceIds: [],
      hasFreeDance: false,
      discipline: 'figures',
      figures: [{ figureId: '8', side: 'L' }, { figureId: '12' }],
      hasShort: true,
      hasLong: true,
      factors: { figures: 250, short: 100, long: 300 },
    });
    const j1 = await repo.addJudge(compId, 'Judge One');
    const s1 = await repo.addSkater(compId, { name: 'Ann', club: 'A' });
    const e1 = await repo.addEntry(eventId, { skaterIds: [s1] });
    await repo.updateEvent(eventId, { judgeIds: [j1] });
    await repo.setMark({ eventId, segmentKey: 'cf:8:L', judgeId: j1, entryId: e1 }, 55);
    await repo.setMark({ eventId, segmentKey: 'lp:B', judgeId: j1, entryId: e1 }, 72);

    const file = parseCompetitionFile(JSON.parse(JSON.stringify(await exportCompetition(compId))));
    expect(file.formatVersion).toBe(2);
    const copy = await exportCompetition(await importCompetition(file, 'copy'));
    expect(copy.events[0]).toMatchObject({
      discipline: 'figures',
      entryType: 'pairs',
      figures: [{ figureId: '8', side: 'L' }, { figureId: '12' }],
      factors: { figures: 250, short: 100, long: 300 },
    });
    expect(copy.marks.map((m) => m.segmentKey).sort()).toEqual(['cf:8:L', 'lp:B']);
  });

  it('removing a figure or programme removes only its marks', async () => {
    const compId = await repo.createCompetition({ name: 'F', date: '', venue: '' });
    const eventId = await repo.createEvent(compId, {
      name: 'F',
      entryType: 'single',
      compulsoryDanceIds: [],
      hasFreeDance: false,
      discipline: 'figures',
      figures: [{ figureId: '1' }, { figureId: '2', side: 'R' }],
      hasShort: true,
      hasLong: false,
      factors: { figures: 100, short: 100, long: 100 },
    });
    const j1 = await repo.addJudge(compId, 'J');
    const e1 = await repo.addEntry(eventId, { skaterIds: [] });
    await repo.updateEvent(eventId, { judgeIds: [j1] });
    for (const segmentKey of ['cf:1:-', 'cf:2:R', 'sp:A'] as const)
      await repo.setMark({ eventId, segmentKey, judgeId: j1, entryId: e1 }, 50);
    const next = { figures: [{ figureId: '2', side: 'R' as const }], hasShort: false };
    expect(await repo.marksAffectedByEventChange(eventId, next)).toBe(2);
    await repo.updateEvent(eventId, next);
    expect((await db.marks.toArray()).map((m) => m.segmentKey)).toEqual(['cf:2:R']);
  });

  it('reads version 1 files as dance events', async () => {
    const { compId } = await seed();
    const v1 = JSON.parse(JSON.stringify(await exportCompetition(compId)));
    v1.formatVersion = 1;
    for (const e of v1.events)
      for (const k of ['discipline', 'figures', 'hasShort', 'hasLong', 'factors']) delete e[k];
    const file = parseCompetitionFile(v1);
    expect(file.events[0]).toMatchObject({
      discipline: 'dance',
      figures: [],
      hasShort: false,
      hasLong: false,
      factors: { figures: 100, short: 100, long: 100 },
    });
  });

  it('adds a file’s events to an existing competition, reusing what it already has', async () => {
    const { compId } = await seed();
    const file = await exportCompetition(compId);
    const targetId = await repo.createCompetition({ name: 'Target', date: '', venue: '' });
    const existingJudge = await repo.addJudge(targetId, 'judge one');
    const before = await db.dances.where({ competitionId: targetId }).count();

    expect(await importEventsInto(file, targetId)).toBe(1);
    expect(await importEventsInto(file, targetId)).toBe(1);

    const merged = await exportCompetition(targetId);
    expect(merged.competition.name).toBe('Target');
    expect(merged.events.map((e) => e.order).sort()).toEqual([0, 1]);
    // Default dances and the same-named judge are reused, not duplicated.
    expect(merged.dances).toHaveLength(before);
    expect(merged.judges.filter((j) => j.name.toLowerCase() === 'judge one')).toEqual([
      expect.objectContaining({ id: existingJudge }),
    ]);
    expect(merged.skaters).toHaveLength(2);
    expect(merged.entries).toHaveLength(4);
    expect(merged.marks).toHaveLength(4);
    const ids = new Set([
      ...merged.dances.map((d) => d.id),
      ...merged.judges.map((j) => j.id),
      ...merged.skaters.map((s) => s.id),
    ]);
    for (const e of merged.events) {
      expect(e.judgeIds.every((j) => ids.has(j))).toBe(true);
      expect(e.compulsoryDanceIds.every((d) => ids.has(d))).toBe(true);
      expect(ids.has(e.refereeId!)).toBe(true);
    }
    for (const m of merged.marks) expect(ids.has(m.judgeId)).toBe(true);
    // The original competition is untouched.
    expect((await exportCompetition(compId)).marks).toHaveLength(2);
  });

  describe('judges by section', () => {
    it('is written as before for events whose panel never changes, and old files read unchanged', async () => {
      const { compId } = await seed();
      const file = await exportCompetition(compId);
      expect(file.formatVersion).toBe(FORMAT_VERSION);
      expect(JSON.stringify(file)).not.toContain('judgeSwaps');
      // Files from before figures events (format 1) and before swaps (format 2) both still import.
      for (const version of [1, 2]) {
        await db.delete();
        await db.open();
        const old = JSON.parse(JSON.stringify({ ...file, formatVersion: version }));
        const id = await importCompetition(parseCompetitionFile(old), 'replace');
        const again = await exportCompetition(id);
        expect(again.marks).toHaveLength(file.marks.length);
        expect(again.events[0]!.judgeSwaps).toBeUndefined();
      }
    });

    it('is written as format 3 only when a part has a different judge, and survives copying with new ids', async () => {
      const { compId, eventId, j1 } = await seed();
      const sub = await repo.addJudge(compId, 'Sub Judge');
      await repo.setSectionJudge(eventId, ['fd'], j1, sub, 'move');
      const file = await exportCompetition(compId);
      expect(file.formatVersion).toBe(SWAPS_FORMAT_VERSION);
      expect(file.events[0]!.judgeSwaps).toEqual({ fd: { [j1]: sub } });

      const copyId = await importCompetition(parseCompetitionFile(JSON.parse(JSON.stringify(file))), 'copy');
      const copy = await exportCompetition(copyId);
      const newSub = copy.judges.find((j) => j.name === 'Sub Judge')!;
      const newSeat = copy.judges.find((j) => j.name === 'Judge One')!;
      expect(newSub.id).not.toBe(sub);
      expect(copy.events[0]!.judgeSwaps).toEqual({ fd: { [newSeat.id]: newSub.id } });
      // The substitute's marks came across too, under the new id.
      expect(copy.marks.filter((m) => m.judgeId === newSub.id && m.segmentKey.startsWith('fd'))).toHaveLength(
        1,
      );
    });

    it('remaps a compulsory dance’s part id when copying events into another competition', async () => {
      const { compId, eventId, j1, waltz } = await seed();
      const sub = await repo.addJudge(compId, 'Sub Judge');
      await repo.setSectionJudge(eventId, [`cd:${waltz.id}`], j1, sub, 'move');
      const file = await exportCompetition(compId);
      const targetId = await repo.createCompetition({ name: 'Target', date: '', venue: '' });
      await importEventsInto(file, targetId);
      const merged = await exportCompetition(targetId);
      const [event] = merged.events;
      const [danceId] = event!.compulsoryDanceIds;
      const [segmentId] = Object.keys(event!.judgeSwaps!);
      expect(segmentId).toBe(`cd:${danceId}`);
      const [seat, substitute] = Object.entries(event!.judgeSwaps![segmentId!]!)[0]!;
      expect(event!.judgeIds).toContain(seat);
      expect(merged.judges.some((j) => j.id === substitute && j.name === 'Sub Judge')).toBe(true);
    });
  });
});

describe('own start orders for later parts', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('are written as format 4 only when a part has one, and survive copying with new ids', async () => {
    const { compId, eventId, e1, e2 } = await seed();
    expect((await exportCompetition(compId)).formatVersion).toBe(FORMAT_VERSION);
    await repo.setPartOrder(eventId, 'fd', [e2, e1]);
    const file = await exportCompetition(compId);
    expect(file.formatVersion).toBe(ORDERS_FORMAT_VERSION);
    expect(file.events[0]!.partOrders).toEqual({ fd: [e2, e1] });

    const copyId = await importCompetition(parseCompetitionFile(JSON.parse(JSON.stringify(file))), 'copy');
    const copy = await exportCompetition(copyId);
    const [first, second] = [...copy.entries].sort((a, b) => a.startOrder - b.startOrder);
    expect(copy.events[0]!.partOrders).toEqual({ fd: [second!.id, first!.id] });

    // Clearing it goes back to the old format, and files without it import as before.
    await repo.setPartOrder(eventId, 'fd', undefined);
    const plain = await exportCompetition(compId);
    expect(plain.formatVersion).toBe(FORMAT_VERSION);
    expect(JSON.stringify(plain)).not.toContain('partOrders');
    expect(parseCompetitionFile(JSON.parse(JSON.stringify(plain))).events[0]!.partOrders).toBeUndefined();
  });

  it('drop a removed entry, and are tidied when the part goes', async () => {
    const { compId, eventId, e1, e2 } = await seed();
    await repo.setPartOrder(eventId, 'fd', [e2, e1]);
    await repo.deleteEntry(e1);
    expect((await db.events.get(eventId))!.partOrders).toEqual({ fd: [e2] });
    await repo.updateEvent(eventId, { hasFreeDance: false });
    expect((await db.events.get(eventId))!.partOrders).toBeUndefined();
    expect(compId).toBeTruthy();
  });
});

describe('assistant referee in files', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('is kept, with new ids, when copying or adding events to another competition', async () => {
    const { compId, eventId } = await seed();
    const asst = await repo.addJudge(compId, 'Assistant Ann');
    await repo.updateEvent(eventId, { assistantRefereeId: asst });
    const file = await exportCompetition(compId);
    expect(file.events[0]!.assistantRefereeId).toBe(asst);

    const copy = await exportCompetition(
      await importCompetition(parseCompetitionFile(JSON.parse(JSON.stringify(file))), 'copy'),
    );
    const ann = copy.judges.find((j) => j.name === 'Assistant Ann')!;
    expect(ann.id).not.toBe(asst);
    expect(copy.events[0]!.assistantRefereeId).toBe(ann.id);

    const targetId = await repo.createCompetition({ name: 'Target', date: '', venue: '' });
    await importEventsInto(file, targetId);
    const merged = await exportCompetition(targetId);
    expect(merged.judges.find((j) => j.id === merged.events[0]!.assistantRefereeId)?.name).toBe(
      'Assistant Ann',
    );
  });

  it('is cleared with the judge, and files without one are unchanged', async () => {
    const { compId, eventId } = await seed();
    expect(JSON.stringify(await exportCompetition(compId))).not.toContain('assistantRefereeId');
    const asst = await repo.addJudge(compId, 'Assistant Ann');
    await repo.updateEvent(eventId, { assistantRefereeId: asst });
    await repo.deleteJudge(asst);
    expect((await db.events.get(eventId))!.assistantRefereeId).toBeUndefined();
  });
});
