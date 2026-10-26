import { danceFreeFactor, eventSegments, eventTieBreakMarks } from '../domain/segments';
import type { Dance } from '../domain/types';
import type { CompetitionFile } from '../io/competitionFile';
import { matchLegacyDance } from './dances';
import { DANCE_PROFILES, type DanceKind } from './profiles';
import { phaseTails } from './tail';
import type { LegacyWarning } from './types';
import { MAX_CLUB, MAX_DANCES, MAX_JUDGES, MAX_NAME, writeDanceEvent, type WriteEntry } from './write';

type FileEvent = CompetitionFile['events'][number];

export interface LegacyExportFile {
  /** `DATAnnnB.ROL`: the events are numbered in order. */
  name: string;
  data: Uint8Array;
  event: string;
}

export interface LegacyExport {
  files: LegacyExportFile[];
  /** Events that can not be exported, and why. */
  skipped: { event: string; reason: string }[];
  warnings: LegacyWarning[];
}

/** The most entries an event is exported with (the application's own limit is not known). */
export const MAX_ENTRIES = 40;

const ORDINAL = (day: number) =>
  `${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'}`;

/** "2026-08-09" as "9th August 2026", as the application's date field is free text. */
export function legacyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = new Date(Date.UTC(2000, Number(m[2]) - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${ORDINAL(Number(m[3]))} ${month} ${m[1]}`;
}

/**
 * Converts a Podium competition's events to Calculating For Windows event files. Supported: dance
 * events with compulsory dances only or a free dance only. The rest are reported in `skipped`.
 */
export function exportLegacyEvents(file: CompetitionFile): LegacyExport {
  const result: LegacyExport = { files: [], skipped: [], warnings: [] };
  const judgeName = new Map(file.judges.map((j) => [j.id, j.name]));
  const skaterOf = new Map(file.skaters.map((s) => [s.id, s]));
  const danceOf = new Map<string, Dance>(file.dances.map((d) => [d.id, d]));
  const marks = new Map(
    file.marks.map((m) => [`${m.eventId}|${m.segmentKey}|${m.judgeId}|${m.entryId}`, m.tenths]),
  );
  const events = [...file.events].sort((a, b) => a.order - b.order);

  // What was changed to fit the application is summarised at the end, not listed one by one.
  const shortened = new Map<ShortenedKind, Map<string, string>>();
  const unnamedDances = new Map<string, Set<string>>(); // dance name -> events it is in
  const nearDances = new Map<string, string>(); // name typed -> the application's dance
  const unmarked = new Map<string, number>(); // event -> marks not entered yet

  for (const event of events) {
    const skip = (reason: string) => result.skipped.push({ event: event.name, reason });
    const unsupported = unsupportedReason(event);
    if (unsupported) {
      skip(unsupported);
      continue;
    }
    const entries = file.entries
      .filter((e) => e.eventId === event.id)
      .sort((a, b) => a.startOrder - b.startOrder);
    if (entries.length === 0) {
      skip('it has no entries yet.');
      continue;
    }
    if (entries.length > MAX_ENTRIES) {
      skip(`it has more than ${MAX_ENTRIES} entries.`);
      continue;
    }
    if (event.judgeIds.length === 0 || event.judgeIds.length > MAX_JUDGES) {
      skip(event.judgeIds.length === 0 ? 'it has no judges yet.' : `it has more than ${MAX_JUDGES} judges.`);
      continue;
    }

    const kind: DanceKind = !event.hasFreeDance
      ? 'compulsory'
      : event.compulsoryDanceIds.length > 0
        ? 'combined'
        : 'free';
    const truncate = (value: string, kind: ShortenedKind) => {
      const cut = value.slice(0, SHORTENED[kind].length);
      if (cut !== value) {
        if (!shortened.has(kind)) shortened.set(kind, new Map());
        shortened.get(kind)!.set(value, cut);
      }
      return cut;
    };

    // Podium takes any dance name; the application only has its own list. A name that is a slip away
    // from one of them gets that dance, anything else the application's unnamed "Dance No n".
    const dances = event.compulsoryDanceIds.map((id) => {
      const name = danceOf.get(id)?.name ?? '';
      const match = matchLegacyDance(name);
      if (!match) {
        if (!unnamedDances.has(name)) unnamedDances.set(name, new Set());
        unnamedDances.get(name)!.add(event.name);
        return 0;
      }
      if (!match.exact) nearDances.set(name, match.name);
      return match.code;
    });

    // Block k of an entry: compulsory dance k, or (free dance) A in block 6 and B in block 7.
    const blockKeys = [
      ...event.compulsoryDanceIds.map((id, k) => [`cd:${id}` as const, k] as const),
      ...(event.hasFreeDance ? (['fd:A', 'fd:B'] as const).map((key, i) => [key, 6 + i] as const) : []),
    ];
    let missing = 0;
    const exported: WriteEntry[] = entries.map((entry) => {
      const skaters = entry.skaterIds.map((id) => skaterOf.get(id)).filter((s) => s !== undefined);
      const name =
        entry.teamName ?? (skaters.length > 0 ? skaters.map((s) => s.name).join(' / ') : '(no skaters)');
      const club = entry.club ?? skaters[0]?.club ?? '';
      const blocks: WriteEntry['blocks'] = Array<number[] | null>(8).fill(null);
      for (const [key, k] of blockKeys) {
        blocks[k] = event.judgeIds.map((judgeId) => {
          const tenths = marks.get(`${event.id}|${key}|${judgeId}|${entry.id}`);
          if (tenths === undefined) missing++;
          return tenths ?? 0;
        });
      }
      return {
        name: truncate(name, 'name'),
        club: truncate(club, 'club'),
        blocks,
      };
    });
    if (missing > 0) unmarked.set(event.name, missing);

    const entryIds = entries.map((e) => e.id);
    const bTotals = entryIds.map((id) =>
      event.hasFreeDance
        ? event.judgeIds.reduce((a, j) => a + (marks.get(`${event.id}|fd:B|${j}|${id}`) ?? 0), 0)
        : 0,
    );

    result.files.push({
      name: `DATA${String(result.files.length + 1).padStart(3, '0')}B.ROL`,
      event: event.name,
      data: writeDanceEvent({
        competition: truncate(file.competition.name, 'competition'),
        venue: truncate(file.competition.venue, 'venue'),
        date: legacyDate(file.competition.date),
        name: truncate(event.name, 'event'),
        judges: event.judgeIds.map((id) => truncate(judgeName.get(id) ?? 'Judge', 'judge')),
        referee: event.refereeId ? truncate(judgeName.get(event.refereeId) ?? '', 'judge') : '',
        kind,
        dances,
        entries: exported,
        freeFactor: legacyFactor(danceFreeFactor(event.compulsoryDanceIds.length)),
        tails: phaseTails(
          DANCE_PROFILES[kind].phases,
          {
            entryIds,
            judgeIds: event.judgeIds,
            segments: eventSegments(event, file.dances),
            mark: (key, judgeId, entryId) => marks.get(`${event.id}|${key}|${judgeId}|${entryId}`) ?? 0,
            tieBreakMarks: eventTieBreakMarks(event),
          },
          bTotals,
        ),
      }),
    });
  }
  result.warnings.push(...summarise(shortened, unnamedDances, nearDances, unmarked));
  return result;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A factor in hundredths as the application's fraction: 50 is 1/2, 100 is 1/1, 150 is 3/2. */
export function legacyFactor(hundredths: number): [numerator: number, denominator: number] {
  const divisor = gcd(hundredths, 100);
  return [hundredths / divisor, 100 / divisor];
}

/** What a name was shortened to fit: its kind's wording and the application's limit. */
const SHORTENED = {
  club: { one: 'club name', many: 'club names', length: MAX_CLUB },
  name: { one: 'skater or team name', many: 'skater or team names', length: MAX_NAME },
  event: { one: 'event name', many: 'event names', length: MAX_NAME },
  judge: { one: 'judge or referee name', many: 'judge or referee names', length: MAX_NAME },
  competition: { one: 'competition name', many: 'competition names', length: MAX_NAME },
  venue: { one: 'venue name', many: 'venue names', length: MAX_NAME },
} as const;
type ShortenedKind = keyof typeof SHORTENED;

const quoted = (items: string[], most = 4) =>
  items.length <= most
    ? items.join(', ')
    : `${items.slice(0, most).join(', ')} and ${items.length - most} more`;

function summarise(
  shortened: Map<ShortenedKind, Map<string, string>>,
  unnamedDances: Map<string, Set<string>>,
  nearDances: Map<string, string>,
  unmarked: Map<string, number>,
): LegacyWarning[] {
  const warnings: LegacyWarning[] = [];
  const add = (message: string, level: LegacyWarning['level'] = 'warning') =>
    warnings.push({ level, message });
  for (const kind of Object.keys(SHORTENED) as ShortenedKind[]) {
    const names = shortened.get(kind);
    if (!names) continue;
    const { one, many, length } = SHORTENED[kind];
    const [from, to] = [...names][0]!;
    add(
      `${names.size} ${names.size === 1 ? one : many} ${names.size === 1 ? 'was' : 'were'} shortened to fit the application’s ${length}-character limit (for example “${from}” became “${to}”).`,
    );
  }
  if (unnamedDances.size > 0) {
    const n = unnamedDances.size;
    const list = [...unnamedDances].map(([name, inEvents]) =>
      inEvents.size === 1 ? `“${name}”` : `“${name}” (${inEvents.size} events)`,
    );
    add(
      `${n} ${n === 1 ? 'dance is' : 'dances are'} not in the application’s list, so ${n === 1 ? 'it was' : 'they were'} exported as its unnamed “Dance No n” (the name is not kept): ${quoted(list)}.`,
    );
  }
  if (nearDances.size > 0) {
    const n = nearDances.size;
    add(
      `${n} dance ${n === 1 ? 'name was' : 'names were'} matched to the nearest dance in the application: ${quoted([...nearDances].map(([typed, name]) => `“${typed}” as “${name}”`))}.`,
      'info',
    );
  }
  if (unmarked.size > 0) {
    const total = [...unmarked.values()].reduce((a, n) => a + n, 0);
    add(
      `${total} mark${total === 1 ? '' : 's'} not entered yet ${total === 1 ? 'was' : 'were'} exported as 0.0, in ${unmarked.size === 1 ? 'event' : 'events'} ${quoted([...unmarked.keys()].map((name) => `“${name}”`))}; enter ${total === 1 ? 'it' : 'them'} in the application.`,
    );
  }
  return warnings;
}

function unsupportedReason(event: FileEvent): string | undefined {
  if (event.discipline === 'figures') return 'figures events can not be exported yet.';
  if (event.compulsoryDanceIds.length > MAX_DANCES) {
    return `it has more than ${MAX_DANCES} compulsory dances.`;
  }
  if (!event.hasFreeDance && event.compulsoryDanceIds.length === 0) return 'it has no dances.';
  return undefined;
}
