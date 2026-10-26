import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import type { CompEvent, SegmentKey } from '../domain/types';
import { calculateEvent } from '.';

/**
 * Golden results: judges' marks in, placings out, with no files or database involved. Each event is a
 * real competition's dance event whose results were printed by the application Podium replaces
 * (Calculating For Windows) and checked row by row: place, entry, points, majority victories, the
 * tie-break rule that placed the entry, and each judge's placing.
 *
 * `golden/comp1.golden.json` has 73 events and 468 entries, with every name and club made up. The
 * events cover every tie-break rule, equal sums split by the free dance B mark, half victories, and an
 * entry that did not skate (all marks 0.0, placed last).
 */
interface GoldenEvent {
  name: string;
  judges: number;
  /** Compulsory dance ids, in the order skated. */
  dances: string[];
  freeDance: boolean;
  /** In start order. `marks` is each judge's mark in tenths, in panel order. */
  entries: { name: string; marks: Record<string, number[]> }[];
  expected: {
    entry: string;
    place: number;
    points: number;
    mv: number;
    /** The rule that placed the entry: 5, 6B, 7A, 7B or 7C. */
    rule: string;
    judges: number[];
  }[];
}

const { events }: { events: GoldenEvent[] } = JSON.parse(
  readFileSync('src/scoring/golden/comp1.golden.json', 'utf8'),
);

function score(e: GoldenEvent) {
  const judgeIds = Array.from({ length: e.judges }, (_, j) => `j${j}`);
  const event: CompEvent = {
    id: 'e',
    competitionId: 'c',
    name: e.name,
    order: 0,
    entryType: 'solo',
    compulsoryDanceIds: e.dances,
    hasFreeDance: e.freeDance,
    discipline: 'dance',
    figures: [],
    hasShort: false,
    hasLong: false,
    factors: { figures: 100, short: 100, long: 100 },
    judgeIds,
    status: 'scoring',
  };
  const dances = e.dances.map((id) => ({ id, competitionId: 'c', name: id }));
  const entryIds = e.entries.map((_, i) => `en${i}`);
  const result = calculateEvent({
    entryIds,
    judgeIds,
    segments: eventSegments(event, dances),
    mark: (key, judgeId, entryId) =>
      e.entries[entryIds.indexOf(entryId)]!.marks[key as SegmentKey]?.[judgeIds.indexOf(judgeId)],
    tieBreakMarks: eventTieBreakMarks(event),
  });
  return {
    complete: result.complete,
    rows: result.overall.map((o) => ({
      entry: e.entries[entryIds.indexOf(o.entryId)]!.name,
      place: o.place,
      points: o.totalSum / 1000,
      mv: o.majorityVictories,
      rule: o.rule,
      judges: o.judgeRanks,
    })),
  };
}

describe('golden results: marks to placings', () => {
  it('covers every tie-break rule', () => {
    const rules = new Set(events.flatMap((e) => e.expected.map((r) => r.rule)));
    expect([...rules].sort()).toEqual(['5', '6B', '7A', '7B', '7C']);
  });

  it.each(events.map((e) => [e.name, e] as const))('%s', (_name, e) => {
    const { complete, rows } = score(e);
    expect(complete).toBe(true);
    expect(rows).toHaveLength(e.expected.length);
    rows.forEach((row, i) => {
      const want = e.expected[i]!;
      expect({ ...row, points: undefined }).toEqual({ ...want, points: undefined });
      expect(row.points).toBeCloseTo(want.points, 3);
    });
  });
});
