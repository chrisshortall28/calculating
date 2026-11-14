import type { Segment } from './segments';
import type { CompEvent, Competition, Id } from './types';

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

/** The items starting from  and wrapping round to the ones before it. */
export function rotateFrom<T>(items: readonly T[], index: number): T[] {
  return [...items.slice(index), ...items.slice(0, index)];
}

/** The entries in the order part `partIndex` is skated: starting at the part's first skater, then wrapping round. */
export function rotatedOrder<T>(entries: readonly T[], partIndex: number, partCount: number): T[] {
  const start = partStartIndexes(entries.length, partCount)[partIndex] ?? 0;
  return rotateFrom(entries, start);
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

/**
 * Own start orders. By default every part is skated in the entries' start order (rotated for the
 * compulsory parts when the event rotates). A part that comes after others — the free dance after the
 * compulsory dances, the short or free programme after the figures — can instead keep its own order in
 * `CompEvent.partOrders`. Display only: scoring never depends on skating order.
 */

/** The parts that can have their own order: free parts that follow at least one other part. */
export function ownOrderSegments(segments: Segment[]): Segment[] {
  return segments.filter((s, i) => s.kind === 'free' && i > 0);
}

/**
 * A saved order made whole: entries that have gone are dropped and entries added since (not in the saved
 * order) follow, in start order.
 */
export function resolvePartOrder(entryIds: readonly Id[], saved: readonly Id[]): Id[] {
  const present = new Set(entryIds);
  const kept = saved.filter((id, i) => present.has(id) && saved.indexOf(id) === i);
  const keptSet = new Set(kept);
  return [...kept, ...entryIds.filter((id) => !keptSet.has(id))];
}

/**
 * For each part with its own order, the positions (in start order) of the entries in the order that part is
 * skated. Parts that follow the start order are absent.
 */
export function partOrderPositions(
  event: Pick<CompEvent, 'partOrders'>,
  segments: Segment[],
  entryIds: readonly Id[],
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const segment of ownOrderSegments(segments)) {
    const saved = event.partOrders?.[segment.id];
    if (!saved) continue;
    const position = new Map(entryIds.map((id, i) => [id, i]));
    const positions = resolvePartOrder(entryIds, saved).map((id) => position.get(id)!);
    if (positions.some((p, i) => p !== i)) out.set(segment.id, positions);
  }
  return out;
}

/** The items (in start order) in the order a part is skated: its own order, else rotated from its first skater. */
export function inSegmentOrder<T>(
  items: readonly T[],
  segmentId: string,
  firstIndex: number,
  own?: ReadonlyMap<string, number[]>,
): T[] {
  const positions = own?.get(segmentId);
  return positions ? positions.map((p) => items[p]!) : rotateFrom(items, firstIndex);
}

/** Whether the event has an own order saved for any part (such a file needs a newer reader). */
export const hasPartOrders = (event: Pick<CompEvent, 'partOrders'>) =>
  Object.values(event.partOrders ?? {}).some((ids) => ids.length > 0);
