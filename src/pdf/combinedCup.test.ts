import { describe, expect, it } from 'vitest';
import { buildCupStandings, type CupEventInput } from '../cup/combinedCup';
import type { CombinedCupConfig, Competition } from '../domain/types';
import { combinedCupDocument } from './combinedCup';

/** All text in a pdfmake content tree, flattened. */
function texts(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object') return Object.values(node).flatMap(texts);
  return [];
}

const competition: Competition = {
  id: 'c',
  name: 'Westmarch Open',
  date: '2026-11-14',
  venue: 'Rink',
  createdAt: 0,
  updatedAt: 0,
};
const skaters = [
  { id: 'a', name: 'Amy Hart', club: 'Club A' },
  { id: 'b', name: 'Beth Cole', club: 'Club B' },
  { id: 'c', name: 'Cara Dunn', club: 'Club C' },
];
const cup: CombinedCupConfig = {
  eventRoles: { s1: 'solo', t1: 'team', t2: 'team' },
  entrants: [
    { skaterId: 'a', category: 'newcomer-novice' },
    { skaterId: 'b', category: 'newcomer-novice' },
    { skaterId: 'c', category: 'inter-bronze-up' },
  ],
  trio: { a: 1 },
};
const events: CupEventInput[] = [
  {
    eventId: 's1',
    name: 'Novice Solo Dance',
    role: 'solo',
    complete: true,
    entries: [
      { skaterIds: ['a'], place: 1 },
      { skaterIds: ['b'], place: 2 },
      { skaterIds: ['c'], place: 1 },
    ],
  },
  {
    eventId: 't1',
    name: 'Mixed Standard Team',
    role: 'team',
    complete: true,
    entries: [{ skaterIds: ['a'], place: 3 }],
  },
  {
    eventId: 't2',
    name: 'Superteam',
    role: 'team',
    complete: true,
    entries: [{ skaterIds: ['a'], place: 1 }],
  },
];

describe('combinedCupDocument', () => {
  const t = texts(combinedCupDocument(competition, buildCupStandings(cup, events), skaters).content);

  it('names the winner of each category and has no overall winner', () => {
    expect(t).toEqual(
      expect.arrayContaining(['Newcomer / Novice', 'Elementary / Prelim', 'Inter-Bronze & above']),
    );
    expect(t).toContain('Winner: Amy Hart');
    expect(t).toContain('Winner: Cara Dunn');
    expect(t.filter((x) => x.startsWith('Winner'))).toHaveLength(2); // none for the empty category
    expect(t.join(' ')).not.toMatch(/overall/i);
  });

  it('shows the events that counted, with places and points, and those that did not', () => {
    expect(t).toContain('1st · 5 pts');
    expect(t).toContain('Superteam');
    expect(t.join(' ')).toContain('Mixed Standard Team: 3rd · 3 pts');
    expect(t).toContain(' (not counted)');
  });

  it('flags provisional results', () => {
    const provisional = texts(
      combinedCupDocument(competition, buildCupStandings(cup, [{ ...events[0]!, complete: false }]), skaters)
        .content,
    );
    expect(provisional).toContain('Provisional: some events are not yet complete.');
  });
});

describe('tie-break notes in the PDF', () => {
  const doc = (places: Record<string, number>, trio: Record<string, number> = { a: 2, b: 4 }) =>
    texts(
      combinedCupDocument(
        competition,
        buildCupStandings(
          {
            eventRoles: { s1: 'solo' },
            entrants: ['a', 'b', 'c'].map((skaterId) => ({ skaterId, category: 'newcomer-novice' as const })),
            trio,
          },
          [
            {
              eventId: 's1',
              name: 'Solo',
              role: 'solo',
              complete: true,
              entries: Object.entries(places).map(([id, place]) => ({ skaterIds: [id], place })),
            },
          ],
        ),
        skaters,
      ).content,
    ).join(' ');

  it('mentions a tie that decides first place', () => {
    // a: solo 3rd (3) + trio 2nd (4) = 7; b: solo 1st (5) + trio 4th (2) = 7; c: 2nd (4)
    expect(doc({ a: 3, b: 1, c: 2 })).toContain('separated by the Mix and Match result');
  });

  it('does not mention a tie for a lower place', () => {
    // c wins with 10 (1st solo, 1st trio); a and b are level on 7 for 2nd
    const text = doc({ a: 3, b: 1, c: 1 }, { a: 2, b: 4, c: 1 });
    expect(text).not.toMatch(/separated by|level on/);
    expect(text).not.toContain('Ties on points');
  });
});
