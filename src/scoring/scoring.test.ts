import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import {
  calculateEvent,
  explainJudgeTie,
  explainStep,
  formatSum,
  ruleLabel,
  type ScoringSegment,
  type TieBreakMark,
} from './index';

const CD: ScoringSegment = { id: 'cd:w', name: 'Glide Waltz', kind: 'compulsory', markKeys: ['cd:w'] };
const CD2: ScoringSegment = { id: 'cd:t', name: 'Tango', kind: 'compulsory', markKeys: ['cd:t'] };
const FD: ScoringSegment = { id: 'fd', name: 'Free Dance', kind: 'free', markKeys: ['fd:A', 'fd:B'] };

/** marks[segmentKey][judgeIndex][entryIndex] in decimal points */
function input(
  entries: string[],
  judgeCount: number,
  segments: ScoringSegment[],
  marks: Partial<Record<SegmentKey, number[][]>>,
  tieBreakMarks: TieBreakMark[] = [{ key: 'fd:B', label: 'free dance' }],
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
    tieBreakMarks,
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
    expect(row(r, 'a')).toMatchObject({ majorityVictories: 2, totalVictories: 5, totalSum: 14100 });
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
    expect(row(r, 'b').judgeSums).toEqual([16100, 16100, 16100]);
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
      {
        judgeId: 'j1',
        entryIds: ['a', 'b'],
        sum: 10200,
        winner: 'a',
        bMarks: [{ label: 'free dance', marks: [52, 51] }],
      },
      {
        judgeId: 'j2',
        entryIds: ['a', 'b'],
        sum: 10000,
        winner: undefined,
        bMarks: [{ label: 'free dance', marks: [50, 50] }],
      },
      {
        judgeId: 'j3',
        entryIds: ['a', 'b'],
        sum: 10000,
        winner: 'a',
        bMarks: [{ label: 'free dance', marks: [50, 48] }],
      },
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

  it('13 skaters, 3 judges, with tied judge ordinals: 3rd shared (8), 11th/12th by 6B', () => {
    // Each judge's ordinals per skater (1 = best; tied ordinals averaged), entered as marks of
    // 14 − ordinal so every judge ranks the skaters as given.
    const ordinals = [
      [10, 12, 12.5],
      [2, 3, 1],
      [1, 1, 2],
      [3, 4, 4],
      [6, 8, 7],
      [11, 13, 10.5],
      [5, 2, 4],
      [4, 5, 6],
      [7, 7, 9],
      [12, 11, 10.5],
      [8.5, 6, 8],
      [13, 10, 12.5],
      [8.5, 9, 4],
    ];
    const skaters = ordinals.map((_, i) => `s${i + 1}`);
    const r = calculateEvent(
      bySums(
        skaters,
        [0, 1, 2].map((j) => ordinals.map((o) => 14 - o[j]!)),
      ),
    );
    expect(placed(r)).toEqual({
      s3: '1:5',
      s2: '2:5',
      s4: '3:8',
      s7: '3:8',
      s8: '5:5',
      s5: '6:5',
      s11: '7:5',
      s9: '8:5',
      s13: '9:5',
      s10: '10:5',
      s1: '11:6B',
      s6: '12:6B',
      s12: '13:5',
    });
    const mv = (id: string) => [row(r, id).majorityVictories, row(r, id).totalVictories];
    expect(skaters.map(mv)).toEqual([
      [1.5, 4.5],
      [11, 33],
      [12, 35],
      [9.5, 28],
      [7, 18],
      [1.5, 4.5],
      [9.5, 28],
      [8, 24],
      [5, 16],
      [2.5, 5.5],
      [5.5, 16.5],
      [0.5, 3.5],
      [4.5, 17.5],
    ]);
    // Equal ordinals from one judge are half a victory each (no free dance B mark to split them).
    expect(r.judgeTies).toHaveLength(6);
    expect(r.judgeTies.every((t) => t.winner === undefined)).toBe(true);

    const step = (place: number) => r.steps.find((s) => s.place === place)!;
    expect(explainStep(step(3), (id) => id)).toEqual([
      '6B (S.M.V.) Separate victories: s4 1½, s7 1½ — still tied.',
      '7C Total victories: s4 28, s7 28 — still tied.',
      '7A Total sums: s4 31.0, s7 31.0 — still tied.',
      '8 Still equal after every rule: the entries share the place, and the places below are used up.',
    ]);
    expect(explainStep(step(11), (id) => id)).toEqual([
      '6B (S.M.V.) Separate victories: s1 2, s6 1 — s1 takes 11th.',
    ]);
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

describe('figures & free events', () => {
  const FIG: ScoringSegment = {
    id: 'cf:1:-',
    name: '1. Eights FO - FO',
    kind: 'compulsory',
    markKeys: ['cf:1:-'],
  };
  const SP: ScoringSegment = { id: 'sp', name: 'Short Programme', kind: 'free', markKeys: ['sp:A', 'sp:B'] };
  const LP: ScoringSegment = { id: 'lp', name: 'Long Programme', kind: 'free', markKeys: ['lp:A', 'lp:B'] };
  const LONG_THEN_SHORT: TieBreakMark[] = [
    { key: 'lp:B', label: 'long programme' },
    { key: 'sp:B', label: 'short programme' },
  ];
  const names = (id: string) => id.toUpperCase();

  it('figures: equal sums are half a victory each, and ties skip 7B', () => {
    const r = calculateEvent(
      input(
        ['a', 'b'],
        3,
        [FIG],
        {
          'cf:1:-': [
            [5, 5],
            [6, 5],
            [5, 6],
          ],
        },
        [],
      ),
    );
    expect(r.judgeTies).toEqual([{ judgeId: 'j1', entryIds: ['a', 'b'], sum: 5000, winner: undefined }]);
    expect(r.victories.get('a')!.get('b')).toBe(1.5);
    expect(r.steps[0]!.trail.map((t) => t.rule)).toEqual(['6B', '7C', '7A']);
    expect(placed(r)).toEqual({ a: '1:8', b: '1:8' });
  });

  it('short and long: the long programme counts three times the short', () => {
    // a is better on raw marks (28 v 24), b once the long programme is ×3 (48 v 52).
    const same = (a: number, b: number) => [
      [a, b],
      [a, b],
      [a, b],
    ];
    const r = calculateEvent(
      input(
        ['a', 'b'],
        3,
        [SP, { ...LP, factor: 300 }],
        { 'sp:A': same(9, 5), 'sp:B': same(9, 5), 'lp:A': same(5, 7), 'lp:B': same(5, 7) },
        LONG_THEN_SHORT,
      ),
    );
    expect(row(r, 'b').judgeSums).toEqual([52000, 52000, 52000]);
    expect(placed(r)).toEqual({ b: '1:5', a: '2:5' });
  });

  it('rule 3: equal sums go to the long, then the short programme B mark', () => {
    const r = calculateEvent(
      input(
        ['a', 'b'],
        1,
        [SP, { ...LP, factor: 300 }],
        { 'sp:A': [[5.0, 5.2]], 'sp:B': [[5.2, 5.0]], 'lp:A': [[5, 5]], 'lp:B': [[5, 5]] },
        LONG_THEN_SHORT,
      ),
    );
    const tie = r.judgeTies[0]!;
    expect(tie).toEqual({
      judgeId: 'j1',
      entryIds: ['a', 'b'],
      sum: 40200,
      winner: 'a',
      bMarks: [
        { label: 'long programme', marks: [50, 50] },
        { label: 'short programme', marks: [52, 50] },
      ],
    });
    expect(explainJudgeTie(tie, names, () => 'J1')).toBe(
      'J1 gave A and B equal sums (40.2) and equal long programme B marks: A takes that judge’s victory on the short programme B mark (5.2 v 5.0).',
    );
  });

  it('rule 7B: the long programme B marks, then the short programme B marks', () => {
    // j1 favours a, j2 favours b; long B totals are equal, short B totals favour b.
    const r = calculateEvent(
      input(
        ['a', 'b'],
        2,
        [SP, { ...LP, factor: 300 }],
        {
          'sp:A': [
            [6, 5],
            [5, 5],
          ],
          'sp:B': [
            [5, 5],
            [5, 6],
          ],
          'lp:A': [
            [5, 5],
            [5, 5],
          ],
          'lp:B': [
            [5, 5],
            [5, 5],
          ],
        },
        LONG_THEN_SHORT,
      ),
    );
    expect(placed(r)).toEqual({ b: '1:7B', a: '2:7B' });
    const step = r.steps[0]!;
    expect(step.trail.map((t) => [t.rule, t.label])).toEqual([
      ['6B', undefined],
      ['7B', 'long programme'],
      ['7B', 'short programme'],
    ]);
    expect(explainStep(step, names)).toEqual([
      '6B (S.M.V.) Separate victories: A 1, B 1 — still tied.',
      '7B Long programme B marks: A 10.0, B 10.0 — still tied.',
      '7B Short programme B marks: A 10.0, B 11.0 — B takes 1st.',
    ]);
  });

  it('figures with free skating: no 7B, and 7A totals the factored sums', () => {
    // a leads on raw sums (51 v 50.8); with figures ×2 and long ×3, b leads (102 v 102.4).
    const r = calculateEvent(
      input(
        ['a', 'b'],
        2,
        [{ ...FIG, factor: 200 }, SP, { ...LP, factor: 300 }],
        {
          'cf:1:-': [
            [6, 5],
            [5, 5],
          ],
          'sp:A': [
            [5, 5],
            [5, 5],
          ],
          'sp:B': [
            [5, 5],
            [5, 5],
          ],
          'lp:A': [
            [5, 5],
            [5, 5],
          ],
          'lp:B': [
            [5, 5],
            [5, 5.8],
          ],
        },
        [],
      ),
    );
    const step = r.steps[0]!;
    expect(step.trail.map((t) => t.rule)).toEqual(['6B', '7C', '7A']);
    expect(row(r, 'b').totalSum).toBe(102400);
    expect(placed(r)).toEqual({ b: '1:7A', a: '2:7A' });
  });

  it('decimal factors give exact sums', () => {
    const r = calculateEvent(
      input(['a'], 1, [{ ...SP, factor: 125 }], { 'sp:A': [[4.0]], 'sp:B': [[4.5]] }, [
        { key: 'sp:B', label: 'short programme' },
      ]),
    );
    expect(row(r, 'a').judgeSums).toEqual([10625]);
    expect(formatSum(10625)).toBe('10.625');
    expect(formatSum(35700)).toBe('35.7');
    expect(formatSum(35000)).toBe('35.0');
    expect(formatSum(10620)).toBe('10.62');
  });

  it('ignores tie-break marks whose part is not being scored (standing so far)', () => {
    const r = calculateEvent(input(['a'], 1, [SP], { 'sp:A': [[5]], 'sp:B': [[5]] }, LONG_THEN_SHORT));
    expect(r.tieBreakMarks).toEqual([{ key: 'sp:B', label: 'short programme' }]);
  });
});
