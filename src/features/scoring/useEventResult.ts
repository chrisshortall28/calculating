import { useMemo } from 'react';
import { useDances, useEntries, useMarks } from '../../app/data';
import { eventSegments, eventTieBreakMarks } from '../../domain/segments';
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
      tieBreakMarks: eventTieBreakMarks(event),
    };
    const result = calculateEvent(input);
    // Each part scored on its own (for display only: CIPA places the whole event, not each part).
    const segmentResults = segments.map((seg) => calculateEvent({ ...input, segments: [seg] }));
    return {
      loading: !dances || !entries || !marks,
      segments,
      entries: entries ?? [],
      markMap,
      result,
      segmentResults,
    };
  }, [event, dances, entries, marks]);
}
