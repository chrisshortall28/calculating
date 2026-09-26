import { useMemo } from 'react';
import { useDances, useEntries, useMarks } from '../../app/data';
import { eventSegments } from '../../domain/segments';
import { indexMarks, markKey } from '../../domain/markIndex';
import type { CompEvent, SegmentKey } from '../../domain/types';
import { calculateEvent } from '../../scoring';

export { markKey };

/** Loads everything needed to score an event and runs the scoring engine. */
export function useEventResult(event: CompEvent) {
  const dances = useDances(event.competitionId);
  const entries = useEntries(event.id);
  const marks = useMarks(event.id);

  return useMemo(() => {
    const segments = eventSegments(event, dances ?? []);
    const markMap = indexMarks(marks);
    const entryIds = (entries ?? []).map((e) => e.id);
    const input = {
      entryIds,
      judgeIds: event.judgeIds,
      segments,
      mark: (k: SegmentKey, j: string, e: string) => markMap.get(markKey(k, j, e)),
    };
    const result = calculateEvent(input);
    // Until every dance is in: the standing from the dances completed so far.
    const done = segments.filter((_, i) => result.segments[i]!.complete);
    const standing =
      !result.complete && done.length > 0 ? calculateEvent({ ...input, segments: done }) : undefined;
    return {
      loading: !dances || !entries || !marks,
      segments,
      entries: entries ?? [],
      markMap,
      result,
      standing,
      standingAfter: done.map((s) => s.name),
    };
  }, [event, dances, entries, marks]);
}
