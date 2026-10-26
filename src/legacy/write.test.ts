import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import {
  BLOCK_SIZE,
  checksumProblems,
  crc16,
  eventFileSize,
  HEADER_SIZE,
  phaseTailSize,
  slotsFor,
  victoriesSectionSize,
} from './format';
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
    kind,
    dances: e.compulsory.map((c) => c.code),
    entries: e.entries.map((en) => ({ name: en.name, club: en.club, blocks: en.blocks })),
    freeFactor,
    tails: phaseTails(
      DANCE_PROFILES[kind].phases,
      {
        entryIds,
        judgeIds: event.judgeIds,
        segments,
        mark: (k, j, x) => marks.get(`${k}|${j}|${x}`),
        tieBreakMarks: eventTieBreakMarks(event),
      },
      bTotals,
    ),
  };
}

/**
 * Bytes of a real file the writer does not reproduce: in a table of victories, the cells of unused
 * entries (the application leaves whatever was there, or 255 in a new event, and the table's checksum
 * follows).
 */
function unusedCell(i: number, entries: number, phases: number): boolean {
  const slots = slotsFor(entries);
  const victories = victoriesSectionSize(slots);
  for (let p = 0; p < phases; p++) {
    const start = HEADER_SIZE + BLOCK_SIZE * slots + p * (phaseTailSize(slots) + 2);
    if (i >= start + victories - 2 && i < start + victories) return true;
    if (i >= start + 16 && i < start + victories - 2) {
      const at = i - (start + 16);
      return Math.floor(at / (slots + 2)) >= entries || (at % (slots + 2)) - 2 >= entries;
    }
  }
  return false;
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
    kind: 'dance',
    judges: ['J1', 'J2', 'J3'],
    referee: 'J1',
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

/** Real files: set LEGACY_SAMPLES to the folder holding `comp1` (see samples.test.ts). */
const samples = process.env.LEGACY_SAMPLES ?? 'examples/legacy';
describe.skipIf(!existsSync(`${samples}/comp1`))('rebuilding real event files', () => {
  const dir = `${samples}/comp1`;
  // Skipped suites still run their body, so only read the folder when it is there.
  const rebuilt = (existsSync(dir) ? readdirSync(dir) : [])
    .filter((f) => /\.ROL$/i.test(f))
    .sort()
    .flatMap((f) => {
      const real = new Uint8Array(readFileSync(`${dir}/${f}`));
      const e = readLegacyEvent(f, real);
      // Events that had entries removed keep stale rows and tables, which can not be reproduced.
      if (e.kind !== 'dance' || e.entries.length === 0 || real[294] !== real[1741]) return [];
      if (real.length !== eventFileSize(slotsFor(real[294]!))) return [];
      const written = writeDanceEvent(writeInputFor(e));
      let different = 0;
      for (let i = 0; i < real.length; i++) {
        if (real[i] !== written[i] && !unusedCell(i, real[1741]!, 1)) different++;
      }
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

/**
 * A combined event (compulsory dance and free dance) made in the application, with a free dance
 * factor of 1/2 (its default there). Set LEGACY_COMBINED_SAMPLE to the file, or put it in `comp3`.
 */
const combinedSample = (() => {
  if (process.env.LEGACY_COMBINED_SAMPLE) return process.env.LEGACY_COMBINED_SAMPLE;
  const dir = `${samples}/comp3`;
  const file = existsSync(dir) ? readdirSync(dir).find((f) => /.ROL$/i.test(f)) : undefined;
  return file ? `${dir}/${file}` : undefined;
})();
describe.skipIf(!combinedSample || !existsSync(combinedSample))(
  'rebuilding a combined event made in the application',
  () => {
    it('writes the same bytes as the application', () => {
      const real = new Uint8Array(readFileSync(combinedSample!));
      const e = readLegacyEvent('combined', real);
      expect(e.compulsory.length).toBeGreaterThan(0);
      expect(e.hasLong).toBe(true);
      // The file says the free dance counts 1/2 (header bytes 1649 and 1650).
      const factor: [number, number] = [real[1649]!, real[1650]!];
      const written = writeDanceEvent(writeInputFor(e, factor));
      expect(checksumProblems(real)).toEqual([]);
      expect(written.length).toBe(real.length);
      const different = [...real].flatMap((byte, i) =>
        byte === written[i] || unusedCell(i, real[1741]!, 3) ? [] : [i],
      );
      expect(different).toEqual([]);
    });
  },
);
