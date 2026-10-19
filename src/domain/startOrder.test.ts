import { describe, expect, it } from 'vitest';
import { effectiveRotate, firstSkaters, partStartIndexes, rotatedOrder } from './startOrder';
import type { Segment } from './segments';

// 1-based starters, as Calculators write them.
const starters = (n: number, parts: number) => partStartIndexes(n, parts).map((i) => i + 1);

describe('partStartIndexes', () => {
  it.each([
    [6, 2, [1, 4]],
    [7, 2, [1, 5]],
    [8, 2, [1, 5]],
    [9, 2, [1, 6]],
    [10, 2, [1, 6]],
    [12, 3, [1, 5, 9]],
    [13, 3, [1, 6, 10]],
  ])('%i skaters, %i parts', (n, parts, expected) => {
    expect(starters(n, parts)).toEqual(expected);
  });

  it('keeps starts inside the field when there are fewer entries than parts', () => {
    expect(partStartIndexes(2, 4)).toEqual([0, 1, 1, 1]);
    expect(partStartIndexes(0, 2)).toEqual([0, 0]);
  });
});

describe('rotatedOrder', () => {
  it('starts at the part’s first skater and wraps round', () => {
    expect(rotatedOrder([1, 2, 3, 4, 5, 6, 7, 8], 1, 2)).toEqual([5, 6, 7, 8, 1, 2, 3, 4]);
    expect(rotatedOrder([1, 2, 3], 0, 2)).toEqual([1, 2, 3]);
  });
});

describe('effectiveRotate', () => {
  it('uses the event setting, falling back to the competition default', () => {
    expect(effectiveRotate({}, { rotateStartOrder: true })).toBe(true);
    expect(effectiveRotate({ rotateStartOrder: 'default' }, {})).toBe(false);
    expect(effectiveRotate({ rotateStartOrder: 'off' }, { rotateStartOrder: true })).toBe(false);
    expect(effectiveRotate({ rotateStartOrder: 'on' }, {})).toBe(true);
  });
});

describe('firstSkaters', () => {
  const seg = (id: string, kind: Segment['kind']): Segment => ({ id, kind, name: id, markKeys: [] });
  const segments = [seg('cd:a', 'compulsory'), seg('cd:b', 'compulsory'), seg('fd', 'free')];

  it('maps each compulsory segment to its first skater, leaving free parts out', () => {
    expect([...firstSkaters(segments, 8, true)]).toEqual([
      ['cd:a', 0],
      ['cd:b', 4],
    ]);
  });
  it('is empty when rotation is off or there is only one compulsory part', () => {
    expect(firstSkaters(segments, 8, false).size).toBe(0);
    expect(firstSkaters([segments[0]!, segments[2]!], 8, true).size).toBe(0);
  });
});
