import { eventMarkKeys } from './segments';
import type { CompEvent, Id, SegmentKey } from './types';

/**
 * Judges by section. The judges of an event sit in seats J1…Jn (`CompEvent.judgeIds`; a seat is named by
 * the judge who holds it by default). For a dance, figure or programme another judge can sit in a seat
 * instead: `judgeSwaps[segmentId][seatJudgeId] = substituteJudgeId`. Scoring always works in seats, so a
 * seat's sums, victories and ranks run over the whole event whoever sat in it; marks are stored under the
 * judge who gave them.
 *
 * An event with no `judgeSwaps` behaves exactly as before: every seat's occupant is the seat's own judge.
 */

/** segment id -> seat (default judge id) -> the judge who sits in that seat for that segment. */
export type JudgeSwaps = Record<string, Record<Id, Id>>;

type Panelled = Pick<CompEvent, 'judgeIds' | 'judgeSwaps'>;

/** The segment (`cd:<dance>`, `cf:…`, `fd`, `sp`, `lp`) a mark key belongs to. */
export function segmentIdOfKey(key: SegmentKey): string {
  const m = /^(fd|sp|lp):[AB]$/.exec(key);
  return m ? m[1]! : key;
}

/** The judge sitting in `seatId` for the segment. */
export function occupant(event: Pick<CompEvent, 'judgeSwaps'>, segmentId: string, seatId: Id): Id {
  return event.judgeSwaps?.[segmentId]?.[seatId] ?? seatId;
}

/** The judges for the segment, in seat order (J1…Jn). */
export function segmentPanel(event: Panelled, segmentId: string): Id[] {
  return event.judgeIds.map((seat) => occupant(event, segmentId, seat));
}

/** Whether any segment has a different judge in some seat. */
export const hasSwaps = (event: Pick<CompEvent, 'judgeSwaps'>): boolean =>
  Object.values(event.judgeSwaps ?? {}).some((seats) => Object.keys(seats).length > 0);

type RawMark = (key: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;

/**
 * A mark lookup by seat: asks for the mark the seat's occupant gave for the segment of `key`. Hand this,
 * with `event.judgeIds`, to the scoring engine and the PDFs instead of the raw lookup.
 */
export function seatMark(event: Pick<CompEvent, 'judgeSwaps'>, raw: RawMark): RawMark {
  if (!hasSwaps(event)) return raw;
  return (key, seatId, entryId) => raw(key, occupant(event, segmentIdOfKey(key), seatId), entryId);
}

/** Whether a stored mark still belongs to the event: its part exists and its judge sits in the part's panel. */
export function isMarkValid(
  event: Panelled & Parameters<typeof eventMarkKeys>[0],
  mark: { segmentKey: SegmentKey; judgeId: Id },
  keys: Set<SegmentKey> = eventMarkKeys(event),
): boolean {
  if (!keys.has(mark.segmentKey)) return false;
  const seats = event.judgeIds;
  if (!event.judgeSwaps) return seats.includes(mark.judgeId);
  return segmentPanel(event, segmentIdOfKey(mark.segmentKey)).includes(mark.judgeId);
}

/** The swaps with those whose seat or segment no longer exists, or that put a seat's own judge back, removed. */
export function cleanSwaps(event: Panelled & Parameters<typeof eventMarkKeys>[0]): JudgeSwaps | undefined {
  if (!event.judgeSwaps) return undefined;
  const segments = new Set([...eventMarkKeys(event)].map(segmentIdOfKey));
  const out: JudgeSwaps = {};
  for (const [segmentId, seats] of Object.entries(event.judgeSwaps)) {
    if (!segments.has(segmentId)) continue;
    const kept = Object.fromEntries(
      Object.entries(seats).filter(([seat, sub]) => event.judgeIds.includes(seat) && sub !== seat),
    );
    if (Object.keys(kept).length > 0) out[segmentId] = kept;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Judges who would sit in two seats of the segment under `panel` (its occupants in seat order). */
export const duplicateJudges = (panel: Id[]): Id[] => panel.filter((j, i) => panel.indexOf(j) !== i);

/** The mark keys of the event that belong to the segment. */
export const keysOfSegment = (event: Parameters<typeof eventMarkKeys>[0], segmentId: string): SegmentKey[] =>
  [...eventMarkKeys(event)].filter((k) => segmentIdOfKey(k) === segmentId);

/** Renames judge ids inside swaps (seat keys and substitutes), e.g. when one judge replaces another. */
export function renameJudgeInSwaps(swaps: JudgeSwaps | undefined, from: Id, to: Id): JudgeSwaps | undefined {
  if (!swaps) return undefined;
  return Object.fromEntries(
    Object.entries(swaps).map(([seg, seats]) => [
      seg,
      Object.fromEntries(
        Object.entries(seats).map(([seat, sub]) => [seat === from ? to : seat, sub === from ? to : sub]),
      ),
    ]),
  );
}

/** A judge who sits in a seat for one part instead of the seat's own judge. */
export interface SeatSwap {
  /** 1-based seat number (J1…) */
  seat: number;
  segmentName: string;
  judge: { id: Id; name: string };
}

/** The substitutions of an event, by seat then part, for display ("D in Free Dance"). */
export function seatSwaps(
  event: Panelled,
  segments: { id: string; name: string }[],
  judgeOf: (id: Id) => { id: Id; name: string } | undefined,
): SeatSwap[] {
  const out: SeatSwap[] = [];
  event.judgeIds.forEach((seatId, i) => {
    for (const s of segments) {
      const who = occupant(event, s.id, seatId);
      const judge = who === seatId ? undefined : judgeOf(who);
      if (judge) out.push({ seat: i + 1, segmentName: s.name, judge });
    }
  });
  return out;
}

/** "D in Free Dance, E in Dance 1" for the seat's substitutes (blank when there are none). */
export const swapsText = (swaps: SeatSwap[] | undefined, seat: number): string =>
  (swaps ?? [])
    .filter((s) => s.seat === seat)
    .map((s) => `${s.judge.name} in ${s.segmentName}`)
    .join(', ');
