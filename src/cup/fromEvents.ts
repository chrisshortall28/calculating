import type { CombinedCupConfig } from '../domain/types';
import type { EventData } from '../pdf/loadEvent';
import type { CupEventInput } from './combinedCup';

/** The Cup's tagged events, with each entry's skaters and (once the event is complete) its place. */
export function cupEventsFromData(cup: CombinedCupConfig, events: EventData[]): CupEventInput[] {
  return events.flatMap((d) => {
    const role = cup.eventRoles[d.event.id];
    if (!role) return [];
    const placeOf = new Map(d.result.overall.map((o) => [o.entryId, o]));
    return [
      {
        eventId: d.event.id,
        name: d.event.name,
        role,
        complete: d.result.complete,
        entries: d.rows.map((r) => ({
          skaterIds: r.skaterIds,
          place: placeOf.get(r.id)?.place,
          tied: placeOf.get(r.id)?.tied,
        })),
      },
    ];
  });
}
