import { describe, expect, it } from 'vitest';
import { judgeEventRanks } from './judgeOrdinals';
import type { ScoringSegment } from './types';

const segments: ScoringSegment[] = [
  { id: 'cd:1', name: 'One', kind: 'compulsory', markKeys: ['cd:1'], factor: 100 },
  { id: 'fd', name: 'Free', kind: 'free', markKeys: ['fd:A', 'fd:B'], factor: 100 },
];

describe('judgeEventRanks', () => {
  const marks: Record<string, number> = {
    'cd:1/a': 50,
    'fd:A/a': 60,
    'fd:B/a': 70, // 18.0
    'cd:1/b': 60,
    'fd:A/b': 60,
    'fd:B/b': 60, // 18.0, lower B
    'cd:1/c': 40,
    'fd:A/c': 40,
    'fd:B/c': 40, // 12.0
  };
  const mark = (k: string, _j: string, e: string) => marks[`${k}/${e}`];

  it('sums every mark and splits equal sums by the B mark', () => {
    const { sums, ranks } = judgeEventRanks(segments, 'j', ['a', 'b', 'c'], mark, [
      { key: 'fd:B', label: 'free dance' },
    ]);
    expect(sums.get('a')).toBe(18000);
    expect([ranks.get('a'), ranks.get('b'), ranks.get('c')]).toEqual([1, 2, 3]);
  });

  it('shares a ranking when nothing separates entries', () => {
    const { ranks } = judgeEventRanks(segments, 'j', ['a', 'b', 'c'], mark, []);
    expect([ranks.get('a'), ranks.get('b'), ranks.get('c')]).toEqual([1, 1, 3]);
  });
});
