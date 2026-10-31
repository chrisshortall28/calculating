import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import { parseCompetitionFile, type CompetitionFile } from '../io/competitionFile';
import { calculateEvent } from '../scoring';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import { readLegacyEvent } from './readEvent';

/**
 * Real Calculating For Windows files. They are not in the repository (they hold real names), so
 * point LEGACY_SAMPLES at the folder that contains `comp1`, `comp2`, ... to run these.
 */
const samples = process.env.LEGACY_SAMPLES ?? 'examples/legacy';

function load(folder: string) {
  const dir = `${samples}/${folder}`;
  const events = readdirSync(dir)
    .filter((f) => /\.ROL$/i.test(f))
    .sort()
    .map((f) => readLegacyEvent(f, new Uint8Array(readFileSync(`${dir}/${f}`))));
  return groupLegacyEvents(events).map((c) => convertLegacyCompetition(c));
}

function place(file: CompetitionFile, eventName: string) {
  const event = file.events.find((e) => e.name === eventName)!;
  const marks = new Map(
    file.marks
      .filter((m) => m.eventId === event.id)
      .map((m) => [`${m.segmentKey}|${m.judgeId}|${m.entryId}`, m.tenths]),
  );
  const entries = file.entries.filter((e) => e.eventId === event.id);
  const result = calculateEvent({
    entryIds: entries.map((e) => e.id),
    judgeIds: event.judgeIds,
    segments: eventSegments(event, file.dances),
    mark: (k, j, e) => marks.get(`${k}|${j}|${e}`),
    tieBreakMarks: eventTieBreakMarks(event),
  });
  const name = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId)!;
    return entry.teamName ?? file.skaters.find((s) => s.id === entry.skaterIds[0])!.name;
  };
  return result.overall.map((row) => ({ name: name(row.entryId), place: row.place, sum: row.totalSum }));
}

const have = (folder: string) => existsSync(`${samples}/${folder}`);

describe.skipIf(!have('comp1'))('legacy sample competition (comp1)', () => {
  const [conversion] = have('comp1') ? load('comp1') : [];
  const file = conversion?.file as CompetitionFile;

  it('is one competition whose files all convert to a valid Podium file', () => {
    expect(load('comp1')).toHaveLength(1);
    expect(() => parseCompetitionFile(JSON.parse(JSON.stringify(file)))).not.toThrow();
    // 76 event files, minus the quartet event Podium does not support.
    expect(file.events.length + conversion!.skippedEvents.length).toBe(76);
    expect(conversion!.skippedEvents).toEqual(['25 Quartet']);
    expect(file.competition).toMatchObject({ name: 'Elite Southwest Skating Festival', date: '2026-08-09' });
  });

  it('reproduces the legacy application’s result for 1A Rising Stars (7 skaters, not the stale 8th row)', () => {
    // Printed by Calculating For Windows: places 1-7 with these points.
    expect(place(file, '1A Rising Stars')).toEqual([
      { name: 'Anya Garcia', place: 1, sum: 7300 },
      { name: 'Lily Acs', place: 2, sum: 6100 },
      { name: 'Zoey Butler', place: 3, sum: 6000 },
      { name: 'Eliza Bombera', place: 4, sum: 4900 },
      { name: 'Chloe Stapleton', place: 5, sum: 4800 },
      { name: 'Patrick Lohan', place: 6, sum: 4400 },
      { name: 'Penelope Preece', place: 7, sum: 3500 },
    ]);
  });
});

describe.skipIf(!have('comp1'))('legacy no-shows (comp1)', () => {
  const file = (have('comp1') ? load('comp1')[0]!.file : undefined) as CompetitionFile;

  it('places an entry with all-zero marks last on 0.0, as the legacy application does', () => {
    const novice = place(file, '3A Novice Solo');
    expect(novice).toHaveLength(11);
    expect(novice.at(-1)).toEqual({ name: 'Elizabeth McIlduff', place: 11, sum: 0 });
    const team = place(file, '26A Super Fun Team');
    expect(team.at(-1)).toEqual({ name: 'Meridian Hours', place: 5, sum: 0 });
  });
});

describe.skipIf(!have('comp2'))('legacy sample events (comp2)', () => {
  const file = (have('comp2') ? load('comp2')[0]!.file : undefined) as CompetitionFile;
  const event = (name: string) => file.events.find((e) => e.name === name)!;

  it('reads figures, pairs, singles and a five-judge panel', () => {
    expect(event('More than 3 judges').judgeIds).toHaveLength(5);
    expect(event('Figures')).toMatchObject({
      entryType: 'single',
      figures: [
        { figureId: '1', side: 'L' },
        { figureId: '2', side: 'R' },
      ],
    });
    expect(event('Pairs')).toMatchObject({ entryType: 'pairs', hasShort: true, hasLong: true });
    expect(event('Free')).toMatchObject({
      entryType: 'single',
      figures: [{ figureId: '5' }],
      hasShort: true,
      hasLong: false,
    });
  });

  it('reads the factors set in the application (compulsory 2, short 1/2, long 3/2)', () => {
    expect(event('Factors').factors).toEqual({ figures: 200, short: 50, long: 150 });
  });

  it('reads the five-judge marks 1.0 to 1.4', () => {
    const e = event('More than 3 judges');
    expect(file.marks.filter((m) => m.eventId === e.id).map((m) => m.tenths)).toEqual([10, 11, 12, 13, 14]);
  });
});

describe.skipIf(!have('comp3'))('legacy Couples Dance events (comp3)', () => {
  const [conversion] = have('comp3') ? load('comp3') : [];
  const file = conversion?.file as CompetitionFile;

  it('imports them as couples events with both skaters and their dances', () => {
    expect(conversion!.skippedEvents).toEqual([]);
    expect(() => parseCompetitionFile(JSON.parse(JSON.stringify(file)))).not.toThrow();
    const masters = file.events.find((e) => e.name === 'Masters Couples Dance')!;
    expect(masters).toMatchObject({ entryType: 'couples', discipline: 'dance', hasFreeDance: false });
    expect(masters.compulsoryDanceIds.map((id) => file.dances.find((d) => d.id === id)!.name)).toEqual([
      'Glide Waltz',
      'City Blues',
    ]);
    const entries = file.entries.filter((e) => e.eventId === masters.id);
    expect(entries).toHaveLength(3);
    const names = (entryIndex: number) =>
      entries[entryIndex]!.skaterIds.map((id) => file.skaters.find((s) => s.id === id)!.name);
    expect(names(0)).toEqual(['Anita Barnes', 'Graham Harvey']);
  });
});
