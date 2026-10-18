import type { Id, Skater } from '../../domain/types';
import type { PlacementRule } from '../../scoring';
import type { EventData } from '../../pdf/loadEvent';

export const NO_CLUB = 'No club';

export interface MedalRow {
  club: string;
  gold: number;
  silver: number;
  bronze: number;
}

export interface ClubRow {
  club: string;
  entries: number;
  skaters: number;
}

export interface BusySkater {
  id: Id;
  name: string;
  club: string;
  events: number;
  /** Best place in any counted event. */
  bestPlace: number;
}

export interface WinningMargin {
  eventId: Id;
  eventName: string;
  winner: string;
  /** Majority victories ahead of second place (halves possible). */
  margin: number;
  /** The rule that decided first place; `5` when there was no tie to break. */
  rule: PlacementRule;
}

export interface CompetitionStats {
  eventsCounted: number;
  eventsTotal: number;
  entries: number;
  skaters: number;
  clubs: number;
  medals: MedalRow[];
  clubRows: ClubRow[];
  busiest: BusySkater[];
  /** Counted events with a single winner, widest margin first. */
  margins: WinningMargin[];
}

/**
 * Club and skater statistics over the events that are completely marked (an event with marks missing
 * has no placings and is left out). A place shared under rule 8 gives every sharer that place's medal.
 */
export function computeCompetitionStats(events: EventData[], skaters: Skater[]): CompetitionStats {
  const counted = events.filter((e) => e.result.overall.length > 0);
  const skaterById = new Map(skaters.map((s) => [s.id, s]));

  const medals = new Map<string, MedalRow>();
  const clubs = new Map<string, { entries: number; skaters: Set<Id> }>();
  const busy = new Map<Id, BusySkater>();
  const allSkaters = new Set<Id>();
  const margins: WinningMargin[] = [];
  let entries = 0;

  for (const data of counted) {
    const rows = new Map(data.rows.map((r) => [r.id, r]));
    for (const row of data.rows) {
      entries++;
      const club = row.club || NO_CLUB;
      const c = clubs.get(club) ?? { entries: 0, skaters: new Set<Id>() };
      c.entries++;
      for (const id of row.skaterIds) {
        c.skaters.add(id);
        allSkaters.add(id);
      }
      clubs.set(club, c);
    }

    for (const place of data.result.overall) {
      const row = rows.get(place.entryId);
      if (!row) continue;
      const club = row.club || NO_CLUB;
      if (place.place <= 3) {
        const m = medals.get(club) ?? { club, gold: 0, silver: 0, bronze: 0 };
        if (place.place === 1) m.gold++;
        else if (place.place === 2) m.silver++;
        else m.bronze++;
        medals.set(club, m);
      }
      for (const id of new Set(row.skaterIds)) {
        const skater = skaterById.get(id);
        const b = busy.get(id) ?? {
          id,
          name: skater?.name ?? '?',
          club: skater?.club || NO_CLUB,
          events: 0,
          bestPlace: Infinity,
        };
        b.events++;
        b.bestPlace = Math.min(b.bestPlace, place.place);
        busy.set(id, b);
      }
    }

    const [first, second] = data.result.overall;
    if (first && second && first.place !== second.place) {
      margins.push({
        eventId: data.event.id,
        eventName: data.event.name,
        winner: rows.get(first.entryId)?.name ?? '?',
        margin: first.majorityVictories - second.majorityVictories,
        rule: first.rule,
      });
    }
  }

  return {
    eventsCounted: counted.length,
    eventsTotal: events.length,
    entries,
    skaters: allSkaters.size,
    clubs: clubs.size,
    medals: [...medals.values()].sort(
      (a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.club.localeCompare(b.club),
    ),
    clubRows: [...clubs.entries()]
      .map(([club, c]) => ({ club, entries: c.entries, skaters: c.skaters.size }))
      .sort((a, b) => b.entries - a.entries || a.club.localeCompare(b.club)),
    busiest: [...busy.values()].sort(
      (a, b) => b.events - a.events || a.bestPlace - b.bestPlace || a.name.localeCompare(b.name),
    ),
    margins: margins.sort((a, b) => b.margin - a.margin),
  };
}
