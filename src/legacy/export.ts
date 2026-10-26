import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import type { Dance } from '../domain/types';
import type { CompetitionFile } from '../io/competitionFile';
import { calculateEvent } from '../scoring';
import { matchLegacyDance } from './dances';
import { tailFromResult } from './tail';
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

  for (const event of events) {
    const note = (message: string, level: LegacyWarning['level'] = 'warning') =>
      result.warnings.push({ level, event: event.name, message });
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

    const kind = event.hasFreeDance ? 'free' : 'compulsory';
    const truncate = (value: string, length: number, what: string) => {
      if (value.length <= length) return value;
      note(
        `${what} “${value}” is longer than the application allows (${length} characters) and was cut short.`,
      );
      return value.slice(0, length);
    };

    // Podium takes any dance name; the application only has its own list. A name that is a slip away
    // from one of them gets that dance, anything else the application's unnamed "Dance No n".
    const dances = event.compulsoryDanceIds.map((id, position) => {
      const name = danceOf.get(id)?.name ?? '';
      const match = matchLegacyDance(name);
      if (!match) {
        note(
          `“${name}” is not one of the application’s dances, so it is exported as its unnamed “Dance No ${position + 1}”; the name is not kept.`,
        );
        return 0;
      }
      if (!match.exact) note(`“${name}” was exported as the application’s “${match.name}”.`, 'info');
      return match.code;
    });

    // Block k of an entry: compulsory dance k, or (free dance) A in block 6 and B in block 7.
    const blockKeys = event.hasFreeDance
      ? (['fd:A', 'fd:B'] as const).map((key, i) => [key, 6 + i] as const)
      : event.compulsoryDanceIds.map((id, k) => [`cd:${id}` as const, k] as const);
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
        name: truncate(name, MAX_NAME, 'The name'),
        club: truncate(club, MAX_CLUB, 'The club'),
        blocks,
      };
    });
    if (missing > 0) {
      note(
        `${missing} mark${missing === 1 ? ' is' : 's are'} not entered yet and were exported as 0.0; enter them again in the application.`,
      );
    }

    const entryIds = entries.map((e) => e.id);
    const scored = calculateEvent({
      entryIds,
      judgeIds: event.judgeIds,
      segments: eventSegments(event, file.dances),
      mark: (key, judgeId, entryId) => marks.get(`${event.id}|${key}|${judgeId}|${entryId}`) ?? 0,
      tieBreakMarks: eventTieBreakMarks(event),
    });
    const bTotals = entryIds.map((id) =>
      event.hasFreeDance
        ? event.judgeIds.reduce((a, j) => a + (marks.get(`${event.id}|fd:B|${j}|${id}`) ?? 0), 0)
        : 0,
    );

    result.files.push({
      name: `DATA${String(result.files.length + 1).padStart(3, '0')}B.ROL`,
      event: event.name,
      data: writeDanceEvent({
        competition: truncate(file.competition.name, MAX_NAME, 'The competition name'),
        venue: truncate(file.competition.venue, MAX_NAME, 'The venue'),
        date: legacyDate(file.competition.date),
        name: truncate(event.name, MAX_NAME, 'The event name'),
        judges: event.judgeIds.map((id) =>
          truncate(judgeName.get(id) ?? 'Judge', MAX_NAME, 'The judge’s name'),
        ),
        referee: event.refereeId
          ? truncate(judgeName.get(event.refereeId) ?? '', MAX_NAME, 'The referee’s name')
          : '',
        kind,
        dances,
        entries: exported,
        tail: tailFromResult(scored, entryIds, bTotals),
      }),
    });
  }
  return result;
}

function unsupportedReason(event: FileEvent): string | undefined {
  if (event.discipline === 'figures') return 'figures events can not be exported yet.';
  if (event.compulsoryDanceIds.length > MAX_DANCES) {
    return `it has more than ${MAX_DANCES} compulsory dances.`;
  }
  if (event.hasFreeDance && event.compulsoryDanceIds.length > 0) {
    return 'events with compulsory dances and a free dance can not be exported yet.';
  }
  if (!event.hasFreeDance && event.compulsoryDanceIds.length === 0) return 'it has no dances.';
  return undefined;
}
