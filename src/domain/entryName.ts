import type { Entry, EntryType, Id, Skater } from './types';

/** What an event's entries are called in tab titles and column headings. */
export const entryHeading: Record<EntryType, string> = {
  solo: 'Skater',
  duo: 'Skaters',
  couples: 'Skaters',
  team: 'Team',
  single: 'Skater',
  pairs: 'Skaters',
};

/** Singular and plural nouns for an event's entries: "skater"/"skaters", "pair"/"pairs". */
export const entryNoun: Record<EntryType, [string, string]> = {
  solo: ['skater', 'skaters'],
  duo: ['duo', 'duos'],
  couples: ['couple', 'couples'],
  team: ['team', 'teams'],
  single: ['skater', 'skaters'],
  pairs: ['pair', 'pairs'],
};

/** Skaters per entry: 1 (solo, single), 2 (duo, couples, pairs), or undefined for a team (any number). */
export function skatersPerEntry(type: EntryType): 1 | 2 | undefined {
  return type === 'team' ? undefined : type === 'duo' || type === 'couples' || type === 'pairs' ? 2 : 1;
}

export function entryName(entry: Entry, skaters: Map<Id, Skater>): string {
  if (entry.teamName) return entry.teamName;
  const names = entry.skaterIds.map((id) => skaters.get(id)?.name ?? '?');
  return names.length ? names.join(' & ') : '(no skaters)';
}

export function entryClub(entry: Entry, skaters: Map<Id, Skater>): string {
  if (entry.club) return entry.club;
  const clubs = [...new Set(entry.skaterIds.map((id) => skaters.get(id)?.club).filter(Boolean))];
  return clubs.join(' / ');
}

export function entryMembers(entry: Entry, skaters: Map<Id, Skater>): string {
  return entry.skaterIds.map((id) => skaters.get(id)?.name ?? '?').join(', ');
}

export const byId = <T extends { id: Id }>(items: T[] | undefined) =>
  new Map((items ?? []).map((i) => [i.id, i]));
