import { describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { calculateEvent } from '../scoring';
import { resultsPages } from './documents';
import type { EventData } from './loadEvent';

function sampleEvent(): EventData {
  const segments = [
    { id: 'cd:w', name: 'Waltz', kind: 'compulsory' as const, markKeys: ['cd:w' as SegmentKey] },
  ];
  const rows = ['Amy', 'Beth'].map((name, i) => ({ id: `e${i}`, name, club: 'Club', members: '' }));
  const judges = ['Helen', 'Ian', 'Jo'].map((name, i) => ({ id: `j${i}`, competitionId: 'c', name }));
  const mark = (_k: SegmentKey, _j: string, e: string) => (e === 'e0' ? 50 : 40);
  return {
    competition: { id: 'c', name: 'Comp', date: '', venue: '', createdAt: 0, updatedAt: 0 },
    event: {
      id: 'ev',
      competitionId: 'c',
      name: 'Event',
      order: 0,
      entryType: 'solo',
      compulsoryDanceIds: ['w'],
      hasFreeDance: false,
      judgeIds: judges.map((j) => j.id),
      refereeId: 'r',
      status: 'final',
    },
    segments,
    rows,
    judges,
    referee: { id: 'r', competitionId: 'c', name: 'Kate' },
    mark,
    result: calculateEvent({ entryIds: ['e0', 'e1'], judgeIds: judges.map((j) => j.id), segments, mark }),
  };
}

/** All text in a pdfmake content tree, flattened. */
function texts(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object') return Object.values(node).flatMap(texts);
  return [];
}

describe('resultsPages', () => {
  it('standard results include major victories, points and judge rankings', () => {
    const t = texts(resultsPages([sampleEvent()], 'standard'));
    expect(t).toEqual(
      expect.arrayContaining(['Major victories', 'Total points', 'J1', 'Referee', 'Kate', '15.0']),
    );
  });

  it('guest-judge results show placings and officials only', () => {
    const t = texts(resultsPages([sampleEvent()], 'guest'));
    expect(t).toEqual(expect.arrayContaining(['Place', 'Entry', 'Club', 'Amy', 'Judges', 'Referee', 'Kate']));
    expect(t).not.toContain('Major victories');
    expect(t).not.toContain('Total points');
    expect(t).not.toContain('J1');
    expect(t).not.toContain('15.0'); // Amy's total points (3 judges × 5.0)
  });
});
