import { describe, expect, it } from 'vitest';
import type { Competition, EntryType } from '../domain/types';
import { calculateEvent } from '../scoring';
import type { EventData } from './loadEvent';
import { pdfBlob } from './pdfmake';
import { defaultWelcome, entryCount, programmeDocument } from './programme';

const competition: Competition = {
  id: 'c',
  name: 'Autumn Open',
  date: '2026-10-17',
  venue: 'Bristol Sports Centre',
  createdAt: 0,
  updatedAt: 0,
};

function event(id: string, name: string, entryType: EntryType, skaters: string[]): EventData {
  const segments = [
    { id: 'cd:w', name: 'Glide Waltz', kind: 'compulsory' as const, markKeys: ['cd:w' as const] },
    { id: 'fd', name: 'Free Dance', kind: 'free' as const, markKeys: ['fd:A' as const, 'fd:B' as const] },
  ];
  const rows = skaters.map((s, i) => ({ id: `${id}${i}`, name: s, club: 'Bristol RSC', members: '' }));
  const judges = [{ id: 'j1', competitionId: 'c', name: 'Helen Judge' }];
  const mark = () => 50;
  return {
    competition,
    event: {
      id,
      competitionId: 'c',
      name,
      order: 0,
      entryType,
      compulsoryDanceIds: ['w'],
      hasFreeDance: true,
      judgeIds: ['j1'],
      refereeId: 'r',
      status: 'final',
    },
    segments,
    rows,
    judges,
    referee: { id: 'r', competitionId: 'c', name: 'Kate Referee' },
    mark,
    result: calculateEvent({ entryIds: rows.map((r) => r.id), judgeIds: ['j1'], segments, mark }),
  };
}

const events = [
  event('e1', 'Novice Solo', 'solo', ['Zoe', 'Amy', 'Mia']),
  event('e2', 'Junior Couples', 'duo', ['Ann & Bob']),
];

/** All text in a pdfmake content tree, flattened (excluding the cover's SVG). */
function texts(node: unknown): string[] {
  if (typeof node === 'string') return node.startsWith('<svg') ? [] : [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object') return Object.values(node).flatMap(texts);
  return [];
}

describe('programmeDocument', () => {
  it('has the cover, the welcome with its list of events, then each event in skating order with its dances', () => {
    const t = texts(programmeDocument(competition, events).content);
    expect(t).toEqual(
      expect.arrayContaining(['PROGRAMME', 'Autumn Open', 'Bristol Sports Centre', 'Welcome', 'Events']),
    );
    expect(t).toContain(defaultWelcome(competition).split('\n\n')[0]);
    expect(t).toEqual(expect.arrayContaining(['3 skaters', '1 duo', 'Glide Waltz · Free Dance']));
    // Skaters in start order, not alphabetical.
    const order = ['Novice Solo', 'Zoe', 'Amy', 'Mia', 'Junior Couples', 'Ann & Bob'];
    const at = order.map((s) => t.lastIndexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('never names the judges or referee, or shows marks or places', () => {
    const t = texts(programmeDocument(competition, events).content).join('\n');
    expect(t).not.toMatch(/Judge|Referee|Place|Points|5\.0/);
  });

  it('uses the competition’s own welcome, a paragraph per blank-line-separated block', () => {
    const t = texts(
      programmeDocument({ ...competition, welcome: 'Hello all!\n\nEnjoy the day.' }, events).content,
    );
    expect(t).toEqual(expect.arrayContaining(['Hello all!', 'Enjoy the day.']));
    expect(t).not.toContain(defaultWelcome(competition).split('\n\n')[0]);
  });

  it('says so when there are no events yet', () => {
    expect(texts(programmeDocument(competition, []).content)).toContain(
      'The events will be announced on the day.',
    );
  });

  it('renders to a PDF', async () => {
    const blob = await pdfBlob(programmeDocument({ ...competition, secondaryColor: '#ffffff' }, events));
    expect(blob.size).toBeGreaterThan(1000);
  }, 30_000);
});

describe('entryCount', () => {
  it('counts entries by type', () => {
    expect(entryCount('solo', 1)).toBe('1 skater');
    expect(entryCount('duo', 2)).toBe('2 duos');
    expect(entryCount('team', 3)).toBe('3 teams');
  });
});
