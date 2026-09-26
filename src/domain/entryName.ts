import type { Entry, EntryType, Id, Skater } from './types';

/** What an event's entries are called in tab titles and column headings. */
export const entryHeading: Record<EntryType, string> = {
  solo: 'Skater',
  duo: 'Skaters',
  team: 'Team',
};

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
