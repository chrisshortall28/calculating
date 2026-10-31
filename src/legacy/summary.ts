import type { EntryType } from '../domain/types';
import type { LegacyConversion } from './convert';

export interface ConversionSummary {
  competition: { name: string; date: string; venue: string };
  counts: { events: number; entries: number; skaters: number; judges: number; marks: number };
  events: {
    id: string;
    name: string;
    entryType: EntryType;
    figures: boolean;
    entries: number;
    marks: number;
  }[];
  skipped: string[];
  warnings: LegacyConversion['warnings'];
  notes: LegacyConversion['warnings'];
}

/** What the review step shows about a converted competition; the warnings it asks the user about instead are left out. */
export function summariseConversion({ file, warnings, skippedEvents }: LegacyConversion): ConversionSummary {
  const entries = new Map<string, number>();
  for (const e of file.entries) entries.set(e.eventId, (entries.get(e.eventId) ?? 0) + 1);
  const marks = new Map<string, number>();
  for (const m of file.marks) marks.set(m.eventId, (marks.get(m.eventId) ?? 0) + 1);
  return {
    competition: { name: file.competition.name, date: file.competition.date, venue: file.competition.venue },
    counts: {
      events: file.events.length,
      entries: file.entries.length,
      skaters: file.skaters.length,
      judges: file.judges.length,
      marks: file.marks.length,
    },
    events: file.events.map((e) => ({
      id: e.id,
      name: e.name,
      entryType: e.entryType,
      figures: e.discipline === 'figures',
      entries: entries.get(e.id) ?? 0,
      marks: marks.get(e.id) ?? 0,
    })),
    skipped: skippedEvents,
    warnings: warnings.filter((w) => w.level === 'warning' && !w.kind),
    notes: warnings.filter((w) => w.level === 'info' && !w.kind),
  };
}
