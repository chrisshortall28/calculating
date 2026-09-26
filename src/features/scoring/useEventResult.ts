import { useMemo } from 'react';
import { useDances, useEntries, useMarks } from '../../app/data';
import { eventSegments } from '../../domain/segments';
import { indexMarks, markKey } from '../../domain/markIndex';
import type { CompEvent } from '../../domain/types';
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
      mark: (k, j, e) => markMap.get(markKey(k, j, e)),
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
