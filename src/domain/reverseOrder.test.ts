import { describe, expect, it } from 'vitest';
import type { ScoringSegment } from '../scoring';
import { reverseOrderBySoFar } from './reverseOrder';
import type { SegmentKey } from './types';

const waltz: ScoringSegment = { id: 'cd:w', name: 'Waltz', kind: 'compulsory', markKeys: ['cd:w'] };
const free: ScoringSegment = { id: 'fd', name: 'Free dance', kind: 'free', markKeys: ['fd:A', 'fd:B'] };
const judgeIds = ['j1', 'j2', 'j3'];

/** Every judge gives each entry the same mark for a segment's keys; entries without one are unmarked. */
const marks =
  (bySegment: Record<string, Record<string, number>>) => (key: SegmentKey, _judge: string, entry: string) =>
    bySegment[key]?.[entry];

describe('reverseOrderBySoFar', () => {
  it('puts the lowest placed first and the highest placed last', () => {
    const result = reverseOrderBySoFar({
      entryIds: ['a', 'b', 'c'],
      judgeIds,
      segments: [waltz],
      mark: marks({ 'cd:w': { a: 50, b: 70, c: 60 } }),
      tieBreakMarks: [],
    });
    expect(result).toEqual({ order: ['a', 'c', 'b'], basedOn: ['Waltz'] });
  });

  it('uses only the parts with every mark in', () => {
    const result = reverseOrderBySoFar({
      entryIds: ['a', 'b', 'c'],
      judgeIds,
      segments: [waltz, free],
      // The free dance is marked for two entries only, and would reverse the order if it counted.
      mark: marks({ 'cd:w': { a: 50, b: 70, c: 60 }, 'fd:A': { a: 90, b: 10 }, 'fd:B': { a: 90, b: 10 } }),
      tieBreakMarks: [{ key: 'fd:B', label: 'free dance' }],
    });
    expect(result).toEqual({ order: ['a', 'c', 'b'], basedOn: ['Waltz'] });
  });

  it('counts every complete part, each by its factor', () => {
    const result = reverseOrderBySoFar({
      entryIds: ['a', 'b', 'c'],
      judgeIds,
      segments: [waltz, { ...free, factor: 200 }],
      mark: marks({
        'cd:w': { a: 50, b: 70, c: 60 },
        // a's free dance (×2) outweighs b's lead in the waltz
        'fd:A': { a: 100, b: 20, c: 30 },
        'fd:B': { a: 100, b: 20, c: 30 },
      }),
      tieBreakMarks: [{ key: 'fd:B', label: 'free dance' }],
    });
    expect(result?.basedOn).toEqual(['Waltz', 'Free dance']);
    expect(result?.order).toEqual(['b', 'c', 'a']);
  });

  it('keeps entries level on a place in their current order', () => {
    const result = reverseOrderBySoFar({
      entryIds: ['a', 'b', 'c'],
      judgeIds,
      segments: [waltz],
      mark: marks({ 'cd:w': { a: 50, b: 50, c: 70 } }),
      tieBreakMarks: [],
    });
    expect(result?.order).toEqual(['a', 'b', 'c']);
  });

  it('has no order until a part is complete', () => {
    const input = {
      entryIds: ['a', 'b'],
      judgeIds,
      segments: [waltz],
      tieBreakMarks: [],
    };
    expect(reverseOrderBySoFar({ ...input, mark: marks({}) })).toBeUndefined();
    expect(reverseOrderBySoFar({ ...input, mark: marks({ 'cd:w': { a: 50 } }) })).toBeUndefined();
  });
});
