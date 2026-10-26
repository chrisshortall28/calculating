import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CompetitionFile } from '../io/competitionFile';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import { legacyDanceCode, matchLegacyDance } from './dances';
import { exportLegacyEvents, legacyDate } from './export';
import { buildEventFile, type FixtureEvent } from './fixtures';
import { checksumProblems } from './format';
import { readLegacyEvent } from './readEvent';

const compulsory = (name: string, extra: Partial<FixtureEvent> = {}): FixtureEvent => ({
  name,
  compulsory: [{ code: 20 }, { code: 38 }],
  entries: [
    { name: 'Anna Test', club: 'ClubA', blocks: { 0: [13, 13, 12], 1: [10, 12, 10] } },
    { name: 'Bella Test', club: 'ClubB', blocks: { 0: [20, 20, 9], 1: [12, 15, 11] } },
  ],
  ...extra,
});

/** A Podium competition made by importing the given legacy events. */
function podiumCompetition(...events: FixtureEvent[]): CompetitionFile {
  const read = events.map((e, i) =>
    readLegacyEvent(`DATA00${i + 1}B.ROL`, buildEventFile({ date: '9th August 2026', ...e })),
  );
  return convertLegacyCompetition(groupLegacyEvents(read)[0]!).file;
}

describe('legacyDate', () => {
  it.each([
    ['2026-08-09', '9th August 2026'],
    ['2026-01-01', '1st January 2026'],
    ['2026-03-02', '2nd March 2026'],
    ['2026-03-03', '3rd March 2026'],
    ['2026-03-11', '11th March 2026'],
    ['2026-03-12', '12th March 2026'],
    ['2026-03-13', '13th March 2026'],
    ['2026-03-21', '21st March 2026'],
    ['2026-03-22', '22nd March 2026'],
    ['2026-03-23', '23rd March 2026'],
    ['', ''],
  ])('%s', (iso, text) => expect(legacyDate(iso)).toBe(text));
});

describe('matchLegacyDance', () => {
  it.each([
    ['Canasta Tango', 28, true],
    ['canasta  tango', 28, true],
    ['14 Step', 7, true],
    ['Cannasta Tango', 28, false],
    ['Siesta Tangoo', 20, false],
    ['Viennese Walz', 16, false],
  ])('%s is dance %i', (name, code, exact) => expect(matchLegacyDance(name)).toMatchObject({ code, exact }));

  it.each(['Bachata', 'Sweet Tango', 'And Foxtrot', 'Tango', 'Blue', 'Waltz', ''])(
    '%j has no close dance',
    (name) => expect(matchLegacyDance(name)).toBeUndefined(),
  );
});

describe('legacyDanceCode', () => {
  it('finds a dance by name in any spelling', () => {
    expect(legacyDanceCode('Kleiner Waltz')).toBe(1);
    expect(legacyDanceCode('siesta  TANGO')).toBe(20);
    expect(legacyDanceCode('Fourteen Step')).toBe(7);
    expect(legacyDanceCode('14 Step')).toBe(7);
    expect(legacyDanceCode('14 Step Plus')).toBe(35);
    expect(legacyDanceCode('Bachata')).toBeUndefined();
  });
});

describe('exportLegacyEvents', () => {
  it('writes event files the application accepts, numbered in order', () => {
    const out = exportLegacyEvents(
      podiumCompetition(compulsory('A one'), {
        name: 'B free',
        entries: [
          { name: 'Iris Test', club: 'ClubA', blocks: { 6: [20, 20, 20], 7: [22, 20, 22] } },
          { name: 'Jane Test', club: 'ClubB', blocks: { 6: [17, 25, 24], 7: [19, 22, 25] } },
        ],
        hasLong: true,
      }),
    );
    expect(out.files.map((f) => [f.name, f.event])).toEqual([
      ['DATA001B.ROL', 'A one'],
      ['DATA002B.ROL', 'B free'],
    ]);
    for (const f of out.files) expect(checksumProblems(f.data), f.name).toEqual([]);
    expect(out.skipped).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  it('round-trips an imported competition: the exported files read back as the same events', () => {
    const file = podiumCompetition(
      compulsory('Solo', { judges: ['Emma', 'Robert', 'Charlie'], referee: 'Emma' }),
      {
        name: 'Duos',
        compulsory: [{ code: 28 }],
        entries: [
          { name: 'Ann Smith / Bo Jones', club: 'Red Rose', blocks: { 0: [20, 21, 22] } },
          { name: 'Cy Day / Di Eve', club: 'Moonrake', blocks: { 0: [19, 25, 20] } },
        ],
      },
    );
    const back = exportLegacyEvents(file).files.map((f) => readLegacyEvent(f.name, f.data));
    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({
      name: 'Solo',
      competition: { name: 'Test Competition', venue: 'Test Venue', date: '9th August 2026' },
      judges: ['Emma', 'Robert', 'Charlie'],
      referee: 'Emma',
      compulsory: [{ code: 20 }, { code: 38 }],
      hasLong: false,
    });
    expect(back[0]!.entries.map((e) => [e.name, e.club, e.blocks.slice(0, 2)])).toEqual([
      [
        'Anna Test',
        'ClubA',
        [
          [13, 13, 12],
          [10, 12, 10],
        ],
      ],
      [
        'Bella Test',
        'ClubB',
        [
          [20, 20, 9],
          [12, 15, 11],
        ],
      ],
    ]);
    expect(back[1]!.entries.map((e) => [e.name, e.blocks[0]])).toEqual([
      ['Ann Smith / Bo Jones', [20, 21, 22]],
      ['Cy Day / Di Eve', [19, 25, 20]],
    ]);
  });

  it('exports a team by its team name', () => {
    const file = podiumCompetition(compulsory('Super Fun Team'));
    file.entries[0] = {
      ...file.entries[0]!,
      teamName: 'Moonrakers Milky Way',
      skaterIds: [],
      club: 'Moonrake',
    };
    const [out] = exportLegacyEvents(file).files;
    const back = readLegacyEvent(out!.name, out!.data);
    expect(back.entries[0]).toMatchObject({ name: 'Moonrakers Milky Way', club: 'Moonrake' });
  });

  it('skips what it can not export, and says why', () => {
    const file = podiumCompetition(
      compulsory('Fine'),
      {
        name: 'Figures',
        typeCode: 0,
        compulsory: [{ code: 1 }],
        entries: [{ name: 'Ann', blocks: { 0: [10, 10, 10] } }],
      },
      compulsory('Empty', { entries: [] }),
      compulsory('Five dances'),
    );
    const five = file.events.find((e) => e.name === 'Five dances')!;
    five.compulsoryDanceIds.push(...['a', 'b', 'c'].map((id) => `extra-${id}`));
    const out = exportLegacyEvents(file);
    expect(out.files.map((f) => f.event)).toEqual(['Fine']);
    expect(Object.fromEntries(out.skipped.map((s) => [s.event, s.reason]))).toEqual({
      Figures: expect.stringContaining('figures events'),
      Empty: expect.stringContaining('no entries'),
      'Five dances': expect.stringContaining('more than 4 compulsory dances'),
    });
  });

  it('exports an event with compulsory dances and a free dance, with the tables of its three phases', () => {
    const file = podiumCompetition(
      compulsory('Combined', {
        entries: [
          {
            name: 'Anna Test',
            club: 'ClubA',
            blocks: { 0: [13, 13, 12], 1: [10, 12, 10], 6: [15, 16, 17], 7: [18, 22, 24] },
          },
          {
            name: 'Bella Test',
            club: 'ClubB',
            blocks: { 0: [20, 20, 9], 1: [12, 15, 11], 6: [31, 32, 33], 7: [34, 35, 36] },
          },
        ],
        hasLong: true,
      }),
    );
    const out = exportLegacyEvents(file);
    expect(out.skipped).toEqual([]);
    expect(out.warnings).toEqual([
      {
        level: 'info',
        message: expect.stringContaining(
          '1 event has compulsory dances and a free dance. The free dance is exported with a factor of 1',
        ),
      },
    ]);
    const data = out.files[0]!.data;
    expect(checksumProblems(data)).toEqual([]);
    const back = readLegacyEvent('x', data);
    expect(back).toMatchObject({ name: 'Combined', hasLong: true, compulsory: [{ code: 20 }, { code: 38 }] });
    expect(back.entries.map((e) => e.blocks)).toEqual([
      [[13, 13, 12], [10, 12, 10], null, null, null, null, [15, 16, 17], [18, 22, 24]],
      [[20, 20, 9], [12, 15, 11], null, null, null, null, [31, 32, 33], [34, 35, 36]],
    ]);
  });

  it('exports marks not entered yet as 0.0, with a warning', () => {
    const file = podiumCompetition(compulsory('Partly marked'));
    file.marks = file.marks.filter(
      (m) => !(m.segmentKey === file.marks[5]!.segmentKey && m.judgeId === file.marks[5]!.judgeId),
    );
    const out = exportLegacyEvents(file);
    expect(out.files).toHaveLength(1);
    expect(out.warnings).toEqual([
      {
        level: 'warning',
        message:
          '2 marks not entered yet were exported as 0.0, in event “Partly marked”; enter them in the application.',
      },
    ]);
    expect(checksumProblems(out.files[0]!.data)).toEqual([]);
  });

  it('cuts over-long text short, with a warning', () => {
    const file = podiumCompetition(
      compulsory('Long', {
        entries: [{ name: 'Ann', club: 'X', blocks: { 0: [10, 10, 10], 1: [10, 10, 10] } }],
      }),
    );
    file.skaters[0]!.club = 'A very long club name';
    const out = exportLegacyEvents(file);
    expect(readLegacyEvent('x', out.files[0]!.data).entries[0]!.club).toBe('A very l');
    expect(out.warnings).toEqual([
      {
        level: 'warning',
        message:
          '1 club name was shortened to fit the application’s 8-character limit (for example “A very long club name” became “A very l”).',
      },
    ]);
  });

  it('exports a dance the application does not have as its unnamed dance, with a warning', () => {
    const file = podiumCompetition(compulsory('Odd'));
    file.dances[0]!.name = 'Bachata';
    const out = exportLegacyEvents(file);
    expect(readLegacyEvent('x', out.files[0]!.data).compulsory.map((c) => c.code)).toEqual([0, 38]);
    expect(out.warnings).toEqual([
      {
        level: 'warning',
        message:
          '1 dance is not in the application’s list, so it was exported as its unnamed “Dance No n” (the name is not kept): “Bachata”.',
      },
    ]);
  });

  it('exports a mistyped dance name as the dance it is a slip away from, with a note', () => {
    const file = podiumCompetition(compulsory('Typo'));
    file.dances[0]!.name = 'Cannasta Tango';
    const out = exportLegacyEvents(file);
    expect(readLegacyEvent('x', out.files[0]!.data).compulsory.map((c) => c.code)).toEqual([28, 38]);
    expect(out.warnings).toEqual([
      {
        level: 'info',
        message:
          '1 dance name was matched to the nearest dance in the application: “Cannasta Tango” as “Canasta Tango”.',
      },
    ]);
  });

  it('summarises the same kind of change across events instead of repeating it', () => {
    const file = podiumCompetition(compulsory('A'), compulsory('B'), compulsory('C'));
    file.skaters[0]!.club = 'Long club number one';
    file.skaters[1]!.club = 'Long club number two';
    file.events[0]!.name = 'An event name that is far too long to fit in forty characters';
    file.dances[0]!.name = 'Bachata'; // used by all three events
    const out = exportLegacyEvents(file);
    expect(out.files).toHaveLength(3);
    expect(out.warnings.map((w) => w.message)).toEqual([
      '2 club names were shortened to fit the application’s 8-character limit (for example “Long club number one” became “Long clu”).',
      '1 event name was shortened to fit the application’s 40-character limit (for example “An event name that is far too long to fit in forty characters” became “An event name that is far too long to fi”).',
      '1 dance is not in the application’s list, so it was exported as its unnamed “Dance No n” (the name is not kept): “Bachata” (3 events).',
    ]);
  });
});

/** Real files: set LEGACY_SAMPLES to the folder holding `comp1` (see samples.test.ts). */
const samples = process.env.LEGACY_SAMPLES ?? 'examples/legacy';
describe.skipIf(!existsSync(`${samples}/comp1`))('exporting an imported real competition (comp1)', () => {
  const dir = `${samples}/comp1`;
  const real = (existsSync(dir) ? readdirSync(dir) : [])
    .filter((f) => /\.ROL$/i.test(f))
    .sort()
    .map((f) => readLegacyEvent(f, new Uint8Array(readFileSync(`${dir}/${f}`))));
  const imported = existsSync(dir) ? convertLegacyCompetition(groupLegacyEvents(real)[0]!).file : undefined;
  const out = imported ? exportLegacyEvents(imported) : undefined;

  it('writes a valid file for every dance event', () => {
    // 75 imported events, less the one with no entries.
    expect(out!.files).toHaveLength(74);
    for (const f of out!.files) expect(checksumProblems(f.data), f.name).toEqual([]);
    expect(out!.skipped.map((x) => x.event)).toEqual(['27 Mix & Match']); // it has no entries
  });

  it('writes the same events back: names, panel, dances, entries and every mark', () => {
    const original = real.filter((e) => e.kind === 'dance' && e.entries.length > 0);
    const back = out!.files.map((f) => readLegacyEvent(f.name, f.data));
    expect(back).toHaveLength(original.length);
    back.forEach((b, i) => {
      const o = original[i]!;
      expect(b.name).toBe(o.name);
      expect(b.judges).toEqual(o.judges);
      expect(b.referee).toBe(o.referee);
      expect(b.compulsory.map((c) => c.code)).toEqual(o.compulsory.map((c) => c.code));
      expect(b.hasLong).toBe(o.hasLong);
      expect(b.entries.map((e) => [e.name, e.club, e.blocks])).toEqual(
        o.entries.map((e) => [e.name, e.club, e.blocks]),
      );
    });
  });
});
