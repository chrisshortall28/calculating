import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import type { CompetitionFile } from '../io/competitionFile';
import { calculateEvent } from '../scoring';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import { buildEventFile, type FixtureEntry } from './fixtures';
import { readLegacyEvent } from './readEvent';

/**
 * Golden results: a real competition's event files, converted and scored by Podium, against the results
 * the Calculating For Windows application itself printed for it (checked row by row: place, entry,
 * points, majority victories, tie-break rule and each judge's placing).
 *
 * `golden/comp1.golden.json` is that competition with every name, club, judge, venue and date replaced
 * by a made-up one. Each event keeps its marks, dances and settings, and the legacy application's
 * expected results. The files are rebuilt from it here in the legacy layout (docs/legacy-format.md),
 * including the stale entry rows the application leaves behind when entries are removed.
 */
interface GoldenEvent {
  name: string;
  typeCode: number;
  judges: string[];
  referee?: string;
  compulsory: { code: number }[];
  hasLong: boolean;
  staleRows: number;
  entries: { name: string; club: string; blocks: Record<string, number[]> }[];
  /** Absent for an event Podium does not import (the quartet). */
  expected?: {
    entry: string;
    place: number;
    points: number;
    mv: number;
    /** Podium's label for the rule that placed the entry: 5, 6B, 7A, 7B or 7C. */
    rule: string;
    judges: number[];
  }[];
}

const golden: { events: GoldenEvent[] } = JSON.parse(
  readFileSync('src/legacy/golden/comp1.golden.json', 'utf8'),
);

const conversion = convertLegacyCompetition(
  groupLegacyEvents(
    golden.events.map((e, i) =>
      readLegacyEvent(
        `DATA${String(i + 1).padStart(3, '0')}B.ROL`,
        buildEventFile({
          name: e.name,
          typeCode: e.typeCode,
          judges: e.judges,
          referee: e.referee,
          compulsory: e.compulsory,
          hasLong: e.hasLong,
          staleRows: e.staleRows,
          entries: e.entries.map((en): FixtureEntry => ({
            name: en.name,
            club: en.club,
            blocks: Object.fromEntries(Object.entries(en.blocks).map(([k, v]) => [Number(k), v])),
          })),
        }),
      ),
    ),
  )[0]!,
);
const file: CompetitionFile = conversion.file;

function score(eventName: string) {
  const event = file.events.find((e) => e.name === eventName)!;
  const entries = file.entries.filter((e) => e.eventId === event.id);
  const marks = new Map(
    file.marks
      .filter((m) => m.eventId === event.id)
      .map((m) => [`${m.segmentKey}|${m.judgeId}|${m.entryId}`, m.tenths]),
  );
  const result = calculateEvent({
    entryIds: entries.map((e) => e.id),
    judgeIds: event.judgeIds,
    segments: eventSegments(event, file.dances),
    mark: (k, j, e) => marks.get(`${k}|${j}|${e}`),
    tieBreakMarks: eventTieBreakMarks(event),
  });
  const label = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId)!;
    const skaters = entry.skaterIds.map((id) => file.skaters.find((s) => s.id === id)!);
    const name = entry.teamName ?? skaters.map((s) => s.name).join(' / ');
    const club = entry.club ?? skaters[0]?.club ?? '';
    return club ? `${name} (${club})` : name;
  };
  return {
    complete: result.complete,
    rows: result.overall.map((o) => ({
      entry: label(o.entryId),
      place: o.place,
      points: o.totalSum / 1000,
      mv: o.majorityVictories,
      rule: o.rule,
      judges: o.judgeRanks,
    })),
  };
}

describe('legacy golden results (comp1)', () => {
  const scored = golden.events.filter((e) => e.expected);

  it('imports every event except the quartet, which Podium does not support', () => {
    expect(golden.events).toHaveLength(74);
    expect(scored).toHaveLength(73);
    expect(file.events).toHaveLength(73);
    expect(conversion.skippedEvents).toEqual(['25 Quartet']);
  });

  it('covers every tie-break rule', () => {
    const rules = new Set(scored.flatMap((e) => e.expected!.map((r) => r.rule)));
    expect([...rules].sort()).toEqual(['5', '6B', '7A', '7B', '7C']);
  });

  it.each(scored.map((e) => [e.name, e] as const))('%s matches the legacy results', (name, e) => {
    const { complete, rows } = score(name);
    expect(complete).toBe(true);
    expect(rows).toHaveLength(e.expected!.length);
    rows.forEach((row, i) => {
      const want = e.expected![i]!;
      expect({ ...row, points: undefined }).toEqual({ ...want, points: undefined });
      expect(row.points).toBeCloseTo(want.points, 3);
    });
  });
});
