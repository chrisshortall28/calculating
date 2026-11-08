import { eventTieBreakMarks } from '../domain/segments';
import { scopeLabel, scopeOfSegment, type ResultsScope } from '../domain/resultScopes';
import { calculateEvent } from '../scoring';
import type { EventData } from './loadEvent';

/**
 * The event as scored from one kind of part alone: only the parts of that kind which are fully marked
 * count, and they count at face value (the event's factors weigh the parts against each other, so they
 * have no place when the parts stand alone). Undefined when none of them is fully marked yet. The final
 * scope is the event itself.
 */
export function scopedEventData(d: EventData, scope: ResultsScope): EventData | undefined {
  if (scope === 'final') return d;
  const input = {
    entryIds: d.rows.map((r) => r.id),
    judgeIds: d.event.judgeIds,
    mark: d.mark,
    tieBreakMarks: eventTieBreakMarks(d.event),
  };
  const ofKind = d.segments.filter((s) => scopeOfSegment(s.id) === scope);
  const marked = ofKind.filter((s) => calculateEvent({ ...input, segments: [s] }).complete);
  if (marked.length === 0) return undefined;
  const segments = marked.map((s) => ({ ...s, factor: 100 }));
  return {
    ...d,
    segments,
    result: calculateEvent({ ...input, segments }),
    scope: {
      label: scopeLabel[scope],
      basedOn: marked.map((s) => s.name),
      notMarked: ofKind.filter((s) => !marked.includes(s)).map((s) => s.name),
    },
  };
}
