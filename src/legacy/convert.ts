import { FIGURES } from '../domain/figures';
import { cfKey, danceFreeFactor } from '../domain/segments';
import type { EntryType, EventFigure, Id, SegmentKey } from '../domain/types';
import type { CompetitionFile } from '../io/competitionFile';
import { legacyDanceName } from './dances';
import type { LegacyCompetition, LegacyEntry, LegacyEvent, LegacyFraction, LegacyWarning } from './types';

type FileEvent = CompetitionFile['events'][number];

export interface LegacyConversion {
  file: CompetitionFile;
  warnings: LegacyWarning[];
  /** Events in the legacy files that could not be imported (an unsupported type). */
  skippedEvents: string[];
  /** What the files do not say, that the user can fill in (and pass back as `LegacyChoices`). */
  issues: LegacyIssues;
}

/** The user's answers to `LegacyIssues`. */
export interface LegacyChoices {
  /** yyyy-mm-dd, for a date that could not be read. */
  date?: string;
  /** A name for each dance number Podium does not know, by number. */
  danceNames?: Record<number, string>;
  /** The entry type of a Solo Dance event, by its index in `LegacyCompetition.events`. */
  entryTypes?: Partial<Record<number, EntryType>>;
}

export interface LegacyIssues {
  /** The date typed in the files, when it could not be read. */
  date?: { text: string };
  unknownDances: { code: number; defaultName: string; events: string[] }[];
  /** Solo Dance events whose entry type was guessed from the names; `entryType` is the one used. */
  guessedTypes: { index: number; eventId: Id; event: string; entryType: EntryType }[];
}

/** Groups events into competitions by their competition name, venue and date. */
export function groupLegacyEvents(events: LegacyEvent[]): LegacyCompetition[] {
  const groups = new Map<string, LegacyCompetition>();
  for (const event of events) {
    const { name, venue, date } = event.competition;
    const key = [name, venue, date].map((s) => s.toLowerCase()).join('|');
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { name, venue, date, events: [] }));
    group.events.push(event);
  }
  return [...groups.values()];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function isoDate(year: number, month: number, day: number): string | undefined {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return undefined;
  return d.toISOString().slice(0, 10);
}

/** The date typed into the legacy app (free text, e.g. "9th August 2026") as yyyy-mm-dd. */
export function parseLegacyDate(text: string): string | undefined {
  const t = text.trim().toLowerCase();
  const month = (word: string) => {
    const i = MONTHS.indexOf(word.slice(0, 3));
    return i >= 0 ? i + 1 : undefined;
  };
  let m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(t);
  if (m) return isoDate(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return isoDate(+m[3]!, +m[2]!, +m[1]!);
  // "9th August 2026", "9 Aug 2026", "9th-10th August 2026" (the first day is used)
  m =
    /^(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-&]\s*\d{1,2}(?:st|nd|rd|th)?)?\s+(?:of\s+)?([a-z]+)\.?,?\s+(\d{4})$/.exec(
      t,
    );
  if (m && month(m[2]!)) return isoDate(+m[3]!, month(m[2]!)!, +m[1]!);
  // "August 9, 2026"
  m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(t);
  if (m && month(m[1]!)) return isoDate(+m[3]!, month(m[1]!)!, +m[2]!);
  return undefined;
}

const SLASH = /\s+\/\s+/;

/** Solo Dance events cover solos, duos, couples and teams but the files do not say which: guess from the names. */
export function guessDanceEntryType(eventName: string, entries: LegacyEntry[]): EntryType {
  const names = entries.map((e) => e.name).filter(Boolean);
  const couples = /couple/i.test(eventName);
  if (names.length > 0 && names.every((n) => SLASH.test(n))) return couples ? 'couples' : 'duo';
  if (couples) return 'couples';
  if (/team|trio|quartet|precision/i.test(eventName)) return 'team';
  return 'solo';
}

/** The legacy fraction (e.g. 3/2) as Podium's hundredths (150); the fallback when it is missing. */
function hundredths({ numerator, denominator }: LegacyFraction, fallback = 100): number {
  if (numerator <= 0 || denominator <= 0) return fallback;
  return Math.min(100_000, Math.max(1, Math.round((100 * numerator) / denominator)));
}

/**
 * The Podium mark key for each legacy mark block: 0-3 the compulsory dances or figures, 4-5 the short
 * programme A and B, 6-7 the free dance or long programme A and B. `undefined` = the event has no such part.
 */
function danceKeys(dances: SegmentKey[], hasFreeDance: boolean): (SegmentKey | undefined)[] {
  return [
    ...dances,
    ...Array<undefined>(4 - dances.length).fill(undefined),
    undefined,
    undefined,
    hasFreeDance ? 'fd:A' : undefined,
    hasFreeDance ? 'fd:B' : undefined,
  ];
}

function figureEventKeys(
  figureKeys: (SegmentKey | undefined)[],
  hasShort: boolean,
  hasLong: boolean,
): (SegmentKey | undefined)[] {
  const keys = [...figureKeys, ...Array<undefined>(4 - figureKeys.length).fill(undefined)];
  return [
    ...keys,
    hasShort ? 'sp:A' : undefined,
    hasShort ? 'sp:B' : undefined,
    hasLong ? 'lp:A' : undefined,
    hasLong ? 'lp:B' : undefined,
  ];
}

/** Converts the events of one legacy competition into a Podium competition file. */
export function convertLegacyCompetition(
  legacy: LegacyCompetition,
  choices: LegacyChoices = {},
): LegacyConversion {
  const warnings: LegacyWarning[] = [];
  const skippedEvents: string[] = [];
  const newId = () => crypto.randomUUID();
  const now = Date.now();
  const competitionId = newId();

  const issues: LegacyIssues = { unknownDances: [], guessedTypes: [] };
  const readDate = parseLegacyDate(legacy.date);
  if (!readDate) issues.date = { text: legacy.date };
  const date = choices.date || readDate;
  if (!date) {
    warnings.push({
      level: 'warning',
      kind: 'date',
      message: `The date “${legacy.date}” could not be read; today’s date was used. Change it in the competition’s settings.`,
    });
  }

  const file: CompetitionFile = {
    app: 'podium',
    formatVersion: 2,
    exportedAt: new Date(now).toISOString(),
    competition: {
      id: competitionId,
      name: legacy.name || 'Imported competition',
      date: date ?? new Date(now).toISOString().slice(0, 10),
      venue: legacy.venue,
      createdAt: now,
      updatedAt: now,
    },
    dances: [],
    skaters: [],
    judges: [],
    events: [],
    entries: [],
    marks: [],
  };

  const dances = new Map<string, Id>();
  const danceId = (name: string) => {
    let id = dances.get(name.toLowerCase());
    if (!id) {
      dances.set(name.toLowerCase(), (id = newId()));
      file.dances.push({ id, competitionId, name });
    }
    return id;
  };
  const judges = new Map<string, Id>();
  const judgeId = (name: string) => {
    let id = judges.get(name.toLowerCase());
    if (!id) {
      judges.set(name.toLowerCase(), (id = newId()));
      file.judges.push({ id, competitionId, name });
    }
    return id;
  };
  const skaters = new Map<string, Id>();
  const skaterId = (name: string, club: string) => {
    const key = `${name.toLowerCase()}|${club.toLowerCase()}`;
    let id = skaters.get(key);
    if (!id) {
      skaters.set(key, (id = newId()));
      file.skaters.push({ id, competitionId, name, club });
    }
    return id;
  };

  for (const [index, ev] of legacy.events.entries()) {
    warnings.push(...ev.warnings);
    const note = (message: string, level: LegacyWarning['level'] = 'warning', kind?: LegacyWarning['kind']) =>
      warnings.push({ level, event: ev.name, message, ...(kind ? { kind } : {}) });

    if (ev.kind === 'unsupported') {
      skippedEvents.push(ev.name);
      note(
        `Skipped: this is a type of event Podium does not support (only Solo Dance, Couples Dance, Single and Pairs events are imported).`,
      );
      continue;
    }

    const eventId = newId();
    const judgeIds = ev.judges.map(judgeId);
    const refereeId = ev.referee ? judgeId(ev.referee) : undefined;

    // What the event is made of, and which Podium mark each legacy block becomes.
    let entryType: EntryType;
    let keys: (SegmentKey | undefined)[];
    const event: FileEvent = {
      id: eventId,
      competitionId,
      name: ev.name,
      order: file.events.length,
      entryType: 'solo',
      compulsoryDanceIds: [],
      hasFreeDance: false,
      discipline: 'dance',
      figures: [],
      hasShort: false,
      hasLong: false,
      factors: { figures: 100, short: 100, long: 100 },
      judgeIds,
      ...(refereeId ? { refereeId } : {}),
      status: 'setup',
    };

    if (ev.kind === 'dance' || ev.kind === 'couples') {
      entryType = ev.kind === 'couples' ? 'couples' : guessDanceEntryType(ev.name, ev.entries);
      if (ev.kind === 'dance' && ev.entries.length > 0) {
        const chosen = choices.entryTypes?.[index];
        if (chosen) entryType = chosen;
        else
          note(
            `Entry type guessed as “${entryType}” from the names; change it in the event if wrong.`,
            'info',
            'entry-type',
          );
        issues.guessedTypes.push({ index, eventId, event: ev.name, entryType });
      }
      const keysInOrder: SegmentKey[] = [];
      ev.compulsory.forEach((c, position) => {
        const { name: defaultName, known } = legacyDanceName(c.code, position);
        const chosen = known ? undefined : choices.danceNames?.[c.code]?.trim();
        const name = chosen || defaultName;
        if (!known) {
          let issue = issues.unknownDances.find((d) => d.code === c.code);
          if (!issue) issues.unknownDances.push((issue = { code: c.code, defaultName, events: [] }));
          if (!issue.events.includes(ev.name)) issue.events.push(ev.name);
          if (!chosen)
            note(
              `Dance number ${c.code} is not known yet, so it was named “${name}”. Rename it in the roster.`,
              'warning',
              'unknown-dance',
            );
        }
        const id = danceId(name);
        if (event.compulsoryDanceIds.includes(id))
          return note(`${name} appears twice; the second was skipped.`);
        event.compulsoryDanceIds.push(id);
        keysInOrder.push(`cd:${id}`);
      });
      event.hasFreeDance = ev.hasLong;
      // Podium weighs the free dance by the number of compulsory dances; the application lets it be changed.
      const expected = danceFreeFactor(event.compulsoryDanceIds.length);
      const factor = hundredths(ev.factors.long);
      if (ev.hasLong && event.compulsoryDanceIds.length > 0 && factor !== expected) {
        note(
          `The free dance counts ×${factor / 100} in the file but Podium uses ×${expected / 100} with ${event.compulsoryDanceIds.length} compulsory ${event.compulsoryDanceIds.length === 1 ? 'dance' : 'dances'}, so the totals will differ from the application’s.`,
        );
      }
      keys = danceKeys(keysInOrder, event.hasFreeDance);
    } else {
      entryType = ev.kind === 'single' ? 'single' : 'pairs';
      event.discipline = 'figures';
      const keysInOrder: SegmentKey[] = [];
      for (const c of ev.compulsory) {
        const figure: EventFigure = { figureId: String(c.code), ...(c.side ? { side: c.side } : {}) };
        if (!FIGURES.some((f) => f.id === figure.figureId)) {
          note(`Figure number ${c.code} is not in Podium’s figure list, so it was skipped.`);
          continue;
        }
        event.figures.push(figure);
        keysInOrder.push(cfKey(figure));
      }
      event.hasShort = ev.hasShort;
      event.hasLong = ev.hasLong;
      event.factors = {
        figures: hundredths(ev.factors.compulsory),
        short: hundredths(ev.factors.short),
        long: hundredths(ev.factors.long),
      };
      keys = figureEventKeys(keysInOrder, ev.hasShort, ev.hasLong);
    }
    event.entryType = entryType;

    let skipped = 0;
    let marked = false;
    let startOrder = 0;
    for (const entry of ev.entries) {
      const names = entryNames(entryType, entry);
      if (!entry.name) {
        skipped++;
        continue;
      }
      if ((entryType === 'duo' || entryType === 'couples') && names.length < 2) {
        note(`“${entry.name}” has only one name, so it was added as a single skater.`);
      }
      const entryId = newId();
      file.entries.push({
        id: entryId,
        eventId,
        startOrder: startOrder++,
        skaterIds: entryType === 'team' ? [] : names.map((n) => skaterId(n, entry.club)),
        ...(entryType === 'team'
          ? { teamName: entry.name, ...(entry.club ? { club: entry.club } : {}) }
          : {}),
      });
      if (entry.blocks.some((marks) => marks?.every((m) => m === 0))) {
        note(
          `“${entry.name}” has all marks 0.0 (a no-show in the legacy app); imported as 0.0, so it places last.`,
          'info',
        );
      }
      entry.blocks.forEach((marks, k) => {
        if (!marks) return;
        const key = keys[k];
        if (!key) {
          note(`“${entry.name}” has marks (block ${k + 1}) that the event does not use; they were skipped.`);
          return;
        }
        marks.forEach((tenths, j) => {
          if (tenths > 100) return note(`“${entry.name}” has a mark above 10.0 that was skipped.`);
          marked = true;
          file.marks.push({ eventId, segmentKey: key, judgeId: judgeIds[j]!, entryId, tenths });
        });
      });
    }
    if (skipped > 0)
      note(`${skipped} blank ${skipped === 1 ? 'entry was' : 'entries were'} skipped.`, 'info');
    event.status = marked ? 'scoring' : 'setup';
    file.events.push(event);
  }

  return { file, warnings, skippedEvents, issues };
}

/** An entry's skater names for its type (teams have none: the team name is the entry's name). */
function entryNames(type: EntryType, entry: LegacyEntry): string[] {
  switch (type) {
    case 'team':
      return [];
    case 'pairs':
      return [entry.name, entry.partner].filter(Boolean);
    case 'duo':
    case 'couples':
      // A Couples Dance event stores the second skater apart; a Solo Dance event is "A / B".
      if (type === 'couples' && entry.partner) return [entry.name, entry.partner];
      return entry.name
        .split(SLASH)
        .map((n) => n.trim())
        .filter(Boolean)
        .slice(0, 2);
    default:
      return entry.name ? [entry.name] : [];
  }
}
