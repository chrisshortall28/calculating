import { skatersPerEntry } from './entryName';
import type { EntryType } from './types';

/** One line of a pasted list: skater names (one or two) or a team name, plus an optional club. */
export interface PastedRow {
  names: string[];
  teamName: string;
  club: string;
  /** Why the line can't be used, if it can't. */
  error?: string;
}

/** What a column of a pasted spreadsheet holds. */
export type PasteColumn =
  'name' | 'first' | 'surname' | 'partner' | 'partnerFirst' | 'partnerSurname' | 'club' | 'ignore';

/** A pasted spreadsheet: tab-separated columns, with a header row or not. */
export interface PasteTable {
  /** The header row's cells, when the first row is one (it is not an entry). */
  header?: string[];
  /** What each column holds: read from the header, or the usual guess for a list with no header. */
  columns: PasteColumn[];
  /** The first value found in each column (for showing what it holds). */
  sample: string[];
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Duo and pairs partners may be written "A & B", "A / B", "A + B" or "A and B". */
const PARTNER_SPLIT = /\s*[&/+]\s*|\s+and\s+/i;

const START_NUMBER = /^\s*\d+\s*[.)]\s+/;

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const FIRST = [
  'first name',
  'firstname',
  'first',
  'forename',
  'forenames',
  'given name',
  'given names',
  'given',
];
const SURNAME = ['surname', 'last name', 'lastname', 'last', 'family name', 'family'];
const NAME = ['name', 'full name', 'skater', 'skater name', 'skaters', 'athlete', 'entry', 'competitor'];
const CLUB = ['club', 'club name', 'clubs', 'organisation', 'organization', 'affiliation'];

/** The role a header cell names, or `ignore` (an Age column, say). */
export function headerRole(cell: string, type: EntryType): PasteColumn {
  let h = squash(cell);
  const partner = /\bpartner\b|\bskater 2\b|\bskater two\b/.test(h);
  h = h
    .replace(/\bpartners?\b|\bskater 2\b|\bskater two\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (partner && h === '') return 'partner';
  if (FIRST.includes(h)) return partner ? 'partnerFirst' : 'first';
  if (SURNAME.includes(h)) return partner ? 'partnerSurname' : 'surname';
  if (partner && (h === 'name' || NAME.includes(h))) return 'partner';
  if (NAME.includes(h)) return 'name';
  // "Team" is the entry in a list of teams, but the club in a list of skaters.
  if (h === 'team' || h === 'team name') return type === 'team' ? 'name' : 'club';
  if (CLUB.includes(h)) return 'club';
  return 'ignore';
}

/** Splits a paste into start-number-free lines of cells; undefined when it has no tab-separated columns. */
function readTable(text: string, type: EntryType): { cells: string[][]; table: PasteTable } | undefined {
  if (!text.includes('\t')) return undefined;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  // A line without tabs among tabbed ones is "Name, Club" (the club may itself contain commas).
  const split = (line: string) => {
    if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
    const [who = '', ...rest] = line.split(',');
    return rest.length ? [who.trim(), rest.join(',').trim()] : [who.trim()];
  };
  const first = lines[0] ? split(lines[0]) : [];
  const roles = first.map((c) => headerRole(c, type));
  // A header row names at least one column we know; an ordinary line of names and clubs names none.
  const hasHeader = roles.some((r) => r !== 'ignore');
  const body = (hasHeader ? lines.slice(1) : lines).map((l) => split(l.replace(START_NUMBER, '')));
  const width = Math.max(first.length, ...body.map((r) => r.length), 0);

  let columns: PasteColumn[];
  if (hasHeader) {
    columns = Array.from({ length: width }, (_, i) => roles[i] ?? 'ignore');
  } else {
    // No header: the first column is the name and the first other column with anything in it the club.
    const clubAt = Array.from({ length: width }, (_, i) => i).find(
      (i) => i > 0 && body.some((r) => (r[i] ?? '') !== ''),
    );
    columns = Array.from({ length: width }, (_, i) => (i === 0 ? 'name' : i === clubAt ? 'club' : 'ignore'));
  }
  const sample = Array.from({ length: width }, (_, i) => body.find((r) => (r[i] ?? '') !== '')?.[i] ?? '');
  return { cells: body, table: { ...(hasHeader ? { header: first } : {}), columns, sample } };
}

/** The columns of a pasted spreadsheet and what they seem to hold; undefined for a plain list. */
export function analysePaste(text: string, type: EntryType): PasteTable | undefined {
  return readTable(text, type)?.table;
}

/** The cells whose column holds one of the roles, joined: first names before surnames whatever the column order. */
const join = (cells: string[], columns: PasteColumn[], roles: PasteColumn[]) =>
  tidy(roles.flatMap((role) => cells.filter((_, i) => columns[i] === role)).join(' '));

/**
 * Parses one entry per line: `Name, Club` (club optional). Spreadsheet columns pasted with tabs work
 * too: a header row names them (First Name, Surname, Club… with anything else, like Age, ignored), and
 * `columns` overrides what each one holds. Leading start numbers like "1." or "2)" are ignored. Blank
 * lines are skipped.
 */
export function parsePastedList(text: string, type: EntryType, columns?: PasteColumn[]): PastedRow[] {
  const table = readTable(text, type);
  const rows: PastedRow[] = [];
  const add = (name: string, partner: string, club: string) => {
    if (type === 'team') {
      rows.push({ names: [], teamName: name, club, error: name ? undefined : 'Team name missing' });
    } else if (skatersPerEntry(type) === 2) {
      const names = partner
        ? [name, partner].filter(Boolean)
        : name.split(PARTNER_SPLIT).map(tidy).filter(Boolean);
      rows.push({
        names,
        teamName: '',
        club,
        error: names.length === 2 ? undefined : 'Needs two skaters, e.g. "Ann Lee & Bob Ray, Club"',
      });
    } else {
      rows.push({ names: [name], teamName: '', club, error: name ? undefined : 'Skater name missing' });
    }
  };

  if (table) {
    // With no header and no choice made, a line is a name and then, after any empty cells, a club.
    const roles = columns ?? (table.table.header ? table.table.columns : undefined);
    for (const cells of table.cells) {
      if (!roles) {
        add(tidy(cells[0] ?? ''), '', tidy(cells.slice(1).find(Boolean) ?? ''));
        continue;
      }
      add(
        join(cells, roles, ['first', 'name', 'surname']),
        join(cells, roles, ['partnerFirst', 'partner', 'partnerSurname']),
        tidy(cells.find((c, i) => roles[i] === 'club' && c) ?? ''),
      );
    }
    return rows;
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(START_NUMBER, '');
    if (!line.trim()) continue;
    const [who = '', ...rest] = line.split(',');
    add(tidy(who), '', tidy(rest.join(',')));
  }
  return rows;
}
