import { describe, expect, it } from 'vitest';
import type { Skater } from '../../domain/types';
import type { EventData } from '../../pdf/loadEvent';
import type { OverallRow, PlacementRule } from '../../scoring';
import { computeCompetitionStats } from './computeStats';

const skaters: Skater[] = [
  { id: 's1', competitionId: 'c', name: 'Amy', club: 'Alpha' },
  { id: 's2', competitionId: 'c', name: 'Beth', club: 'Beta' },
  { id: 's3', competitionId: 'c', name: 'Cat', club: 'Gamma' },
];

const place = (
  entryId: string,
  p: number,
  majorityVictories: number,
  rule: PlacementRule = '5',
): OverallRow => ({
  entryId,
  place: p,
  tied: false,
  rule,
  majorityVictories,
  totalVictories: 0,
  totalSum: 0,
  judgeSums: [],
  judgeRanks: [],
});

/** rows: [entryId, skaterIds, club override] */
function event(id: string, rows: [string, string[], string?][], overall: OverallRow[]): EventData {
  return {
    event: { id, name: `Event ${id}` },
    rows: rows.map(([rid, skaterIds, club]) => ({
      id: rid,
      name: rid,
      club: club ?? skaters.find((s) => s.id === skaterIds[0])!.club,
      members: '',
      skaterIds,
    })),
    result: { overall },
  } as unknown as EventData;
}

describe('computeCompetitionStats', () => {
  it('leaves out events that are not completely marked', () => {
    const done = event(
      '1',
      [
        ['a', ['s1']],
        ['b', ['s2']],
      ],
      [place('a', 1, 1), place('b', 2, 0)],
    );
    const open = event('2', [['c', ['s3']]], []);
    const stats = computeCompetitionStats([done, open], skaters);
    expect(stats.eventsCounted).toBe(1);
    expect(stats.eventsTotal).toBe(2);
    expect(stats.entries).toBe(2);
    expect(stats.clubs).toBe(2);
  });

  it('counts medals per club, sorted gold first, and gives sharers of a place its medal', () => {
    const e1 = event(
      '1',
      [
        ['a', ['s1']],
        ['b', ['s2']],
        ['c', ['s3']],
      ],
      [place('a', 1, 2), place('b', 2, 1), place('c', 3, 0)],
    );
    const e2 = event(
      '2',
      [
        ['a', ['s1']],
        ['b', ['s2']],
        ['c', ['s3']],
      ],
      [place('b', 1, 2), { ...place('a', 2, 1, '8'), tied: true }, { ...place('c', 2, 1, '8'), tied: true }],
    );
    const { medals } = computeCompetitionStats([e1, e2], skaters);
    expect(medals).toEqual([
      { club: 'Alpha', gold: 1, silver: 1, bronze: 0 },
      { club: 'Beta', gold: 1, silver: 1, bronze: 0 },
      { club: 'Gamma', gold: 0, silver: 1, bronze: 1 },
    ]);
  });

  it('uses an entry’s own club over its skaters’ clubs', () => {
    const e = event('1', [['a', ['s1'], 'Team Club']], [place('a', 1, 0)]);
    const stats = computeCompetitionStats([e], skaters);
    expect(stats.medals[0]!.club).toBe('Team Club');
    expect(stats.clubRows).toEqual([{ club: 'Team Club', entries: 1, skaters: 1 }]);
  });

  it('ranks the busiest skaters with their best place', () => {
    const e1 = event(
      '1',
      [
        ['a', ['s1']],
        ['b', ['s2']],
      ],
      [place('a', 1, 1), place('b', 2, 0)],
    );
    const e2 = event('2', [['a', ['s1', 's2']]], [place('a', 3, 0)]);
    const { busiest, skaters: n } = computeCompetitionStats([e1, e2], skaters);
    expect(n).toBe(2);
    expect(busiest.map((b) => [b.name, b.events, b.bestPlace])).toEqual([
      ['Amy', 2, 1],
      ['Beth', 2, 2],
    ]);
  });

  it('lists winning margins widest first and skips shared firsts', () => {
    const wide = event(
      '1',
      [
        ['a', ['s1']],
        ['b', ['s2']],
      ],
      [place('a', 1, 5), place('b', 2, 1)],
    );
    const close = event(
      '2',
      [
        ['a', ['s1']],
        ['b', ['s2']],
      ],
      [place('a', 1, 2.5, '6B'), place('b', 2, 2.5)],
    );
    const shared = event(
      '3',
      [
        ['a', ['s1']],
        ['b', ['s2']],
      ],
      [
        { ...place('a', 1, 2, '8'), tied: true },
        { ...place('b', 1, 2, '8'), tied: true },
      ],
    );
    const { margins } = computeCompetitionStats([close, wide, shared], skaters);
    expect(margins.map((m) => [m.eventName, m.margin, m.rule])).toEqual([
      ['Event 1', 4, '5'],
      ['Event 2', 0, '6B'],
    ]);
  });
});
