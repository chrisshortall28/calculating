import type { CompEvent, Dance, Id, SegmentKey } from './types';

/** A scored part of an event: one compulsory dance, or the free dance (A + B marks). */
export interface Segment {
  id: string; // `cd:<danceId>` or `fd`
  kind: 'compulsory' | 'free';
  name: string;
  markKeys: SegmentKey[];
}

export function cdKey(danceId: Id): SegmentKey {
  return `cd:${danceId}`;
}

export function eventSegments(event: CompEvent, dances: Map<Id, Dance> | Dance[]): Segment[] {
  const byId = dances instanceof Map ? dances : new Map(dances.map((d) => [d.id, d]));
  const segments: Segment[] = event.compulsoryDanceIds.map((danceId) => ({
    id: cdKey(danceId),
    kind: 'compulsory',
    name: byId.get(danceId)?.name ?? 'Unknown dance',
    markKeys: [cdKey(danceId)],
  }));
  if (event.hasFreeDance) {
    segments.push({ id: 'fd', kind: 'free', name: 'Free Dance', markKeys: ['fd:A', 'fd:B'] });
  }
  return segments;
}

export function markKeyLabel(key: SegmentKey): string {
  if (key === 'fd:A') return 'A';
  if (key === 'fd:B') return 'B';
  return '';
}
