/**
 * Results can be worked out from the whole event (the final, combined placings) or from one kind of part
 * alone, once those parts are marked: the compulsory dances, the free dance, or for a Figures & Free event
 * the figures, the short programme or the free programme.
 */
export type ResultsScope = 'final' | 'compulsory' | 'free' | 'figures' | 'short' | 'long';

/** Which kind of part a segment (`cd:…`, `cf:…`, `fd`, `sp`, `lp`) is. */
export function scopeOfSegment(segmentId: string): Exclude<ResultsScope, 'final'> {
  if (segmentId === 'fd') return 'free';
  if (segmentId === 'sp') return 'short';
  if (segmentId === 'lp') return 'long';
  return segmentId.startsWith('cf:') ? 'figures' : 'compulsory';
}

const ORDER: Exclude<ResultsScope, 'final'>[] = ['compulsory', 'figures', 'short', 'free', 'long'];

/**
 * The results an event can offer: the final results first, then each kind of part when there is more than
 * one kind (an event of only a free dance has nothing but its final results).
 */
export function scopesOf(segments: { id: string }[]): ResultsScope[] {
  const kinds = ORDER.filter((k) => segments.some((s) => scopeOfSegment(s.id) === k));
  return kinds.length < 2 ? ['final'] : ['final', ...kinds];
}

export const scopeLabel: Record<ResultsScope, string> = {
  final: 'Final results (combined)',
  compulsory: 'Compulsory dances',
  free: 'Free dance',
  figures: 'Figures',
  short: 'Short programme',
  long: 'Free programme',
};
