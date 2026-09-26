import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { calculateEvent, type ScoringSegment } from './index';

const CD: ScoringSegment = { id: 'cd:w', name: 'Glide Waltz', kind: 'compulsory', markKeys: ['cd:w'] };
const CD2: ScoringSegment = { id: 'cd:t', name: 'Tango', kind: 'compulsory', markKeys: ['cd:t'] };
const FD: ScoringSegment = { id: 'fd', name: 'Free Dance', kind: 'free', markKeys: ['fd:A', 'fd:B'] };

/** marks[segmentKey][judgeIndex][entryIndex] in decimal points */
function input(
  entries: string[],
  judges: string[],
  segments: ScoringSegment[],
  marks: Partial<Record<SegmentKey, number[][]>>,
) {
  return {
    entryIds: entries,
    judgeIds: judges,
    segments,
    mark: (key: SegmentKey, judgeId: string, entryId: string) => {
      const v = marks[key]?.[judges.indexOf(judgeId)]?.[entries.indexOf(entryId)];
      return v === undefined ? undefined : Math.round(v * 10);
    },
  };
}

const places = (r: ReturnType<typeof calculateEvent>) =>
  Object.fromEntries(r.overall.map((o) => [o.entryId, o.place]));

describe('calculateEvent — single compulsory dance', () => {
  it('places by clear majority', () => {
    const r = calculateEvent(
      input(['a', 'b', 'c'], ['j1', 'j2', 'j3'], [CD], {
        'cd:w': [
          [5.0, 4.0, 3.0],
          [5.1, 4.1, 3.1],
          [4.0, 5.0, 3.0],
        ],
      }),
    );
    expect(r.complete).toBe(true);
    expect(places(r)).toEqual({ a: 1, b: 2, c: 3 });
    expect(r.overallSteps[0]).toMatchObject({ place: 1, entryIds: ['a'], rule: 'Majority' });
  });

  it('widens the column when nobody has a majority of firsts', () => {
    // ordinals: a=[1,2,3] b=[2,1,2] c=[3,3,1] → nobody has 2 firsts; at 2nd-or-better a has 2, b has 3
    const r = calculateEvent(
      input(['a', 'b', 'c'], ['j1', 'j2', 'j3'], [CD], {
        'cd:w': [
          [5, 4, 3],
          [4, 5, 3],
          [3, 4, 5],
        ],
      }),
    );
    expect(places(r)).toEqual({ b: 1, a: 2, c: 3 });
    expect(r.overallSteps[0]!.rule).toBe('Greater majority');
  });

  it('breaks equal majority by lower sum, then total points', () => {
    // ordinals a=[1,1,3] b=[2,2,1] c=[3,3,2]: at 1st only a has majority → a first.
    // Then b=[2,2,1] majority at 2nd; c has [2] only → b second.
    const r = calculateEvent(
      input(['a', 'b', 'c'], ['j1', 'j2', 'j3'], [CD], {
        'cd:w': [
          [5, 4, 3],
          [5, 4, 3],
          [3, 5, 4],
        ],
      }),
    );
    expect(places(r)).toEqual({ a: 1, b: 2, c: 3 });

    // Equal majority count and sum: a=[1,2,3] b=[2,1,3]... use 2 judges majority=2
    const r2 = calculateEvent(
      input(['a', 'b'], ['j1', 'j2'], [CD], {
        'cd:w': [
          [5.0, 4.0],
          [4.5, 5.0],
        ],
      }),
    );
    // both have [1,2] → same majority & sum at 2nd; a total 9.5 vs b 9.0
    expect(places(r2)).toEqual({ a: 1, b: 2 });
    expect(r2.overallSteps[0]!.rule).toBe('Higher total points');
  });

  it('keeps an unresolvable tie as a shared place', () => {
    const r = calculateEvent(
      input(['a', 'b', 'c'], ['j1', 'j2'], [CD], {
        'cd:w': [
          [5, 4, 3],
          [4, 5, 3],
        ],
      }),
    );
    expect(places(r)).toEqual({ a: 1, b: 1, c: 3 });
    expect(r.overall.find((o) => o.entryId === 'a')!.tied).toBe(true);
  });

  it('shares ordinals when a judge gives equal marks', () => {
    const r = calculateEvent(input(['a', 'b', 'c'], ['j1'], [CD], { 'cd:w': [[5, 5, 3]] }));
    const ord = r.segments[0]!.ordinals.get('j1')!;
    expect([ord.get('a'), ord.get('b'), ord.get('c')]).toEqual([1, 1, 3]);
  });
});

describe('calculateEvent — free dance', () => {
  it('uses A+B, splitting judge ties by B', () => {
    const r = calculateEvent(
      input(['a', 'b'], ['j1'], [FD], {
        'fd:A': [[5.0, 4.0]],
        'fd:B': [[4.0, 5.0]],
      }),
    );
    const ord = r.segments[0]!.ordinals.get('j1')!;
    expect(ord.get('b')).toBe(1);
    expect(ord.get('a')).toBe(2);
  });
});

describe('calculateEvent — completeness & combination', () => {
  it('reports missing marks and no overall result', () => {
    const r = calculateEvent(
      input(['a', 'b'], ['j1', 'j2', 'j3'], [CD], {
        'cd:w': [
          [5, 4],
          [5, 4],
        ],
      }),
    );
    expect(r.complete).toBe(false);
    expect(r.missingMarks).toBe(2);
    expect(r.totalMarks).toBe(6);
    expect(r.overall).toEqual([]);
  });

  it('is incomplete without judges', () => {
    const r = calculateEvent(input(['a'], [], [CD], {}));
    expect(r.complete).toBe(false);
  });

  it('sums segment places and breaks ties by free dance place', () => {
    // CD: a 1st, b 2nd. FD: b 1st, a 2nd → sums equal (3), free dance decides → b wins.
    const r = calculateEvent(
      input(['a', 'b'], ['j1', 'j2', 'j3'], [CD, FD], {
        'cd:w': [
          [5, 4],
          [5, 4],
          [5, 4],
        ],
        'fd:A': [
          [4, 5],
          [4, 5],
          [4, 5],
        ],
        'fd:B': [
          [4, 5],
          [4, 5],
          [4, 5],
        ],
      }),
    );
    expect(places(r)).toEqual({ b: 1, a: 2 });
    expect(r.overallSteps[0]!.rule).toBe('Better free dance place');
  });

  it('sums places across multiple compulsory dances', () => {
    const r = calculateEvent(
      input(['a', 'b', 'c'], ['j1', 'j2', 'j3'], [CD, CD2], {
        'cd:w': [
          [5, 4, 3],
          [5, 4, 3],
          [5, 4, 3],
        ],
        'cd:t': [
          [3, 5, 4],
          [3, 5, 4],
          [3, 5, 4],
        ],
      }),
    );
    // a: 1+3=4, b: 2+1=3, c: 3+2=5
    expect(places(r)).toEqual({ b: 1, a: 2, c: 3 });
  });
});
