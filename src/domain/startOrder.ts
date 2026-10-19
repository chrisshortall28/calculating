import type { Segment } from './segments';
import type { CompEvent, Competition } from './types';

/**
 * Rotating start order: the field is split into one group per compulsory part (dance or figure),
 * the bigger groups first, and part k starts with the first entry of group k. Display only —
 * scoring never depends on skating order.
 */

/** Index (into the entries in start order) of the entry that skates first in each of `partCount` parts. */
export function partStartIndexes(entryCount: number, partCount: number): number[] {
  if (partCount <= 0) return [];
  const base = Math.floor(entryCount / partCount);
  const extra = entryCount % partCount;
  const starts: number[] = [];
  let at = 0;
  for (let k = 0; k < partCount; k++) {
    starts.push(Math.min(at, Math.max(entryCount - 1, 0)));
    at += base + (k < extra ? 1 : 0);
  }
  return starts;
}

/** The entries in the order part `partIndex` is skated: starting at the part's first skater, then wrapping round. */
export function rotatedOrder<T>(entries: readonly T[], partIndex: number, partCount: number): T[] {
  const start = partStartIndexes(entries.length, partCount)[partIndex] ?? 0;
  return [...entries.slice(start), ...entries.slice(0, start)];
}

/** Whether the event rotates its start order: its own setting, else the competition's default. */
export function effectiveRotate(
  event: Pick<CompEvent, 'rotateStartOrder'>,
  competition: Pick<Competition, 'rotateStartOrder'>,
): boolean {
  const own = event.rotateStartOrder ?? 'default';
  return own === 'default' ? !!competition.rotateStartOrder : own === 'on';
}

/**
 * For each compulsory segment (dance or figure) of a rotating event with two or more of them, the
 * 0-based position in start order of the entry that skates it first. Empty when nothing rotates.
 */
export function firstSkaters(segments: Segment[], entryCount: number, rotate: boolean): Map<string, number> {
  const parts = segments.filter((s) => s.kind === 'compulsory');
  const out = new Map<string, number>();
  if (!rotate || parts.length < 2 || entryCount === 0) return out;
  const starts = partStartIndexes(entryCount, parts.length);
  parts.forEach((s, i) => out.set(s.id, starts[i]!));
  return out;
}
