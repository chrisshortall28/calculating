import { describe, expect, it } from 'vitest';
import {
  cleanSwaps,
  duplicateJudges,
  hasSwaps,
  isMarkValid,
  occupant,
  renameJudgeInSwaps,
  seatMark,
  segmentIdOfKey,
  segmentPanel,
} from './panels';
import { danceEventDefaults } from './segments';
import type { CompEvent, SegmentKey } from './types';

const event = (extra: Partial<CompEvent> = {}): CompEvent => ({
  id: 'ev',
  competitionId: 'c',
  name: 'E',
  order: 0,
  entryType: 'solo',
  compulsoryDanceIds: ['w'],
  hasFreeDance: true,
  ...danceEventDefaults(),
  judgeIds: ['A', 'B', 'C'],
  status: 'scoring',
  ...extra,
});

describe('panels', () => {
  it('finds the segment of a mark key', () => {
    expect(segmentIdOfKey('cd:w')).toBe('cd:w');
    expect(segmentIdOfKey('fd:A')).toBe('fd');
    expect(segmentIdOfKey('fd:B')).toBe('fd');
    expect(segmentIdOfKey('sp:B')).toBe('sp');
    expect(segmentIdOfKey('lp:A')).toBe('lp');
    expect(segmentIdOfKey('cf:fig1:L')).toBe('cf:fig1:L');
  });

  it('seats the panel’s own judges when there are no swaps (the historic case)', () => {
    const e = event();
    expect(hasSwaps(e)).toBe(false);
    expect(segmentPanel(e, 'fd')).toEqual(['A', 'B', 'C']);
    const raw = (_k: SegmentKey, j: string) => (j === 'A' ? 1 : undefined);
    expect(seatMark(e, raw)).toBe(raw); // no wrapper at all
    expect(isMarkValid(e, { segmentKey: 'cd:w', judgeId: 'B' })).toBe(true);
    expect(isMarkValid(e, { segmentKey: 'cd:w', judgeId: 'D' })).toBe(false);
    expect(isMarkValid(e, { segmentKey: 'cd:gone', judgeId: 'A' })).toBe(false);
  });

  it('puts a substitute in a seat for one segment only', () => {
    const e = event({ judgeSwaps: { fd: { B: 'D' } } });
    expect(hasSwaps(e)).toBe(true);
    expect(occupant(e, 'fd', 'B')).toBe('D');
    expect(occupant(e, 'cd:w', 'B')).toBe('B');
    expect(segmentPanel(e, 'fd')).toEqual(['A', 'D', 'C']);
    expect(segmentPanel(e, 'cd:w')).toEqual(['A', 'B', 'C']);
    // Marks are read from whoever sat in the seat for that part.
    const raw = (k: SegmentKey, j: string) =>
      j === 'B' && k === 'cd:w' ? 5 : j === 'D' && k === 'fd:A' ? 7 : undefined;
    const seat = seatMark(e, raw);
    expect(seat('cd:w', 'B', 'x')).toBe(5);
    expect(seat('fd:A', 'B', 'x')).toBe(7);
    expect(seat('fd:A', 'A', 'x')).toBeUndefined();
    // The substitute's marks are valid in the free dance only; the seat's own judge's are valid in the other part.
    expect(isMarkValid(e, { segmentKey: 'fd:A', judgeId: 'D' })).toBe(true);
    expect(isMarkValid(e, { segmentKey: 'cd:w', judgeId: 'D' })).toBe(false);
    expect(isMarkValid(e, { segmentKey: 'fd:A', judgeId: 'B' })).toBe(false);
    expect(isMarkValid(e, { segmentKey: 'cd:w', judgeId: 'B' })).toBe(true);
  });

  it('cleans swaps that no longer apply', () => {
    const e = event({
      judgeSwaps: { fd: { B: 'D', Z: 'E', C: 'C' }, 'cd:gone': { A: 'D' }, 'cd:w': { A: 'D' } },
    });
    expect(cleanSwaps(e)).toEqual({ fd: { B: 'D' }, 'cd:w': { A: 'D' } });
    expect(cleanSwaps(event({ judgeSwaps: { fd: { C: 'C' } } }))).toBeUndefined();
    expect(cleanSwaps(event())).toBeUndefined();
  });

  it('finds a judge in two seats, and renames judges inside swaps', () => {
    expect(duplicateJudges(['A', 'D', 'D'])).toEqual(['D']);
    expect(duplicateJudges(['A', 'B', 'C'])).toEqual([]);
    expect(renameJudgeInSwaps({ fd: { B: 'D' } }, 'B', 'Q')).toEqual({ fd: { Q: 'D' } });
    expect(renameJudgeInSwaps({ fd: { B: 'D' } }, 'D', 'Q')).toEqual({ fd: { B: 'Q' } });
    expect(renameJudgeInSwaps(undefined, 'B', 'Q')).toBeUndefined();
  });
});
