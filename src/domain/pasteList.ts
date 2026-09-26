import type { EntryType } from './types';

/** One line of a pasted list: skater names (solo/duo) or a team name, plus an optional club. */
export interface PastedRow {
  names: string[];
  teamName: string;
  club: string;
  /** Why the line can't be used, if it can't. */
  error?: string;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Duo partners may be written "A & B", "A / B", "A + B" or "A and B". */
const PARTNER_SPLIT = /\s*[&/+]\s*|\s+and\s+/i;

/**
 * Parses one entry per line: `Name, Club` (club optional). Tab-separated columns — as pasted from a
 * spreadsheet — work too, and leading start numbers like "1." or "2)" are ignored. Blank lines are skipped.
 */
export function parsePastedList(text: string, type: EntryType): PastedRow[] {
  const rows: PastedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*\d+\s*[.)]\s+/, '');
    if (!line.trim()) continue;
    const [who = '', ...rest] = line.includes('\t') ? line.split('\t') : line.split(',');
    const club = tidy(line.includes('\t') ? (rest.find((c) => c.trim()) ?? '') : rest.join(','));
    const name = tidy(who);

    if (type === 'team') {
      rows.push({ names: [], teamName: name, club, error: name ? undefined : 'Team name missing' });
    } else if (type === 'duo') {
      const names = name.split(PARTNER_SPLIT).map(tidy).filter(Boolean);
      rows.push({
        names,
        teamName: '',
        club,
        error: names.length === 2 ? undefined : 'Needs two skaters, e.g. "Ann Lee & Bob Ray, Club"',
      });
    } else {
      rows.push({ names: [name], teamName: '', club, error: name ? undefined : 'Skater name missing' });
    }
  }
  return rows;
}
