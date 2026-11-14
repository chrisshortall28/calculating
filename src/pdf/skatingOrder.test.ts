import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { sampleEvent } from './testEvent';
import type { EventData } from './loadEvent';
import { skatingOrderDocument, skatingOrderPages } from './skatingOrder';

const texts = (node: unknown): string[] =>
  typeof node === 'string'
    ? [node]
    : Array.isArray(node)
      ? node.flatMap(texts)
      : node && typeof node === 'object'
        ? Object.values(node).flatMap(texts)
        : [];

function event(parts: number, entries = 4, rotating = true): EventData {
  const base = sampleEvent();
  const segments = [
    ...Array.from({ length: parts }, (_, i) => ({
      id: `cd:${i}`,
      name: `Dance ${i + 1}`,
      kind: 'compulsory' as const,
      markKeys: [`cd:${i}` as SegmentKey],
    })),
    { id: 'fd', name: 'Free Dance', kind: 'free' as const, markKeys: ['fd:A', 'fd:B'] as SegmentKey[] },
  ];
  const names = ['Amy', 'Beth', 'Cat', 'Dee', 'Eve', 'Fay'];
  return {
    ...base,
    segments,
    rows: Array.from({ length: entries }, (_, i) => ({
      id: `e${i}`,
      name: names[i] ?? `Skater ${i + 1}`,
      club: 'Club',
      members: '',
      skaterIds: [],
    })),
    firstSkaters: rotating
      ? new Map(Array.from({ length: parts }, (_, i) => [`cd:${i}`, Math.floor((i * entries) / parts)]))
      : new Map(),
  };
}

const names = (page: unknown, all = ['Amy', 'Beth', 'Cat', 'Dee']) =>
  texts(page).filter((t) => all.includes(t));

describe('skatingOrderPages', () => {
  it('has a page for each part, headed with its name and number', () => {
    const pages = skatingOrderPages([event(2)]);
    expect(pages).toHaveLength(3);
    const t = texts(pages.slice(0, 2));
    expect(t).toEqual(
      expect.arrayContaining(['Event — Dance 1 (Dance 1 of 2)', 'Event — Dance 2 (Dance 2 of 2)']),
    );
    expect(texts(pages[2])).toContain('Event — Free Dance');
  });

  it('starts each rotating dance with its first skater, keeping start numbers, and leaves the free dance alone', () => {
    const [dance1, dance2, free] = skatingOrderPages([event(2)]);
    expect(names(dance1)).toEqual(['Amy', 'Beth', 'Cat', 'Dee']);
    expect(names(dance2)).toEqual(['Cat', 'Dee', 'Amy', 'Beth']);
    // The event's number in the title bar, then the start numbers.
    expect(texts(dance2).filter((t) => /^[1-4]$/.test(t))).toEqual(['1', '3', '4', '1', '2']);
    expect(names(free)).toEqual(['Amy', 'Beth', 'Cat', 'Dee']);
    expect(texts(dance2).filter((t) => t === 'Skates first')).toHaveLength(1);
  });

  it('keeps the start order when the event does not rotate, with nobody marked first', () => {
    const pages = skatingOrderPages([event(2, 4, false)]);
    for (const p of pages) expect(names(p)).toEqual(['Amy', 'Beth', 'Cat', 'Dee']);
    expect(texts(pages).filter((t) => t === 'Skates first')).toHaveLength(0);
  });

  it('prints only the chosen parts', () => {
    const pages = skatingOrderPages([event(3)], new Set(['cd:1', 'fd']));
    expect(pages).toHaveLength(2);
    expect(texts(pages[0])).toContain('Event — Dance 2 (Dance 2 of 3)');
    expect(skatingOrderPages([event(3)], new Set())).toHaveLength(0);
  });

  it('puts a long list in two columns', () => {
    const [page] = skatingOrderPages([event(0, 30, false)]);
    const content = page as unknown as { columns?: unknown[] }[];
    expect(content.some((c) => Array.isArray(c.columns) && c.columns.length === 2)).toBe(true);
  });
});

describe('skatingOrderPages', () => {
  it('uses the competition colours for the table header, like the results sheets', () => {
    const d = event(1);
    d.competition = { ...d.competition, primaryColor: '#c8102e' };
    const json = JSON.stringify(skatingOrderPages([d]));
    expect(json).toContain('#c8102e');
  });
});

describe('skatingOrderDocument', () => {
  it('says so when there is nothing to print', () => {
    expect(texts(skatingOrderDocument([event(2)], new Set()).content)).toContain('Nothing to print.');
  });
});

describe('a part with its own order', () => {
  it('lists the free dance in its own order, keeping the start numbers, while the dances follow the start order', () => {
    const d = { ...event(2), partOrders: new Map([['fd', [3, 1, 0, 2]]]) };
    const [dance1, , free] = skatingOrderPages([d]);
    expect(names(dance1)).toEqual(['Amy', 'Beth', 'Cat', 'Dee']);
    expect(names(free)).toEqual(['Dee', 'Beth', 'Amy', 'Cat']);
    expect(texts(free)).toEqual(expect.arrayContaining(['4', '2', '1', '3']));
  });
});
