import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { danceEventDefaults, eventSegments, eventTieBreakMarks } from '../domain/segments';
import { seatMark } from '../domain/panels';
import { indexMarks, markKey } from '../domain/markIndex';
import type { SegmentKey } from '../domain/types';
import { calculateEvent } from '../scoring';
import { db } from './db';
import * as repo from './repo';

/** Three judges (A, B, C) on the panel plus D and E off it; one dance and the free dance; two skaters, all marks in. */
async function seed() {
  const compId = await repo.createCompetition({ name: 'Open', date: '', venue: '' });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  const waltz = dances[0]!;
  const eventId = await repo.createEvent(compId, {
    name: 'Novice',
    entryType: 'solo',
    compulsoryDanceIds: [waltz.id],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  const s1 = await repo.addSkater(compId, { name: 'Ann', club: 'X' });
  const s2 = await repo.addSkater(compId, { name: 'Bea', club: 'Y' });
  const e1 = await repo.addEntry(eventId, { skaterIds: [s1] });
  const e2 = await repo.addEntry(eventId, { skaterIds: [s2] });
  const A = await repo.addJudge(compId, 'A');
  const B = await repo.addJudge(compId, 'B');
  const C = await repo.addJudge(compId, 'C');
  const D = await repo.addJudge(compId, 'D');
  const E = await repo.addJudge(compId, 'E');
  await repo.updateEvent(eventId, { judgeIds: [A, B, C] });
  const cd = `cd:${waltz.id}` as SegmentKey;
  for (const j of [A, B, C]) {
    await repo.setMark({ eventId, segmentKey: cd, judgeId: j, entryId: e1 }, 60);
    await repo.setMark({ eventId, segmentKey: cd, judgeId: j, entryId: e2 }, 50);
    for (const k of ['fd:A', 'fd:B'] as const) {
      await repo.setMark({ eventId, segmentKey: k, judgeId: j, entryId: e1 }, 70);
      await repo.setMark({ eventId, segmentKey: k, judgeId: j, entryId: e2 }, 55);
    }
  }
  const marksOf = (judgeId: string) => db.marks.where({ eventId, judgeId }).count();
  return { compId, eventId, e1, e2, A, B, C, D, E, cd, marksOf };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('replaceEventJudge', () => {
  it('puts the new judge in the same seat and gives them all of the old judge’s marks', async () => {
    const { eventId, A, B, C, D, marksOf } = await seed();
    expect(await marksOf(B)).toBe(6);
    await repo.replaceEventJudge(eventId, B, D);
    const ev = (await db.events.get(eventId))!;
    expect(ev.judgeIds).toEqual([A, D, C]);
    expect(await marksOf(B)).toBe(0);
    expect(await marksOf(D)).toBe(6);
  });

  it('refuses a judge who is already judging the event, or who is not found', async () => {
    const { eventId, A, B, D, E } = await seed();
    await expect(repo.replaceEventJudge(eventId, B, A)).rejects.toThrow(/already judging/);
    await expect(repo.replaceEventJudge(eventId, B, 'nobody')).rejects.toThrow(/not found/);
    await expect(repo.replaceEventJudge(eventId, D, B)).rejects.toThrow(/not on the panel/);
    await repo.setSectionJudge(eventId, ['fd'], B, E, 'move');
    await expect(repo.replaceEventJudge(eventId, A, E)).rejects.toThrow(/already judging/);
  });

  it('keeps the section swaps of the replaced seat', async () => {
    const { eventId, B, D, E } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, E, 'move');
    await repo.replaceEventJudge(eventId, B, D);
    const ev = (await db.events.get(eventId))!;
    expect(ev.judgeSwaps).toEqual({ fd: { [D]: E } });
  });
});

describe('setSectionJudge', () => {
  it('seats a different judge for one part and moves the marks already entered', async () => {
    const { eventId, B, D, e1, marksOf } = await seed();
    expect(await repo.countSectionMarks(eventId, ['fd'], B)).toBe(4);
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'move');
    expect((await db.events.get(eventId))!.judgeSwaps).toEqual({ fd: { [B]: D } });
    expect(await marksOf(D)).toBe(4); // the free dance A and B marks, two skaters
    expect(await marksOf(B)).toBe(2); // B keeps the waltz
    expect((await db.marks.get([eventId, 'fd:A', D, e1]))?.tenths).toBe(70);
  });

  it('can delete those marks instead', async () => {
    const { eventId, B, D, marksOf } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'delete');
    expect(await marksOf(D)).toBe(0);
    expect(await marksOf(B)).toBe(2);
  });

  it('goes back to the seat’s own judge with null, taking the marks back', async () => {
    const { eventId, B, D, marksOf } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'move');
    await repo.setSectionJudge(eventId, ['fd'], B, null, 'move');
    const ev = (await db.events.get(eventId))!;
    expect(ev.judgeSwaps).toBeUndefined();
    expect(await marksOf(B)).toBe(6);
    expect(await marksOf(D)).toBe(0);
  });

  it('refuses a judge who already sits in another seat of that part', async () => {
    const { eventId, B, C } = await seed();
    await expect(repo.setSectionJudge(eventId, ['fd'], B, C, 'move')).rejects.toThrow(/already judging/);
    expect((await db.events.get(eventId))!.judgeSwaps).toBeUndefined();
  });

  it('applies to several parts at once, each with its own marks', async () => {
    const { eventId, B, D, cd, marksOf } = await seed();
    await repo.setSectionJudge(eventId, ['fd', cd], B, D, 'move');
    expect(await marksOf(D)).toBe(6);
    expect(await marksOf(B)).toBe(0);
  });
});

describe('keeping events tidy', () => {
  it('keeps a substitute’s marks when the event is edited, and drops them when their seat goes', async () => {
    const { eventId, A, B, C, D, marksOf } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'move');
    await repo.updateEvent(eventId, { name: 'Renamed' });
    expect(await marksOf(D)).toBe(4);
    expect(await repo.marksAffectedByEventChange(eventId, { judgeIds: [A, B, C] })).toBe(0);
    // Taking B's seat away removes the swap, the substitute's marks in it, and B's own.
    expect(await repo.marksAffectedByEventChange(eventId, { judgeIds: [A, C] })).toBe(6);
    await repo.updateEvent(eventId, { judgeIds: [A, C] });
    expect((await db.events.get(eventId))!.judgeSwaps).toBeUndefined();
    expect(await marksOf(D)).toBe(0);
  });

  it('removes swaps of a part that is taken out of the event', async () => {
    const { eventId, B, D } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'move');
    await repo.updateEvent(eventId, { hasFreeDance: false });
    expect((await db.events.get(eventId))!.judgeSwaps).toBeUndefined();
    expect(await db.marks.where({ eventId }).count()).toBe(6); // the waltz only
  });

  it('deleting a judge also clears the swaps they were in, as the seat’s judge or as a substitute', async () => {
    const { eventId, B, D, E, marksOf } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'move');
    await repo.deleteJudge(D);
    const ev = (await db.events.get(eventId))!;
    expect(ev.judgeSwaps).toBeUndefined();
    expect(ev.judgeIds).toContain(B);
    expect(await marksOf(D)).toBe(0);

    await repo.setSectionJudge(eventId, ['fd'], B, E, 'move');
    await repo.deleteJudge(B);
    const after = (await db.events.get(eventId))!;
    expect(after.judgeIds).not.toContain(B);
    expect(after.judgeSwaps).toBeUndefined();
    expect(await marksOf(E)).toBe(0);
  });
});

describe('historic events (no judgeSwaps)', () => {
  async function scoring(eventId: string) {
    const ev = (await db.events.get(eventId))!;
    const dances = await db.dances.where({ competitionId: ev.competitionId }).toArray();
    const map = indexMarks(await db.marks.where({ eventId }).toArray());
    return {
      ev,
      raw: (k: SegmentKey, j: string, e: string) => map.get(markKey(k, j, e)),
      input: {
        entryIds: (await db.entries.where({ eventId }).sortBy('startOrder')).map((e) => e.id),
        judgeIds: ev.judgeIds,
        segments: eventSegments(ev, dances),
        tieBreakMarks: eventTieBreakMarks(ev),
      },
    };
  }

  it('score the same through the seat lookup as through the raw lookup', async () => {
    const { eventId } = await seed();
    const { ev, raw, input } = await scoring(eventId);
    expect(calculateEvent({ ...input, mark: seatMark(ev, raw) })).toEqual(
      calculateEvent({ ...input, mark: raw }),
    );
  });

  it('with a substitute score exactly as if the seat’s judge had given those marks', async () => {
    const { eventId, B, D, e1, e2 } = await seed();
    // D judges the free dance from B's seat and marks it differently from B.
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'delete');
    for (const k of ['fd:A', 'fd:B'] as const) {
      await repo.setMark({ eventId, segmentKey: k, judgeId: D, entryId: e1 }, 40);
      await repo.setMark({ eventId, segmentKey: k, judgeId: D, entryId: e2 }, 90);
    }
    const { ev, raw, input } = await scoring(eventId);
    const result = calculateEvent({ ...input, mark: seatMark(ev, raw) });
    // Hand-built equivalent: B's seat simply holds D's free dance marks.
    const asIfB = (k: SegmentKey, j: string, e: string) =>
      j === B && k.startsWith('fd') ? raw(k, D, e) : raw(k, j, e);
    expect(result).toEqual(calculateEvent({ ...input, mark: asIfB }));
    expect(result.complete).toBe(true);
  });
});

describe('PDF data', () => {
  it('reads a seat’s marks from whoever sat in it for the part', async () => {
    const { loadEventData } = await import('../pdf/loadEvent');
    const { eventId, B, D, e1, A } = await seed();
    await repo.setSectionJudge(eventId, ['fd'], B, D, 'delete');
    await repo.setMark({ eventId, segmentKey: 'fd:A', judgeId: D, entryId: e1 }, 33);
    const data = await loadEventData(eventId);
    expect(data.judges.map((j) => j.id)).toEqual([A, B, data.judges[2]!.id]); // seats keep their own judges
    expect(data.mark('fd:A', B, e1)).toBe(33); // seat B in the free dance is D's
    expect(data.mark('fd:B', B, e1)).toBeUndefined();
    expect(data.mark(`cd:${data.event.compulsoryDanceIds[0]}`, B, e1)).toBe(60); // and B's own in the dance
  });
});
