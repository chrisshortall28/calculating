import { calculateEvent, type ScoringInput } from '../scoring';
import type { Id } from './types';

export interface ReversedOrder {
  /** The entries, lowest placed first and highest placed last. */
  order: Id[];
  /** The names of the parts the order is based on: those with every mark in. */
  basedOn: string[];
}

/**
 * Entries in reverse order of their placings so far, for a part that follows the others (the free
 * dance after the compulsory dances): the lowest placed skates first. The placings use only the
 * parts with every mark entered, so they are those the event would have if it ended there. Entries
 * level on a place keep their current order. Undefined when no part is complete yet.
 */
export function reverseOrderBySoFar(input: ScoringInput): ReversedOrder | undefined {
  const complete = input.segments.filter(
    (segment) => calculateEvent({ ...input, segments: [segment] }).complete,
  );
  if (complete.length === 0) return undefined;
  const { overall } = calculateEvent({ ...input, segments: complete });
  const current = new Map(input.entryIds.map((id, i) => [id, i]));
  const order = overall
    .toSorted((a, b) => b.place - a.place || current.get(a.entryId)! - current.get(b.entryId)!)
    .map((row) => row.entryId);
  return { order, basedOn: complete.map((s) => s.name) };
}
