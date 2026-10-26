import { figureLabel } from './figures';
import type { TieBreakMark } from '../scoring/types';
import type { CompEvent, Dance, EventFigure, Factors, Id, SegmentKey } from './types';

/**
 * A scored part of an event: a compulsory dance or figure (one mark), or the free dance, short
 * programme or free programme (A + B marks).
 */
export interface Segment {
  id: string; // `cd:<danceId>`, `fd`, `cf:<figureId>:<side>`, `sp` or `lp`
  kind: 'compulsory' | 'free';
  name: string;
  markKeys: SegmentKey[];
  /** Multiplies the segment's marks in a judge's sum, in hundredths (100 = ×1; the default). */
  factor?: number;
}

export const NO_FACTORS: Factors = { figures: 100, short: 100, long: 100 };

/** The figures & free fields of a dance event (or of any event stored before they existed). */
export const danceEventDefaults = (): Pick<
  CompEvent,
  'discipline' | 'figures' | 'hasShort' | 'hasLong' | 'factors'
> => ({ discipline: 'dance', figures: [], hasShort: false, hasLong: false, factors: { ...NO_FACTORS } });

export function cdKey(danceId: Id): SegmentKey {
  return `cd:${danceId}`;
}

export function cfKey(figure: EventFigure): SegmentKey {
  return `cf:${figure.figureId}:${figure.side ?? '-'}`;
}

const SIDE_NAME = { L: 'Left', R: 'Right' } as const;

export function eventFigureLabel(figure: EventFigure): string {
  const label = figureLabel(figure.figureId);
  return figure.side ? `${label} (${SIDE_NAME[figure.side]})` : label;
}

/**
 * Default factors for a figures event: the free programme counts three times the short when both
 * are skated, and with both programmes the figures count once per figure (2 figures: 2:1:3).
 */
export function defaultFactors(figureCount: number, hasShort: boolean, hasLong: boolean): Factors {
  const both = hasShort && hasLong;
  return {
    figures: both && figureCount > 0 ? figureCount * 100 : 100,
    short: 100,
    long: both ? 300 : 100,
  };
}

/**
 * The free dance's factor, in hundredths, in a dance event, as Calculating For Windows applies it: half
 * the number of compulsory dances, so the compulsory dances together and the free dance (its A and B
 * marks) each make up half of the total: one dance ×½ (1 : ½), two dances ×1 (1 : 1), three ×1½. A free
 * dance with no compulsory dances has nothing to weigh against: ×1.
 */
export const danceFreeFactor = (compulsoryDances: number) =>
  compulsoryDances > 0 ? 50 * compulsoryDances : 100;

export function eventSegments(event: CompEvent, dances: Map<Id, Dance> | Dance[]): Segment[] {
  if (event.discipline === 'figures') {
    const segments: Segment[] = event.figures.map((f) => ({
      id: cfKey(f),
      kind: 'compulsory',
      name: eventFigureLabel(f),
      markKeys: [cfKey(f)],
      factor: event.factors.figures,
    }));
    if (event.hasShort)
      segments.push({
        id: 'sp',
        kind: 'free',
        name: 'Short Programme',
        markKeys: ['sp:A', 'sp:B'],
        factor: event.factors.short,
      });
    if (event.hasLong)
      segments.push({
        id: 'lp',
        kind: 'free',
        name: 'Free Programme',
        markKeys: ['lp:A', 'lp:B'],
        factor: event.factors.long,
      });
    return segments;
  }
  const byId = dances instanceof Map ? dances : new Map(dances.map((d) => [d.id, d]));
  const segments: Segment[] = event.compulsoryDanceIds.map((danceId) => ({
    id: cdKey(danceId),
    kind: 'compulsory',
    name: byId.get(danceId)?.name ?? 'Unknown dance',
    markKeys: [cdKey(danceId)],
    factor: 100,
  }));
  if (event.hasFreeDance) {
    segments.push({
      id: 'fd',
      kind: 'free',
      name: 'Free Dance',
      markKeys: ['fd:A', 'fd:B'],
      factor: danceFreeFactor(event.compulsoryDanceIds.length),
    });
  }
  return segments;
}

type EventParts = Pick<
  CompEvent,
  'discipline' | 'compulsoryDanceIds' | 'hasFreeDance' | 'figures' | 'hasShort' | 'hasLong'
>;

/** Every mark key the event takes. */
export function eventMarkKeys(event: EventParts): Set<SegmentKey> {
  const keys = new Set<SegmentKey>();
  if (event.discipline === 'figures') {
    for (const f of event.figures) keys.add(cfKey(f));
    if (event.hasShort) keys.add('sp:A').add('sp:B');
    if (event.hasLong) keys.add('lp:A').add('lp:B');
  } else {
    for (const id of event.compulsoryDanceIds) keys.add(cdKey(id));
    if (event.hasFreeDance) keys.add('fd:A').add('fd:B');
  }
  return keys;
}

/**
 * The B marks that break ties, in the order the CIPA manual applies them (rules 3 and 7B):
 * dance events use the free dance B mark; singles and pairs the free, then the short programme B
 * mark. Figures (alone or combined with free skating) have none: equal sums are half a victory each.
 */
export function eventTieBreakMarks(event: EventParts): TieBreakMark[] {
  if (event.discipline === 'figures') {
    if (event.figures.length > 0) return [];
    return [
      ...(event.hasLong ? [{ key: 'lp:B' as const, label: 'free programme' }] : []),
      ...(event.hasShort ? [{ key: 'sp:B' as const, label: 'short programme' }] : []),
    ];
  }
  return event.hasFreeDance ? [{ key: 'fd:B', label: 'free dance' }] : [];
}

/** "A" / "B" for the marks of a two-mark segment; blank for a single mark. */
export function markKeyLabel(key: SegmentKey): string {
  if (key.startsWith('cd:') || key.startsWith('cf:')) return '';
  return key.endsWith(':A') ? 'A' : key.endsWith(':B') ? 'B' : '';
}

/**
 * The factors an event's sums use, e.g. "figures ×2, short programme ×1, free programme ×3" or
 * "compulsory dances ×1, free dance ×0.5"; blank when there is nothing to multiply (a single kind of
 * part).
 */
export function factorSummary(
  event: Pick<
    CompEvent,
    'discipline' | 'figures' | 'hasShort' | 'hasLong' | 'factors' | 'compulsoryDanceIds' | 'hasFreeDance'
  >,
) {
  if (event.discipline !== 'figures') {
    const dances = event.compulsoryDanceIds.length;
    return event.hasFreeDance && dances > 0
      ? `compulsory dances ×1, free dance ×${danceFreeFactor(dances) / 100}`
      : '';
  }
  const parts: [string, number][] = [
    ...(event.figures.length > 0 ? [['figures', event.factors.figures] as [string, number]] : []),
    ...(event.hasShort ? [['short programme', event.factors.short] as [string, number]] : []),
    ...(event.hasLong ? [['free programme', event.factors.long] as [string, number]] : []),
  ];
  if (parts.length < 2) return '';
  return parts.map(([name, f]) => `${name} ×${f / 100}`).join(', ');
}

/** What an event's scored parts are called: dance, figure, programme, or section when figures and programmes mix. */
export function segmentNoun(
  event: Pick<CompEvent, 'discipline' | 'figures' | 'hasShort' | 'hasLong'>,
): 'dance' | 'figure' | 'programme' | 'section' {
  if (event.discipline !== 'figures') return 'dance';
  const programmes = event.hasShort || event.hasLong;
  if (event.figures.length > 0 && programmes) return 'section';
  return programmes ? 'programme' : 'figure';
}
