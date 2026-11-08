import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { calculateEvent } from '../scoring';
import { resultsPages } from './documents';
import type { EventData } from './loadEvent';
import { scopedEventData } from './scopedResults';
import { sampleEvent } from './testEvent';

const texts = (node: unknown): string[] =>
  typeof node === 'string'
    ? [node]
    : Array.isArray(node)
      ? node.flatMap(texts)
      : node && typeof node === 'object'
        ? Object.values(node).flatMap(texts)
        : [];

/**
 * Amy and Beth, three judges. Two compulsory dances (Amy wins the first, Beth the second, both fully marked),
 * and a free dance with only some marks in, so the event is not complete.
 */
function event(freeMarked: boolean): EventData {
  const base = sampleEvent();
  const segments = [
    {
      id: 'cd:a',
      name: 'Dance A',
      kind: 'compulsory' as const,
      markKeys: ['cd:a' as SegmentKey],
      factor: 100,
    },
    {
      id: 'cd:b',
      name: 'Dance B',
      kind: 'compulsory' as const,
      markKeys: ['cd:b' as SegmentKey],
      factor: 100,
    },
    {
      id: 'fd',
      name: 'Free Dance',
      kind: 'free' as const,
      markKeys: ['fd:A', 'fd:B'] as SegmentKey[],
      factor: 100,
    },
  ];
  const mark = (k: SegmentKey, j: string, e: string) => {
    if (k === 'cd:a') return e === 'e0' ? 60 : 50;
    if (k === 'cd:b') return e === 'e0' ? 45 : 55;
    // Free dance: Beth is better, but only judge j0 has marked it unless `freeMarked`.
    return freeMarked || j === 'j0' ? (e === 'e0' ? 40 : 70) : undefined;
  };
  const d: EventData = {
    ...base,
    event: { ...base.event, compulsoryDanceIds: ['a', 'b'], hasFreeDance: true },
    segments,
    mark,
    result: undefined as never,
  };
  d.result = calculateEvent({
    entryIds: ['e0', 'e1'],
    judgeIds: d.event.judgeIds,
    segments,
    mark,
    tieBreakMarks: [{ key: 'fd:B', label: 'free dance' }],
  });
  return d;
}

describe('scopedEventData', () => {
  it('is the event itself for the final results', () => {
    const d = event(true);
    expect(scopedEventData(d, 'final')).toBe(d);
  });

  it('places the skaters on the compulsory dances alone, though the free dance is not marked', () => {
    const d = event(false);
    expect(d.result.complete).toBe(false);
    const c = scopedEventData(d, 'compulsory')!;
    expect(c.result.complete).toBe(true);
    expect(c.segments.map((s) => s.name)).toEqual(['Dance A', 'Dance B']);
    // Amy 6.0 + 4.5 = 10.5, Beth 5.0 + 5.5 = 10.5 per judge: level, so the places are shared.
    expect(c.result.overall.map((o) => o.place)).toEqual([1, 1]);
    expect(c.scope).toEqual({
      label: 'Compulsory dances',
      basedOn: ['Dance A', 'Dance B'],
      notMarked: [],
    });
  });

  it('uses only the compulsory dances that are fully marked', () => {
    const d = event(false);
    const partMarked: EventData = {
      ...d,
      mark: (k, j, e) => (k === 'cd:b' && e === 'e1' ? undefined : d.mark(k, j, e)),
    };
    const c = scopedEventData(partMarked, 'compulsory')!;
    expect(c.scope!.basedOn).toEqual(['Dance A']);
    expect(c.scope!.notMarked).toEqual(['Dance B']);
    expect(c.result.overall[0]!.entryId).toBe('e0');
    expect(c.result.complete).toBe(true);
  });

  it('is unavailable until a part of that kind is fully marked', () => {
    expect(scopedEventData(event(false), 'free')).toBeUndefined();
    expect(scopedEventData(event(false), 'short')).toBeUndefined();
    const f = scopedEventData(event(true), 'free')!;
    expect(f.result.overall[0]!.entryId).toBe('e1'); // Beth wins the free dance
    expect(f.segments).toHaveLength(1);
  });

  it('does not apply the event’s factors to a part standing alone', () => {
    const d = event(true);
    const weighted: EventData = {
      ...d,
      segments: d.segments.map((s) => (s.id === 'fd' ? { ...s, factor: 150 } : s)),
    };
    const f = scopedEventData(weighted, 'free')!;
    const plain = scopedEventData(d, 'free')!;
    expect(f.result.overall.map((o) => o.totalSum)).toEqual(plain.result.overall.map((o) => o.totalSum));
    expect(f.segments[0]!.factor).toBe(100);
  });
});

describe('results PDF from some of the parts', () => {
  it('says what the results are for and what they are based on, and still prints without the later parts', () => {
    const d = event(false);
    expect(resultsPages([d], 'standard', true)).toEqual([]); // the final results need every mark
    const pages = resultsPages([scopedEventData(d, 'compulsory')!], 'standard', true);
    const t = texts(pages);
    expect(t).toContain('Event — Compulsory dances');
    expect(t).toContain('Based on Dance A, Dance B');
    expect(texts(resultsPages([d], 'standard', true))).not.toContain('Based on Dance A, Dance B');
  });

  it('shows only the chosen parts in the with-marks tables', () => {
    const t = texts(resultsPages([scopedEventData(event(true), 'free')!], 'withMarks', true));
    expect(t).toContain('Free Dance');
    expect(t).not.toContain('Dance A');
  });
});
