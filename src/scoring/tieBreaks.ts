import type { TieBreakRule } from './types';

const atOrBetter = (ordinals: number[], column: number) => ordinals.filter((o) => o <= column);
const fmt = (tenths: number) => (tenths / 10).toFixed(1);

/** More judges placing the entry at this place or better. */
export const greaterMajority: TieBreakRule = {
  id: 'greaterMajority',
  label: 'Greater majority',
  score: (c, ctx) => -atOrBetter(c.ordinals, ctx.column).length,
  describe: (c, ctx) =>
    `${atOrBetter(c.ordinals, ctx.column).length} judges at ${ordinalLabel(ctx.column)} or better`,
};

/** Lower sum of the ordinals that make up the majority. */
export const lowerSumOfMajority: TieBreakRule = {
  id: 'lowerSumOfMajority',
  label: 'Lower sum of majority places',
  score: (c, ctx) => atOrBetter(c.ordinals, ctx.column).reduce((s, o) => s + o, 0),
  describe: (c, ctx) =>
    `sum of places ${ordinalLabel(ctx.column)} or better = ${atOrBetter(c.ordinals, ctx.column).reduce((s, o) => s + o, 0)}`,
};

/** Higher total of all judges' points. */
export const higherTotalPoints: TieBreakRule = {
  id: 'higherTotalPoints',
  label: 'Higher total points',
  score: (c) => -c.judgeTotals.reduce((s, t) => s + t, 0),
  describe: (c) => `total points ${fmt(c.judgeTotals.reduce((s, t) => s + t, 0))}`,
};

/** Compare counts at each following place column in turn (skating-system style). */
export const nextPlaces: TieBreakRule = {
  id: 'nextPlaces',
  label: 'Following places',
  score: (c, ctx) => {
    const key: number[] = [];
    for (let k = ctx.column + 1; k <= ctx.entryCount; k++) {
      const within = atOrBetter(c.ordinals, k);
      key.push(
        -within.length,
        within.reduce((s, o) => s + o, 0),
      );
    }
    return key;
  },
  describe: (c) => `places: ${[...c.ordinals].sort((a, b) => a - b).join(', ')}`,
};

export const ALL_TIE_BREAKS = [greaterMajority, lowerSumOfMajority, nextPlaces, higherTotalPoints];

/** Initial White/CIPA approximation — to be checked against the rulebook. */
export const DEFAULT_TIE_BREAKS: TieBreakRule[] = [greaterMajority, lowerSumOfMajority, higherTotalPoints];

export function ordinalLabel(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
