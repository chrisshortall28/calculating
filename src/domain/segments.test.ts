import { describe, expect, it } from 'vitest';
import { FIGURES, figureLabel } from './figures';
import {
  danceEventDefaults,
  danceFreeFactor,
  defaultFactors,
  eventMarkKeys,
  eventSegments,
  eventTieBreakMarks,
  factorSummary,
  markKeyLabel,
} from './segments';
import type { CompEvent } from './types';

const event = (over: Partial<CompEvent>): CompEvent => ({
  id: 'ev',
  competitionId: 'c',
  name: 'Event',
  order: 0,
  entryType: 'single',
  compulsoryDanceIds: [],
  hasFreeDance: false,
  ...danceEventDefaults(),
  discipline: 'figures',
  judgeIds: [],
  status: 'setup',
  ...over,
});

describe('figures catalogue', () => {
  it('numbers the 53 figures and shows the edges without the starting foot', () => {
    expect(FIGURES).toHaveLength(53);
    expect(figureLabel('1')).toBe('1. Eights FO - FO');
    expect(figureLabel('39')).toBe('39. Paragraph Loops BOI - BIO');
    expect(figureLabel('42')).toBe('42. Counter FO, Bracket & Counter FI');
    expect(figureLabel('46')).toBe('46. Double Three FO, Rocker & Paragraph Double Three B');
    expect(figureLabel('53')).toBe('53. Bracket BO, Rocker & Paragraph Bracket F');
  });
});

describe('the free dance factor in a dance event (hundredths)', () => {
  const dance = (dances: string[], hasFreeDance: boolean) =>
    event({ discipline: 'dance', compulsoryDanceIds: dances, hasFreeDance });
  const factors = (e: CompEvent) => eventSegments(e, []).map((s) => s.factor);

  it('is half the number of compulsory dances, as in Calculating For Windows', () => {
    expect([0, 1, 2, 3, 4].map(danceFreeFactor)).toEqual([100, 50, 100, 150, 200]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'scales so the free dance can score as many points as %i compulsory dances',
    (dances) => {
      // Each compulsory dance is one mark out of 10.0; the free dance is two (A and B).
      const compulsoryMax = dances * 10;
      const freeMax = (2 * 10 * danceFreeFactor(dances)) / 100;
      expect(freeMax).toBe(compulsoryMax);
    },
  );

  it('4 compulsory dances give up to 40 points and the free dance up to 20, so the free dance is ×2', () => {
    expect(danceFreeFactor(4)).toBe(200);
  });

  it('1 compulsory dance + free dance: 1 : ½; 2 dances + free dance: 1 : 1', () => {
    expect(factors(dance(['a'], true))).toEqual([100, 50]);
    expect(factors(dance(['a', 'b'], true))).toEqual([100, 100, 100]);
    expect(factors(dance(['a', 'b', 'c'], true))).toEqual([100, 100, 100, 150]);
  });

  it('leaves a single kind of part unfactored', () => {
    expect(factors(dance(['a', 'b'], false))).toEqual([100, 100]);
    expect(factors(dance([], true))).toEqual([100]);
  });

  it('is shown with the results when both kinds of part are skated', () => {
    expect(factorSummary(dance(['a'], true))).toBe('compulsory dances ×1, free dance ×0.5');
    expect(factorSummary(dance(['a', 'b'], true))).toBe('compulsory dances ×1, free dance ×1');
    expect(factorSummary(dance(['a', 'b'], false))).toBe('');
    expect(factorSummary(dance([], true))).toBe('');
  });
});

describe('default factors (hundredths)', () => {
  it('short and long: 1:3', () => {
    expect(defaultFactors(0, true, true)).toEqual({ figures: 100, short: 100, long: 300 });
  });
  it('figures with short and long: one per figure, 1, 3', () => {
    expect(defaultFactors(2, true, true)).toEqual({ figures: 200, short: 100, long: 300 });
    expect(defaultFactors(4, true, true)).toEqual({ figures: 400, short: 100, long: 300 });
  });
  it('every other mix: all 1', () => {
    expect(defaultFactors(3, false, false)).toEqual({ figures: 100, short: 100, long: 100 });
    expect(defaultFactors(2, true, false)).toEqual({ figures: 100, short: 100, long: 100 });
    expect(defaultFactors(2, false, true)).toEqual({ figures: 100, short: 100, long: 100 });
    expect(defaultFactors(0, false, true)).toEqual({ figures: 100, short: 100, long: 100 });
  });
});

describe('figures & free segments', () => {
  const ev = event({
    figures: [{ figureId: '8', side: 'L' }, { figureId: '8', side: 'R' }, { figureId: '1' }],
    hasShort: true,
    hasLong: true,
    factors: { figures: 300, short: 100, long: 300 },
  });

  it('lists the figures in order, then the programmes, each with its factor', () => {
    expect(eventSegments(ev, []).map((s) => [s.id, s.name, s.factor])).toEqual([
      ['cf:8:L', '8. Threes FO - BI (Left)', 300],
      ['cf:8:R', '8. Threes FO - BI (Right)', 300],
      ['cf:1:-', '1. Eights FO - FO', 300],
      ['sp', 'Short Programme', 100],
      ['lp', 'Free Programme', 300],
    ]);
    expect([...eventMarkKeys(ev)]).toEqual(['cf:8:L', 'cf:8:R', 'cf:1:-', 'sp:A', 'sp:B', 'lp:A', 'lp:B']);
    expect(['sp:A', 'lp:B', 'cf:8:L'].map((k) => markKeyLabel(k as never))).toEqual(['A', 'B', '']);
  });

  it('breaks ties on B marks only without figures: free, then short', () => {
    expect(eventTieBreakMarks(ev)).toEqual([]);
    expect(eventTieBreakMarks({ ...ev, figures: [] }).map((t) => t.key)).toEqual(['lp:B', 'sp:B']);
    expect(eventTieBreakMarks({ ...ev, figures: [], hasLong: false }).map((t) => t.key)).toEqual(['sp:B']);
    expect(eventTieBreakMarks({ ...ev, figures: [], hasShort: false }).map((t) => t.key)).toEqual(['lp:B']);
  });

  it('dance events keep the free dance B mark', () => {
    const dance = event({ discipline: 'dance', entryType: 'solo', hasFreeDance: true });
    expect(eventTieBreakMarks(dance)).toEqual([{ key: 'fd:B', label: 'free dance' }]);
    expect([...eventMarkKeys(dance)]).toEqual(['fd:A', 'fd:B']);
  });
});
