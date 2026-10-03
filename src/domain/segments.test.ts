import { describe, expect, it } from 'vitest';
import { FIGURES, figureLabel } from './figures';
import {
  danceEventDefaults,
  defaultFactors,
  eventMarkKeys,
  eventSegments,
  eventTieBreakMarks,
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
  it('numbers the 41 figures and shows the edges without the starting foot', () => {
    expect(FIGURES).toHaveLength(41);
    expect(figureLabel('1')).toBe('1. Eights FO - FO');
    expect(figureLabel('39')).toBe('39. Paragraph Loops BOI - BIO');
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
