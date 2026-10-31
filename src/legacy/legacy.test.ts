import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { importCompetition, parseCompetitionFile } from '../io/competitionFile';
import {
  convertLegacyCompetition,
  groupLegacyEvents,
  guessDanceEntryType,
  parseLegacyDate,
  type LegacyChoices,
} from './convert';
import { legacyDanceName } from './dances';
import { buildEventFile, type FixtureEvent } from './fixtures';
import { LegacyFormatError, readLegacyEvent } from './readEvent';
import { readLegacyFiles } from './readFiles';

const read = (e: FixtureEvent, fileName = 'DATA001B.ROL') => readLegacyEvent(fileName, buildEventFile(e));
const convertWith = (choices: LegacyChoices, ...events: FixtureEvent[]) =>
  convertLegacyCompetition(
    groupLegacyEvents(events.map((e, i) => read(e, `DATA00${i + 1}B.ROL`)))[0]!,
    choices,
  );
const convert = (...events: FixtureEvent[]) => convertWith({}, ...events);

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

  it('reads a five-judge panel, keeping a flagged block of zero marks (a no-show) and skipping unflagged blocks', () => {
    const e = read({
      name: 'Five',
      judges: ['a', 'b', 'c', 'd', 'e'],
      compulsory: [{ code: 1 }, { code: 7 }],
      entries: [{ name: 'Tim', blocks: { 0: [10, 11, 12, 13, 14] }, emptyBlocks: [1] }],
    });
    expect(e.entries[0]!.blocks[0]).toEqual([10, 11, 12, 13, 14]);
    expect(e.entries[0]!.blocks[1]).toEqual([0, 0, 0, 0, 0]);
    expect(e.entries[0]!.blocks[2]).toBeNull();
  });
});

describe('legacyDanceName', () => {
  it('names the dances by their number in the application’s list', () => {
    expect([1, 7, 20, 28, 38, 47, 48, 51].map((code) => legacyDanceName(code, 0))).toEqual(
      [
        'Kleiner Waltz',
        'Fourteen Step',
        'Siesta Tango',
        'Canasta Tango',
        'City Blues',
        'Roller Samba',
        'Easy Paso',
        'Midnight Blues',
      ].map((name) => ({ name, known: true })),
    );
  });

  it('numbers the unnamed dance 0 by position and flags a number beyond the list', () => {
    expect(legacyDanceName(0, 1)).toEqual({ name: 'Dance No 2', known: true });
    expect(legacyDanceName(52, 0)).toEqual({ name: 'Dance 52', known: false });
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

  it('warns when a combined event’s free dance factor differs from the one Podium uses', () => {
    const marks = { 0: [10, 10, 10], 6: [20, 20, 20], 7: [22, 20, 22] };
    const event = (compulsory: { code: number }[], long: [number, number]): FixtureEvent => ({
      name: 'Combined',
      compulsory,
      hasLong: true,
      factors: { long },
      entries: [{ name: 'Ann', blocks: marks }],
    });
    const messages = (e: FixtureEvent) =>
      convert(e)
        .warnings.filter((w) => w.message.includes('free dance counts'))
        .map((w) => w.message);
    // The application's defaults: ½ with one compulsory dance, 1 with two.
    expect(messages(event([{ code: 20 }], [1, 2]))).toEqual([]);
    expect(messages(event([{ code: 20 }, { code: 38 }], [1, 1]))).toEqual([]);
    // Anything else is the user's own setting there.
    expect(messages(event([{ code: 20 }], [1, 1]))).toEqual([
      'The free dance counts ×1 in the file but Podium uses ×0.5 with 1 compulsory dance, so the totals will differ from the application’s.',
    ]);
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

  it('reports what the files do not say and uses the user’s answers instead of guessing', () => {
    const event = {
      name: 'X',
      date: 'Date',
      compulsory: [{ code: 99 }],
      entries: [{ name: 'Ann / Bo', blocks: { 0: [10, 11, 12] } }],
    };
    const open = convert(event);
    expect(open.issues).toEqual({
      date: { text: 'Date' },
      unknownDances: [{ code: 99, defaultName: 'Dance 99', events: ['X'] }],
      guessedTypes: [{ index: 0, eventId: expect.any(String), event: 'X', entryType: 'duo' }],
    });
    expect(open.warnings.map((w) => w.kind)).toEqual(['date', 'entry-type', 'unknown-dance']);

    const answered = convertWith(
      { date: '2026-08-09', danceNames: { 99: ' Bachata ' }, entryTypes: { 0: 'solo' } },
      event,
    );
    expect(answered.file.competition.date).toBe('2026-08-09');
    expect(answered.file.dances.map((d) => d.name)).toEqual(['Bachata']);
    expect(answered.file.events[0]!.entryType).toBe('solo');
    expect(answered.file.skaters.map((s) => s.name)).toEqual(['Ann / Bo']);
    expect(answered.warnings).toEqual([]);
    expect(answered.issues.guessedTypes[0]!.entryType).toBe('solo');
  });

  it('imports a no-show’s zero marks, as the legacy app scores it 0.0 and places it last', () => {
    const { file, warnings } = convert({
      name: 'No-show',
      compulsory: [{ code: 20 }],
      entries: [
        { name: 'Ann', blocks: { 0: [10, 11, 12] } },
        { name: 'Bo', emptyBlocks: [0] },
      ],
    });
    const bo = file.entries[1]!.id;
    expect(file.marks.filter((m) => m.entryId === bo).map((m) => m.tenths)).toEqual([0, 0, 0]);
    expect(warnings.some((w) => w.level === 'info' && w.message.includes('a no-show'))).toBe(true);
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

describe('readLegacyFiles', () => {
  const file = (name: string, e?: FixtureEvent) => ({
    name,
    data: e ? buildEventFile(e) : new Uint8Array([1, 2, 3]),
  });

  it('groups event files into competitions in file-number order and ignores other files', () => {
    const result = readLegacyFiles([
      file('DATA10B.ROL', { name: 'Ten' }),
      file('roller.tlg'),
      file('DATA2B.ROL', { name: 'Two' }),
      file('DATA3B.rol', { name: 'Other', competition: 'Another Competition' }),
    ]);
    expect(result.ignored).toEqual(['roller.tlg']);
    expect(result.unreadable).toEqual([]);
    expect(result.competitions.map((c) => [c.name, c.events.map((e) => e.name)])).toEqual([
      ['Test Competition', ['Two', 'Ten']],
      ['Another Competition', ['Other']],
    ]);
  });

  it('reports a .ROL file that is not an event file instead of failing the rest', () => {
    const result = readLegacyFiles([file('DATA1B.ROL'), file('DATA2B.ROL', { name: 'Two' })]);
    expect(result.unreadable).toEqual([
      { name: 'DATA1B.ROL', message: expect.stringContaining('not a Calculating') },
    ]);
    expect(result.competitions[0]!.events).toHaveLength(1);
  });
});
