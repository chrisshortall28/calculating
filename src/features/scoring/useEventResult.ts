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
    const result = calculateEvent({
      entryIds,
      judgeIds: event.judgeIds,
      segments,
      mark: (k: SegmentKey, j: string, e: string) => markMap.get(markKey(k, j, e)),
      tieBreakMarks: eventTieBreakMarks(event),
    });
    return {
      loading: !dances || !entries || !marks,
      segments,
      entries: entries ?? [],
      markMap,
      result,
    };
  }, [event, dances, entries, marks]);
}
