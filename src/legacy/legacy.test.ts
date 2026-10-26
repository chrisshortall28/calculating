import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { importCompetition, parseCompetitionFile } from '../io/competitionFile';
import { convertLegacyCompetition, groupLegacyEvents, guessDanceEntryType, parseLegacyDate } from './convert';
import { buildEventFile, type FixtureEvent } from './fixtures';
import { LegacyFormatError, readLegacyEvent } from './readEvent';

const read = (e: FixtureEvent, fileName = 'DATA001B.ROL') => readLegacyEvent(fileName, buildEventFile(e));
const convert = (...events: FixtureEvent[]) =>
  convertLegacyCompetition(groupLegacyEvents(events.map((e, i) => read(e, `DATA00${i + 1}B.ROL`)))[0]!);

describe('readLegacyEvent', () => {
  it('rejects files that are not event files', () => {
    expect(() => readLegacyEvent('x.ROL', new Uint8Array(10))).toThrow(LegacyFormatError);
    expect(() => readLegacyEvent('x.ROL', new Uint8Array(3000))).toThrow(LegacyFormatError);
  });

  it('reads the header, panel and dances', () => {
    const e = read({
      name: '2A Newcomer Solo',
      judges: ['Emma', 'Robert', 'Charlie'],
      referee: 'Ref',
      compulsory: [{ code: 20 }, { code: 38 }],
      hasLong: true,
    });
    expect(e).toMatchObject({
      name: '2A Newcomer Solo',
      competition: { name: 'Test Competition', venue: 'Test Venue', date: '9th August 2026' },
      kind: 'dance',
      judges: ['Emma', 'Robert', 'Charlie'],
      referee: 'Ref',
      compulsory: [{ code: 20 }, { code: 38 }],
      hasShort: false,
      hasLong: true,
    });
  });

  it('reads figure sides and event kinds', () => {
    const e = read({
      name: 'Figs',
      typeCode: 0,
      compulsory: [{ code: 1, side: 'l' }, { code: 2, side: 'r' }, { code: 5 }],
    });
    expect(e.kind).toBe('single');
    expect(e.compulsory).toEqual([{ code: 1, side: 'L' }, { code: 2, side: 'R' }, { code: 5 }]);
    expect(read({ name: 'P', typeCode: 1 }).kind).toBe('pairs');
    expect(read({ name: 'Q', typeCode: 3 }).kind).toBe('unsupported');
  });

  it('reads only the real entries, not the stale rows the app leaves behind', () => {
    const e = read({
      name: 'E',
      entries: [{ name: 'A' }, { name: 'B', club: 'Moonrake' }],
      staleRows: 2,
    });
    expect(e.entries.map((x) => x.name)).toEqual(['A', 'B']);
    expect(e.entries[1]!.club).toBe('Moonrake');
  });

  it('reads a five-judge panel and ignores blocks that are flagged without marks', () => {
    const e = read({
      name: 'Five',
      judges: ['a', 'b', 'c', 'd', 'e'],
      compulsory: [{ code: 1 }, { code: 7 }],
      entries: [{ name: 'Tim', blocks: { 0: [10, 11, 12, 13, 14] }, emptyBlocks: [1] }],
    });
    expect(e.entries[0]!.blocks[0]).toEqual([10, 11, 12, 13, 14]);
    expect(e.entries[0]!.blocks[1]).toBeNull();
  });
});

describe('parseLegacyDate', () => {
  it.each([
    ['9th August 2026', '2026-08-09'],
    ['1 Sep 2025', '2025-09-01'],
    ['9th-10th August 2026', '2026-08-09'],
    ['August 9, 2026', '2026-08-09'],
    ['2026/08/09', '2026-08-09'],
    ['09/08/2026', '2026-08-09'],
    ['31st February 2026', undefined],
    ['Date', undefined],
  ])('%s', (text, iso) => expect(parseLegacyDate(text)).toBe(iso));
});

describe('guessDanceEntryType', () => {
  const named = (...names: string[]) => names.map((name) => ({ name, partner: '', club: '', blocks: [] }));
  it('guesses from the event name and the entry names', () => {
    expect(guessDanceEntryType('2A Newcomer Solo', named('Ann Smith'))).toBe('solo');
    expect(guessDanceEntryType('20A Newcomer IB+ Duo', named('A B / C D', 'E F / G H'))).toBe('duo');
    expect(guessDanceEntryType('23 Couples Free Dance', named('A B / C D'))).toBe('couples');
    expect(guessDanceEntryType('17A Duo Team', named('Red Rose Garnets'))).toBe('team');
    expect(guessDanceEntryType('24 Trio Free Dance', named('Glam - Ann/Bo/Cy'))).toBe('team');
    expect(guessDanceEntryType('27 Mix & Match', [])).toBe('solo');
  });
});

describe('convertLegacyCompetition', () => {
  it('converts a dance event with compulsory dances, a free dance and a panel', () => {
    const { file, warnings } = convert({
      name: '2A Newcomer Solo',
      judges: ['Emma', 'Robert', 'Charlie'],
      referee: 'Emma',
      compulsory: [{ code: 20 }, { code: 38 }],
      hasLong: true,
      entries: [
        {
          name: 'Elora Noah',
          club: 'Meridian',
          blocks: { 0: [13, 13, 12], 1: [10, 12, 10], 6: [20, 20, 20], 7: [22, 20, 22] },
        },
        { name: 'Haidee Hamilton-Pryn', club: 'Meridian', blocks: { 0: [8, 7, 4] } },
      ],
    });
    expect(parseCompetitionFile(file)).toBeTruthy();
    const [event] = file.events;
    expect(event).toMatchObject({
      name: '2A Newcomer Solo',
      entryType: 'solo',
      discipline: 'dance',
      hasFreeDance: true,
      status: 'scoring',
    });
    expect(file.dances.map((d) => d.name)).toEqual(['Siesta Tango', 'City Blues']);
    expect(file.judges.map((j) => j.name)).toEqual(['Emma', 'Robert', 'Charlie']);
    expect(event!.refereeId).toBe(file.judges[0]!.id);
    expect(file.skaters.map((s) => [s.name, s.club])).toEqual([
      ['Elora Noah', 'Meridian'],
      ['Haidee Hamilton-Pryn', 'Meridian'],
    ]);
    const [elora] = file.entries;
    const siesta = `cd:${file.dances[0]!.id}` as const;
    const marksOf = (key: string) =>
      file.marks.filter((m) => m.entryId === elora!.id && m.segmentKey === key).map((m) => m.tenths);
    expect(marksOf(siesta)).toEqual([13, 13, 12]);
    expect(marksOf('fd:A')).toEqual([20, 20, 20]);
    expect(marksOf('fd:B')).toEqual([22, 20, 22]);
    expect(file.marks).toHaveLength(3 + 3 + 3 + 3 + 3);
    expect(warnings.map((w) => w.message)).toEqual([expect.stringContaining('Entry type guessed as “solo”')]);
  });

  it('converts a figures event with sides, short and long programmes and factors', () => {
    const { file } = convert({
      name: 'Factors',
      typeCode: 0,
      judges: ['Only'],
      compulsory: [{ code: 6 }, { code: 52, side: 'r' }],
      hasShort: true,
      hasLong: true,
      factors: { compulsory: [2, 1], short: [1, 2], long: [3, 2] },
      entries: [{ name: 'Timy', blocks: { 0: [22], 1: [33], 4: [44], 5: [55], 6: [66], 7: [77] } }],
    });
    const [event] = file.events;
    expect(event).toMatchObject({
      entryType: 'single',
      discipline: 'figures',
      figures: [{ figureId: '6' }, { figureId: '52', side: 'R' }],
      hasShort: true,
      hasLong: true,
      factors: { figures: 200, short: 50, long: 150 },
    });
    expect(Object.fromEntries(file.marks.map((m) => [m.segmentKey, m.tenths]))).toEqual({
      'cf:6:-': 22,
      'cf:52:R': 33,
      'sp:A': 44,
      'sp:B': 55,
      'lp:A': 66,
      'lp:B': 77,
    });
  });

  it('converts pairs: the lady’s name is a second skater', () => {
    const { file } = convert({
      name: 'Pairs',
      typeCode: 1,
      hasShort: true,
      hasLong: true,
      factors: { long: [3, 1] },
      entries: [{ name: 'Man Name', partner: 'Lady Name', club: 'GB', blocks: { 4: [23, 45, 67] } }],
    });
    expect(file.events[0]).toMatchObject({
      entryType: 'pairs',
      factors: { figures: 100, short: 100, long: 300 },
    });
    expect(file.skaters.map((s) => s.name)).toEqual(['Man Name', 'Lady Name']);
    expect(file.entries[0]!.skaterIds).toHaveLength(2);
    expect(file.marks.map((m) => m.segmentKey)).toEqual(['sp:A', 'sp:A', 'sp:A']);
  });

  it('converts duos to two skaters and teams to a team name', () => {
    const { file } = convert(
      { name: '20A Duo', entries: [{ name: 'Ann Smith / Bo Jones', club: 'Red Rose' }] },
      { name: '17A Duo Team', entries: [{ name: 'Red Rose Garnets', club: 'Red Rose' }] },
    );
    expect(file.events.map((e) => e.entryType)).toEqual(['duo', 'team']);
    expect(file.skaters.map((s) => s.name)).toEqual(['Ann Smith', 'Bo Jones']);
    expect(file.entries[1]).toMatchObject({ teamName: 'Red Rose Garnets', skaterIds: [], club: 'Red Rose' });
  });

  it('shares skaters and judges across events and skips unsupported events', () => {
    const { file, skippedEvents, warnings } = convert(
      { name: 'A', judges: ['J1'], entries: [{ name: 'Ann', club: 'X' }] },
      { name: 'B', judges: ['j1'], entries: [{ name: 'ann', club: 'x' }] },
      { name: 'Quartet', typeCode: 3, entries: [{ name: 'Moonrakers' }] },
    );
    expect(file.skaters).toHaveLength(1);
    expect(file.judges).toHaveLength(1);
    expect(file.events.map((e) => e.name)).toEqual(['A', 'B']);
    expect(skippedEvents).toEqual(['Quartet']);
    expect(warnings.some((w) => w.event === 'Quartet' && w.message.startsWith('Skipped'))).toBe(true);
  });

  it('warns about unknown dances and unreadable dates', () => {
    const { file, warnings } = convert({
      name: 'X',
      date: 'Date',
      compulsory: [{ code: 99 }, { code: 0 }],
    });
    expect(file.dances.map((d) => d.name)).toEqual(['Dance 99', 'Dance No 2']);
    expect(warnings.filter((w) => w.level === 'warning').map((w) => w.message)).toEqual([
      expect.stringContaining('could not be read'),
      expect.stringContaining('Dance number 99 is not known'),
    ]);
  });

  it('skips marks the event has no place for', () => {
    const { file, warnings } = convert({
      name: 'No free dance',
      compulsory: [{ code: 20 }],
      entries: [{ name: 'Ann', blocks: { 0: [10, 10, 10], 6: [20, 20, 20] } }],
    });
    expect(file.marks).toHaveLength(3);
    expect(warnings.some((w) => w.message.includes('does not use'))).toBe(true);
  });
});

describe('importing a converted competition', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('is written to the database as a normal competition', async () => {
    const { file } = convert({
      name: '2A Newcomer Solo',
      compulsory: [{ code: 20 }],
      entries: [{ name: 'Ann', club: 'X', blocks: { 0: [10, 11, 12] } }],
    });
    const id = await importCompetition(parseCompetitionFile(JSON.parse(JSON.stringify(file))), 'replace');
    expect(await db.competitions.get(id)).toMatchObject({ name: 'Test Competition', date: '2026-08-09' });
    expect(await db.marks.count()).toBe(3);
    expect(await db.events.count()).toBe(1);
  });
});
