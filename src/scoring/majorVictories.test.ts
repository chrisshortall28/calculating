import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { calculateEvent, type ScoringSegment } from './index';
import { judgeEventRankings, majorVictories } from './majorVictories';

const totals = (rows: Record<string, Record<string, number>>) =>
  new Map(Object.entries(rows).map(([j, byEntry]) => [j, new Map(Object.entries(byEntry))]));

describe('judgeEventRankings', () => {
  it('ranks by total, highest first, sharing ties', () => {
    const r = judgeEventRankings(['a', 'b', 'c', 'd'], totals({ j1: { a: 50, b: 60, c: 60, d: 40 } }));
    expect(Object.fromEntries(r.get('j1')!)).toEqual({ b: 1, c: 1, a: 3, d: 4 });
  });
});

describe('majorVictories', () => {
  it('counts opponents beaten by a majority of judges', () => {
    // j1: a>b>c, j2: b>a>c, j3: a>c>b
    const rankings = judgeEventRankings(
      ['a', 'b', 'c'],
      totals({
        j1: { a: 3, b: 2, c: 1 },
        j2: { a: 2, b: 3, c: 1 },
        j3: { a: 3, b: 1, c: 2 },
      }),
    );
    const v = majorVictories(['a', 'b', 'c'], ['j1', 'j2', 'j3'], rankings);
    // a beats b (j1, j3) and c (all) → 2; b beats c (j1, j2) → 1; c beats nobody → 0
    expect(Object.fromEntries(v)).toEqual({ a: 2, b: 1, c: 0 });
  });

  it('a judge ranking a pair equally counts for neither', () => {
    const rankings = judgeEventRankings(
      ['a', 'b'],
      totals({
        j1: { a: 5, b: 5 },
        j2: { a: 6, b: 5 },
        j3: { a: 5, b: 6 },
      }),
    );
    // a is preferred by only j2, b only by j3 — no majority either way
    expect(Object.fromEntries(majorVictories(['a', 'b'], ['j1', 'j2', 'j3'], rankings))).toEqual({
      a: 0,
      b: 0,
    });
  });
});

describe('calculateEvent overall rows', () => {
  const CD: ScoringSegment = { id: 'cd:w', name: 'Waltz', kind: 'compulsory', markKeys: ['cd:w'] };
  const FD: ScoringSegment = { id: 'fd', name: 'Free', kind: 'free', markKeys: ['fd:A', 'fd:B'] };

  it('includes each judge event ranking (total over all dances) and major victories', () => {
    // points[key][judge][entry]
    const points: Record<string, number[][]> = {
      'cd:w': [
        [50, 40],
        [50, 40],
        [40, 50],
      ],
      'fd:A': [
        [50, 40],
        [40, 60],
        [40, 50],
      ],
      'fd:B': [
        [50, 40],
        [40, 60],
        [40, 50],
      ],
    };
    const r = calculateEvent({
      entryIds: ['a', 'b'],
      judgeIds: ['j1', 'j2', 'j3'],
      segments: [CD, FD],
      mark: (k: SegmentKey, j, e) => points[k]![Number(j.slice(1)) - 1]![e === 'a' ? 0 : 1],
    });
    // Event totals: j1 a150 b120; j2 a130 b160; j3 a120 b150 → j1 prefers a, j2 & j3 prefer b
    const row = (id: string) => r.overall.find((o) => o.entryId === id)!;
    expect(row('a').judgeRanks).toEqual([1, 2, 2]);
    expect(row('b').judgeRanks).toEqual([2, 1, 1]);
    expect(row('a').majorVictories).toBe(0);
    expect(row('b').majorVictories).toBe(1);
  });
});
