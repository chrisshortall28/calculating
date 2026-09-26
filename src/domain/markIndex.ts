import type { Id, Mark, SegmentKey } from './types';

export const markKey = (segmentKey: SegmentKey, judgeId: Id, entryId: Id) =>
  `${segmentKey}|${judgeId}|${entryId}`;

/** Marks keyed by `markKey`, value in tenths. */
export function indexMarks(marks: Mark[] | undefined) {
  return new Map((marks ?? []).map((m) => [markKey(m.segmentKey, m.judgeId, m.entryId), m.tenths]));
}
