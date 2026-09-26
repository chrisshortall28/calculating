import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { calculateEvent, explainStep, ruleLabel, type ScoringSegment } from './index';

const CD: ScoringSegment = { id: 'cd:w', name: 'Glide Waltz', kind: 'compulsory', markKeys: ['cd:w'] };
const CD2: ScoringSegment = { id: 'cd:t', name: 'Tango', kind: 'compulsory', markKeys: ['cd:t'] };
const FD: ScoringSegment = { id: 'fd', name: 'Free Dance', kind: 'free', markKeys: ['fd:A', 'fd:B'] };

/** marks[segmentKey][judgeIndex][entryIndex] in decimal points */
function input(
  entries: string[],
  judgeCount: number,
  segments: ScoringSegment[],
  marks: Partial<Record<SegmentKey, number[][]>>,
) {
  const judges = Array.from({ length: judgeCount }, (_, i) => `j${i + 1}`);
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

/** One compulsory dance where each judge's mark is the sum. sums[judge][entry] */
const bySums = (entries: string[], sums: number[][]) => input(entries, sums.length, [CD], { 'cd:w': sums });

const placed = (r: ReturnType<typeof calculateEvent>) =>
  Object.fromEntries(r.overall.map((o) => [o.entryId, `${o.place}:${o.rule}`]));
const row = (r: ReturnType<typeof calculateEvent>, id: string) => r.overall.find((o) => o.entryId === id)!;

describe('table of victories and majority victories (rules 2–5)', () => {
  it('places by majority victories', () => {
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c'],
        [
          [5.0, 4.0, 3.0],
          [5.1, 4.1, 3.1],
          [4.0, 5.0, 3.0],
        ],
      ),
    );
    expect(r.complete).toBe(true);
    expect(r.victories.get('a')!.get('b')).toBe(2);
    expect(r.victories.get('b')!.get('a')).toBe(1);
    expect(placed(r)).toEqual({ a: '1:5', b: '2:5', c: '3:5' });
    expect(row(r, 'a')).toMatchObject({ majorityVictories: 2, totalVictories: 5, totalTenths: 141 });
  });

  it('sums every dance per judge, without factoring (A+B for the free dance)', () => {
    // Waltz favours a, free dance favours b by more.
    const r = calculateEvent(
      input(['a', 'b'], 3, [CD, FD], {
        'cd:w': [
          [6, 5],
          [6, 5],
          [6, 5],
        ],
        'fd:A': [
          [5, 5.5],
          [5, 5.5],
          [5, 5.5],
        ],
        'fd:B': [
          [5, 5.6],
          [5, 5.6],
          [5, 5.6],
        ],
      }),
    );
    expect(row(r, 'b').judgeSums).toEqual([161, 161, 161]);
    expect(placed(r)).toEqual({ b: '1:5', a: '2:5' });
  });

  it('rule 3: equal sums go to the free dance B mark, else half a victory each', () => {
    const r = calculateEvent(
      input(['a', 'b'], 3, [FD], {
        'fd:A': [
          [5.0, 5.1],
          [5.0, 5.0],
          [5.0, 5.2],
        ],
        'fd:B': [
          [5.2, 5.1],
          [5.0, 5.0],
          [5.0, 4.8],
        ],
      }),
    );
    // j1: equal 10.2, a wins on B; j2: equal 10.0 and equal B, half each; j3: equal, a wins on B.
    expect(r.victories.get('a')!.get('b')).toBe(2.5);
    expect(r.judgeTies).toEqual([
      { judgeId: 'j1', entryIds: ['a', 'b'], sum: 102, winner: 'a', bMarks: [52, 51] },
      { judgeId: 'j2', entryIds: ['a', 'b'], sum: 100, winner: undefined, bMarks: [50, 50] },
      { judgeId: 'j3', entryIds: ['a', 'b'], sum: 100, winner: 'a', bMarks: [50, 48] },
    ]);
    expect(placed(r)).toEqual({ a: '1:5', b: '2:5' });
  });

  it('rule 4: an equal decision is half a majority victory each', () => {
    // 4 judges split 2–2 between a and b; both beat c.
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c'],
        [
          [5, 4, 1],
          [5, 4, 1],
          [4, 5, 1],
          [4, 5, 1],
        ],
      ),
    );
    expect(row(r, 'a').majorityVictories).toBe(1.5);
    expect(row(r, 'b').majorityVictories).toBe(1.5);
  });
});

describe('ties on majority victories (rules 6–8)', () => {
  it('places by majority victories, and shares the place when a cycle cannot be split', () => {
    // No tie: a beats b 2–1.
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c', 'd'],
        [
          [5, 4, 1, 9],
          [5, 4, 1, 9],
          [4, 5, 1, 9],
        ],
      ),
    );
    expect(placed(r)).toEqual({ d: '1:5', a: '2:5', b: '3:5', c: '4:5' });

    // Cycle a>b>c>a on majority, all 1 majority victory.
    const cyc = calculateEvent(
      bySums(
        ['a', 'b', 'c'],
        [
          [3, 2, 1],
          [1, 3, 2],
          [2, 1, 3],
        ],
      ),
    );
    // Separate victories: a 3 (2 over b, 1 over c), b 3, c 3 → 6A doesn't split; no B marks;
    // total victories equal; total sums equal → all share 1st.
    expect(placed(cyc)).toEqual({ a: '1:8', b: '1:8', c: '1:8' });
    expect(cyc.overall.every((o) => o.tied)).toBe(true);
  });

  // a, d, e form a majority cycle (a>e, e>d, d>a): one majority victory and 3 separate victories
  // each, so 6A doesn't split them. Free dance sums per judge: a 10.4/10.1/10.2, d 10.1/10.2/10.3,
  // e 10.2/10.3/10.1.
  const cycleA = [
    [5.0, 4.8, 5.2],
    [4.8, 4.8, 5.3],
    [4.9, 5.0, 5.1],
  ];
  const cycleB = [
    [5.4, 5.3, 5.0],
    [5.3, 5.4, 5.0],
    [5.3, 5.3, 5.0],
  ];

  it('a rule that separates all the tied entries places every one of them (7B for all three)', () => {
    // Same sums, but d's B marks total 15.5: B totals a 16.0, d 15.5, e 15.0 all differ.
    const A = cycleA.map((r, j) => [r[0]!, r[1]! + [0.2, 0.2, 0.1][j]!, r[2]!]);
    const B = cycleB.map((r, j) => [r[0]!, r[1]! - [0.2, 0.2, 0.1][j]!, r[2]!]);
    const r = calculateEvent(input(['a', 'd', 'e'], 3, [FD], { 'fd:A': A, 'fd:B': B }));
    expect(placed(r)).toEqual({ a: '1:7B', d: '2:7B', e: '3:7B' });
    const name = (id: string) => id.toUpperCase();
    expect(explainStep(r.steps[2]!, name)).toEqual([
      '6A Separate victories: A 3, D 3, E 3 — still tied.',
      '7B Free dance B marks: A 16.0, D 15.5, E 15.0 — E takes 3rd.',
    ]);
  });

  it('entries level on a rule go on to the next rule; the rest are placed by it (manual example C-3)', () => {
    // B totals: a 16.0, d 16.0, e 15.0 → e is placed 3rd by 7B; a and d continue: total victories
    // equal; total sums a 30.7 v d 30.6 → a 1st, d 2nd by 7A.
    const r = calculateEvent(input(['a', 'd', 'e'], 3, [FD], { 'fd:A': cycleA, 'fd:B': cycleB }));
    const [first, second, third] = r.steps;
    expect(first!.trail.map((t) => t.rule)).toEqual(['6A', '7B', '7C', '7A']);
    expect(first!.trail[1]!.values).toEqual([
      { entryId: 'a', value: 160 },
      { entryId: 'd', value: 160 },
      { entryId: 'e', value: 150 },
    ]);
    expect(first!.trail[2]!.values.map((x) => x.entryId)).toEqual(['a', 'd']);
    expect(first).toMatchObject({ place: 1, rule: '7A', entryIds: ['a'], tiedOn: 1 });
    expect(second).toMatchObject({ place: 2, rule: '7A', entryIds: ['d'], contenders: ['a', 'd', 'e'] });
    expect(third).toMatchObject({ place: 3, rule: '7B', entryIds: ['e'] });
    const name = (id: string) => id.toUpperCase();
    expect(explainStep(second!, name)).toEqual([
      '6A Separate victories: A 3, D 3, E 3 — still tied.',
      '7B Free dance B marks: A 16.0, D 16.0, E 15.0 — A and D still level.',
      '7C Total victories: A 3, D 3 — still tied.',
      '7A Total sums: A 30.7, D 30.6 — D takes 2nd.',
    ]);
  });

  it('6B: two tied — the one the majority preferred between them, labelled "6B (S.M.V.)"', () => {
    // Majorities: a>b, b>c, c>a, a>d, b>d, d>c → a and b have 2 majority victories, c and d 1.
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c', 'd'],
        [
          [4, 3, 1, 2],
          [2, 4, 3, 1],
          [3, 1, 4, 5],
        ],
      ),
    );
    expect(placed(r)).toEqual({ a: '1:6B', b: '2:6B', d: '3:6B', c: '4:6B' });
    expect(ruleLabel('6B')).toBe('6B (S.M.V.)');
    expect(ruleLabel('7A')).toBe('7A');
    expect(explainStep(r.steps[0]!, (id) => id.toUpperCase())).toEqual([
      '6B (S.M.V.) Separate victories: A 2, B 1 — A takes 1st.',
    ]);
  });

  it('skips 7B when there is no free dance, and 7C before 7A', () => {
    // a and b split 1–1 head to head, so tie on 1½ majority victories. j2 gives a and c equal
    // sums (half a victory each), so b has more total victories.
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c'],
        [
          [5, 4, 3],
          [4, 5, 4],
        ],
      ),
    );
    expect(r.steps[0]!.trail.map((t) => t.rule)).toEqual(['6B', '7C']);
    expect(placed(r)).toEqual({ b: '1:7C', a: '2:7C', c: '3:5' });
  });

  it('8: a shared place uses up the places below it', () => {
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c'],
        [
          [5, 4, 3],
          [4, 5, 3],
        ],
      ),
    );
    expect(placed(r)).toEqual({ a: '1:8', b: '1:8', c: '3:5' });
    expect(row(r, 'a').tied).toBe(true);
    expect(row(r, 'c').tied).toBe(false);
  });

  it('explains each rule applied', () => {
    const r = calculateEvent(
      bySums(
        ['a', 'b', 'c'],
        [
          [5, 4, 3],
          [4, 5, 4],
        ],
      ),
    );
    const name = (id: string) => id.toUpperCase();
    expect(explainStep(r.steps[0]!, name)).toEqual([
      '6B (S.M.V.) Separate victories: A 1, B 1 — still tied.',
      '7C Total victories: A 2½, B 3 — B takes 1st.',
    ]);
    expect(explainStep(r.steps[1]!, name)).toEqual([
      '6B (S.M.V.) Separate victories: A 1, B 1 — still tied.',
      '7C Total victories: A 2½, B 3 — A takes 2nd.',
    ]);
    expect(explainStep(r.steps[2]!, name)).toEqual([]);
  });
});

describe('completeness', () => {
  it('reports missing marks and no result', () => {
    const r = calculateEvent(
      input(['a', 'b'], 3, [CD], {
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
    expect(calculateEvent(input(['a'], 0, [CD], {})).complete).toBe(false);
  });

  it('ranks each judge for a dance, splitting equal free dance totals by B', () => {
    const r = calculateEvent(input(['a', 'b'], 1, [FD, CD2], { 'fd:A': [[5.0, 4.0]], 'fd:B': [[4.0, 5.0]] }));
    const ord = r.segments[0]!.ordinals.get('j1')!;
    expect([ord.get('b'), ord.get('a')]).toEqual([1, 2]);
  });
});
