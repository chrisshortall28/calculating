import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import { checksumProblems, crc16, eventFileSize, slotsFor } from './format';
import { readLegacyEvent } from './readEvent';
import { DANCE_PROFILES, type DanceKind } from './profiles';
import { phaseTails } from './tail';
import type { LegacyEvent } from './types';
import { writeDanceEvent, type WriteEvent } from './write';

/** Scores a legacy event with Podium's engine and builds the tables the application stores for it. */
function writeInputFor(e: LegacyEvent, freeFactor: [number, number] = [1, 1]): WriteEvent {
  const { file } = convertLegacyCompetition(groupLegacyEvents([e])[0]!);
  const event = file.events[0]!;
  const marks = new Map(file.marks.map((m) => [`${m.segmentKey}|${m.judgeId}|${m.entryId}`, m.tenths]));
  const entryIds = file.entries.map((x) => x.id);
  const kind: DanceKind = !e.hasLong ? 'compulsory' : e.compulsory.length > 0 ? 'combined' : 'free';
  // Podium weighs every part equally; a file written with another free dance factor needs it here too.
  const segments = eventSegments(event, file.dances).map((s) =>
    s.kind === 'free' ? { ...s, factor: Math.round((100 * freeFactor[0]) / freeFactor[1]) } : s,
  );
  const bTotals = entryIds.map((id) =>
    event.hasFreeDance ? event.judgeIds.reduce((a, j) => a + (marks.get(`fd:B|${j}|${id}`) ?? 0), 0) : 0,
  );
  return {
    competition: e.competition.name,
    venue: e.competition.venue,
    date: e.competition.date,
    name: e.name,
    judges: e.judges,
    referee: e.referee,
    profile: DANCE_PROFILES[kind],
    dances: e.compulsory.map((c) => c.code),
    entries: e.entries.map((en) => ({ name: en.name, club: en.club, blocks: en.blocks })),
    freeFactor,
    tails: phaseTails(
      DANCE_PROFILES[kind],
      {
        entryIds,
        judgeIds: event.judgeIds,
        segments,
        mark: (k, j, x) => marks.get(`${k}|${j}|${x}`),
        tieBreakMarks: eventTieBreakMarks(event),
      },
      { long: bTotals },
    ),
  };
}

describe('crc16', () => {
  it('is CRC-16/ARC', () => {
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0xbb3d);
  });
});

describe('file sizes', () => {
  it('follow the slot count: 12, 16, 20 and 24 slots', () => {
    expect([1, 4, 5, 8, 9, 12, 13].map(slotsFor)).toEqual([12, 12, 16, 16, 20, 20, 24]);
    expect([12, 16, 20, 24].map((slots) => eventFileSize(slots))).toEqual([39902, 52462, 65054, 77678]);
    expect([12, 16].map((slots) => eventFileSize(slots, 3))).toEqual([41262, 54366]);
  });
});

describe('writeDanceEvent', () => {
  const event = (n: number, kind: DanceKind = 'compulsory'): LegacyEvent => ({
    fileName: 'x',
    competition: { name: 'Test Competition', venue: 'Venue', date: '1st January 2026' },
    name: 'Event',
    typeCode: 8,
    startOrders: {},
    kind: 'dance',
    judges: ['J1', 'J2', 'J3'],
    referee: 'J1',
    assistantReferee: '',
    compulsory: kind === 'free' ? [] : [{ code: 20 }, { code: 38 }],
    hasShort: false,
    hasLong: kind !== 'compulsory',
    factors: {
      compulsory: { numerator: 1, denominator: 1 },
      short: { numerator: 0, denominator: 1 },
      long: { numerator: 1, denominator: 1 },
    },
    entries: Array.from({ length: n }, (_, i) => ({
      name: `Skater ${i + 1}`,
      partner: '',
      club: `Club ${i % 3}`,
      blocks: [
        kind === 'free' ? null : [20 + i, 18, 22 - i],
        kind === 'free' ? null : [15, 12 + i, 16],
        null,
        null,
        null,
        null,
        kind === 'compulsory' ? null : [20 + i, 20, 21],
        kind === 'compulsory' ? null : [19, 22 + i, 20],
      ],
    })),
    warnings: [],
  });

  it.each([1, 4, 5, 9, 13])('writes %i entries as a file with correct checksums and the right size', (n) => {
    const file = writeDanceEvent(writeInputFor(event(n)));
    expect(file.length).toBe(eventFileSize(slotsFor(n)));
    expect(checksumProblems(file)).toEqual([]);
  });

  it.each([1, 5, 9])('writes a combined event of %i entries with the tables of its three phases', (n) => {
    const file = writeDanceEvent(writeInputFor(event(n, 'combined')));
    expect(file.length).toBe(eventFileSize(slotsFor(n), 3));
    expect(checksumProblems(file)).toEqual([]);
  });

  it.each(['compulsory', 'free', 'combined'] as const)('reads back as the same %s event', (kind) => {
    const written = event(6, kind);
    const back = readLegacyEvent('DATA001B.ROL', writeDanceEvent(writeInputFor(written)));
    expect(back).toMatchObject({
      name: 'Event',
      kind: 'dance',
      judges: ['J1', 'J2', 'J3'],
      referee: 'J1',
      compulsory: written.compulsory,
      hasLong: written.hasLong,
    });
    expect(back.entries.map((e) => [e.name, e.club, e.blocks])).toEqual(
      written.entries.map((e) => [e.name, e.club, e.blocks]),
    );
  });

  it('detects a changed mark as a checksum problem', () => {
    const file = writeDanceEvent(writeInputFor(event(3)));
    file[2360 + 2 + 302] = 99;
    expect(checksumProblems(file).map((p) => p.where)).toEqual(['entry block 0']);
  });
});
