import { z } from 'zod';
import { db, newId } from '../db/db';
import { statusForEntries } from '../db/repo';
import { NO_FACTORS } from '../domain/segments';
import { MAX_COMPULSORY_DANCES, MAX_FIGURES, type Id, type SegmentKey } from '../domain/types';

/** 2: figures & free events. Version 1 files are read as having only dance events. */
export const FORMAT_VERSION = 2;

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

const segmentKey = z.custom<SegmentKey>(
  (v) => typeof v === 'string' && (/^(fd|sp|lp):[AB]$/.test(v) || v.startsWith('cd:') || v.startsWith('cf:')),
);

/** In hundredths: 1–100000 (0.01–1000). */
const factor = z.number().int().min(1).max(100_000);

const fileSchema = z.object({
  app: z.literal('podium'),
  formatVersion: z.union([z.literal(1), z.literal(FORMAT_VERSION)]),
  exportedAt: z.string(),
  competition: z.object({
    id: z.string(),
    name: z.string(),
    date: z.string(),
    venue: z.string(),
    primaryColor: hexColor.optional(),
    secondaryColor: hexColor.optional(),
    welcome: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  dances: z.array(z.object({ id: z.string(), competitionId: z.string(), name: z.string() })),
  skaters: z.array(
    z.object({ id: z.string(), competitionId: z.string(), name: z.string(), club: z.string() }),
  ),
  judges: z.array(z.object({ id: z.string(), competitionId: z.string(), name: z.string() })),
  events: z.array(
    z.object({
      id: z.string(),
      competitionId: z.string(),
      name: z.string(),
      order: z.number(),
      entryType: z.enum(['solo', 'duo', 'couples', 'team', 'single', 'pairs']),
      compulsoryDanceIds: z.array(z.string()).max(MAX_COMPULSORY_DANCES),
      hasFreeDance: z.boolean(),
      discipline: z.enum(['dance', 'figures']).default('dance'),
      figures: z
        .array(z.object({ figureId: z.string(), side: z.enum(['L', 'R']).optional() }))
        .max(MAX_FIGURES)
        .default([]),
      hasShort: z.boolean().default(false),
      hasLong: z.boolean().default(false),
      factors: z.object({ figures: factor, short: factor, long: factor }).default(() => ({ ...NO_FACTORS })),
      judgeIds: z.array(z.string()),
      refereeId: z.string().optional(),
      status: z.enum(['setup', 'ready', 'scoring', 'final']),
    }),
  ),
  entries: z.array(
    z.object({
      id: z.string(),
      eventId: z.string(),
      startOrder: z.number(),
      skaterIds: z.array(z.string()),
      teamName: z.string().optional(),
      club: z.string().optional(),
    }),
  ),
  marks: z.array(
    z.object({
      eventId: z.string(),
      segmentKey,
      judgeId: z.string(),
      entryId: z.string(),
      tenths: z.number().int().min(0).max(100),
    }),
  ),
});

export type CompetitionFile = z.infer<typeof fileSchema>;

export async function exportCompetition(competitionId: Id): Promise<CompetitionFile> {
  const competition = await db.competitions.get(competitionId);
  if (!competition) throw new Error('Competition not found');
  const events = await db.events.where({ competitionId }).toArray();
  const eventIds = events.map((e) => e.id);
  return {
    app: 'podium',
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    competition,
    dances: await db.dances.where({ competitionId }).toArray(),
    skaters: await db.skaters.where({ competitionId }).toArray(),
    judges: await db.judges.where({ competitionId }).toArray(),
    events,
    entries: await db.entries.where('eventId').anyOf(eventIds).toArray(),
    marks: await db.marks.where('eventId').anyOf(eventIds).toArray(),
  };
}

export function parseCompetitionFile(json: unknown): CompetitionFile {
  const result = fileSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Not a valid Podium competition file: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * Imports a competition. `mode: 'copy'` gives everything fresh ids (safe to import
 * alongside the original); `mode: 'replace'` overwrites the competition with the same id.
 */
export async function importCompetition(file: CompetitionFile, mode: 'copy' | 'replace') {
  const map = new Map<string, string>();
  const id = (old: string) => {
    if (mode === 'replace') return old;
    let v = map.get(old);
    if (!v) map.set(old, (v = newId()));
    return v;
  };
  const compId = id(file.competition.id);
  const now = Date.now();

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      const eventIds = await db.events.where({ competitionId: compId }).primaryKeys();
      await db.marks.where('eventId').anyOf(eventIds).delete();
      await db.entries.where('eventId').anyOf(eventIds).delete();
      await db.events.where({ competitionId: compId }).delete();
      await db.dances.where({ competitionId: compId }).delete();
      await db.skaters.where({ competitionId: compId }).delete();
      await db.judges.where({ competitionId: compId }).delete();
    }
    await db.competitions.put({
      ...file.competition,
      id: compId,
      name: mode === 'copy' ? `${file.competition.name} (imported)` : file.competition.name,
      updatedAt: now,
    });
    await db.dances.bulkPut(file.dances.map((d) => ({ ...d, id: id(d.id), competitionId: compId })));
    await db.skaters.bulkPut(file.skaters.map((s) => ({ ...s, id: id(s.id), competitionId: compId })));
    await db.judges.bulkPut(file.judges.map((j) => ({ ...j, id: id(j.id), competitionId: compId })));
    await db.events.bulkPut(
      file.events.map((e) => ({
        ...e,
        id: id(e.id),
        competitionId: compId,
        compulsoryDanceIds: e.compulsoryDanceIds.map(id),
        judgeIds: e.judgeIds.map(id),
        refereeId: e.refereeId && id(e.refereeId),
        // Files from before the ready status: setup events with skaters are ready.
        status: statusForEntries(e.status, file.entries.filter((en) => en.eventId === e.id).length),
      })),
    );
    await db.entries.bulkPut(
      file.entries.map((e) => ({
        ...e,
        id: id(e.id),
        eventId: id(e.eventId),
        skaterIds: e.skaterIds.map(id),
      })),
    );
    await db.marks.bulkPut(
      file.marks.map((m) => ({
        ...m,
        eventId: id(m.eventId),
        judgeId: id(m.judgeId),
        entryId: id(m.entryId),
        segmentKey: m.segmentKey.startsWith('cd:')
          ? (`cd:${id(m.segmentKey.slice(3))}` as SegmentKey)
          : m.segmentKey,
      })),
    );
  });
  return compId;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const fileNameFor = (name: string, ext: string) =>
  `${
    name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'competition'
  }.${ext}`;
