import type { SegmentKey } from '../domain/types';
import { danceEventDefaults } from '../domain/segments';
import { calculateEvent } from '../scoring';
import type { EventData } from './loadEvent';

/** A small finished event (two skaters, one dance, three judges) for the PDF tests. */
export function sampleEvent(): EventData {
  const segments = [
    { id: 'cd:w', name: 'Waltz', kind: 'compulsory' as const, markKeys: ['cd:w' as SegmentKey] },
  ];
  const rows = ['Amy', 'Beth'].map((name, i) => ({
    id: `e${i}`,
    name,
    club: 'Club',
    members: '',
    skaterIds: [],
  }));
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
      ...danceEventDefaults(),
      judgeIds: judges.map((j) => j.id),
      refereeId: 'r',
      status: 'final',
    },
    number: '1',
    segments,
    firstSkaters: new Map<string, number>(),
    rows,
    judges,
    referee: { id: 'r', competitionId: 'c', name: 'Kate' },
    mark,
    result: calculateEvent({
      entryIds: ['e0', 'e1'],
      judgeIds: judges.map((j) => j.id),
      segments,
      mark,
      tieBreakMarks: [],
    }),
  };
}
