import type { EntryType } from '../domain/types';
import type { LegacyConversion } from './convert';

export interface ConversionSummary {
  competition: { name: string; date: string; venue: string };
  counts: { events: number; entries: number; skaters: number; judges: number; marks: number };
  events: { name: string; entryType: EntryType; figures: boolean; entries: number; marks: number }[];
  skipped: string[];
  warnings: LegacyConversion['warnings'];
  notes: LegacyConversion['warnings'];
}

/** What the review step shows about a converted competition. */
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
      name: e.name,
      entryType: e.entryType,
      figures: e.discipline === 'figures',
      entries: entries.get(e.id) ?? 0,
      marks: marks.get(e.id) ?? 0,
    })),
    skipped: skippedEvents,
    warnings: warnings.filter((w) => w.level === 'warning'),
    notes: warnings.filter((w) => w.level === 'info'),
  };
}
