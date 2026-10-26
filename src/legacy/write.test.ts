import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import { calculateEvent } from '../scoring';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import {
  BLOCK_SIZE,
  checksumProblems,
  crc16,
  eventFileSize,
  HEADER_SIZE,
  slotsFor,
  victoriesSectionSize,
} from './format';
import { readLegacyEvent } from './readEvent';
import { tailFromResult } from './tail';
import type { LegacyEvent } from './types';
import { writeDanceEvent, type WriteEvent } from './write';

/** Scores a legacy event with Podium's engine and builds the tail the application stores for it. */
function writeInputFor(e: LegacyEvent): WriteEvent {
  const { file } = convertLegacyCompetition(groupLegacyEvents([e])[0]!);
  const event = file.events[0]!;
  const marks = new Map(file.marks.map((m) => [`${m.segmentKey}|${m.judgeId}|${m.entryId}`, m.tenths]));
  const entryIds = file.entries.map((x) => x.id);
  const result = calculateEvent({
    entryIds,
    judgeIds: event.judgeIds,
    segments: eventSegments(event, file.dances),
    mark: (k, j, x) => marks.get(`${k}|${j}|${x}`),
    tieBreakMarks: eventTieBreakMarks(event),
  });
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
    kind: e.hasLong ? 'free' : 'compulsory',
    dances: e.compulsory.map((c) => c.code),
    entries: e.entries.map((en) => ({ name: en.name, club: en.club, blocks: en.blocks })),
    tail: tailFromResult(result, entryIds, bTotals),
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
    expect([12, 16, 20, 24].map(eventFileSize)).toEqual([39902, 52462, 65054, 77678]);
  });
});

describe('writeDanceEvent', () => {
  const event = (n: number, kind: 'compulsory' | 'free' = 'compulsory'): LegacyEvent => ({
    fileName: 'x',
    competition: { name: 'Test Competition', venue: 'Venue', date: '1st January 2026' },
    name: 'Event',
    typeCode: 8,
    kind: 'dance',
    judges: ['J1', 'J2', 'J3'],
    referee: 'J1',
    compulsory: kind === 'compulsory' ? [{ code: 20 }, { code: 38 }] : [],
    hasShort: false,
    hasLong: kind === 'free',
    factors: {
      compulsory: { numerator: 1, denominator: 1 },
      short: { numerator: 0, denominator: 1 },
      long: { numerator: 1, denominator: 1 },
    },
    entries: Array.from({ length: n }, (_, i) => ({
      name: `Skater ${i + 1}`,
      partner: '',
      club: `Club ${i % 3}`,
      blocks:
        kind === 'compulsory'
          ? [[20 + i, 18, 22 - i], [15, 12 + i, 16], null, null, null, null, null, null]
          : [null, null, null, null, null, null, [20 + i, 20, 21], [19, 22 + i, 20]],
    })),
    warnings: [],
  });

  it.each([1, 4, 5, 9, 13])('writes %i entries as a file with correct checksums and the right size', (n) => {
    const file = writeDanceEvent(writeInputFor(event(n)));
    expect(file.length).toBe(eventFileSize(slotsFor(n)));
    expect(checksumProblems(file)).toEqual([]);
  });

  it.each(['compulsory', 'free'] as const)('reads back as the same %s event', (kind) => {
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

/** Real files: set LEGACY_SAMPLES to the folder holding `comp1` (see samples.test.ts). */
const samples = process.env.LEGACY_SAMPLES ?? 'examples/legacy';
describe.skipIf(!existsSync(`${samples}/comp1`))('rebuilding real event files', () => {
  const dir = `${samples}/comp1`;
  const rebuilt = readdirSync(dir)
    .filter((f) => /\.ROL$/i.test(f))
    .sort()
    .flatMap((f) => {
      const real = new Uint8Array(readFileSync(`${dir}/${f}`));
      const e = readLegacyEvent(f, real);
      // Events that had entries removed keep stale rows and tables, which can not be reproduced.
      if (e.kind !== 'dance' || e.entries.length === 0 || real[294] !== real[1741]) return [];
      if (real.length !== eventFileSize(slotsFor(real[294]!))) return [];
      const written = writeDanceEvent(writeInputFor(e));
      // The application keeps cells and rows of removed entries in the table of victories (and its
      // checksum then differs); those are the only bytes that can not be reproduced.
      const slots = slotsFor(real[294]!);
      const table = HEADER_SIZE + BLOCK_SIZE * slots;
      const tableEnd = table + victoriesSectionSize(slots);
      const leftover = (i: number) => {
        if (i >= tableEnd - 2 && i < tableEnd) return true;
        if (i < table + 16 || i >= tableEnd - 2) return false;
        const at = i - (table + 16);
        return Math.floor(at / (slots + 2)) >= real[1741]! || (at % (slots + 2)) - 2 >= real[1741]!;
      };
      let different = 0;
      for (let i = 0; i < real.length; i++) if (real[i] !== written[i] && !leftover(i)) different++;
      return [{ f, different, checksums: checksumProblems(written) }];
    });

  it('writes files whose every checksum is right', () => {
    expect(rebuilt.length).toBeGreaterThan(20);
    expect(rebuilt.filter((r) => r.checksums.length > 0)).toEqual([]);
  });

  it('writes the same bytes as the application, apart from leftovers of earlier edits', () => {
    expect(rebuilt.filter((r) => r.different > 0).map((r) => `${r.f}: ${r.different} bytes`)).toEqual([]);
  });
});
