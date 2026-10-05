import type { CombinedCupConfig, CupCategory, CupRole, Id } from '../domain/types';

/** Pure scoring for The Combined Cup (no React or DB imports), like `src/scoring/`. */

export const CUP_CATEGORIES: { value: CupCategory; label: string }[] = [
  { value: 'newcomer-novice', label: 'Newcomer / Novice' },
  { value: 'elementary-prelim', label: 'Elementary / Prelim' },
  { value: 'inter-bronze-up', label: 'Inter-Bronze & above' },
];

export const categoryLabel = (c: CupCategory) => CUP_CATEGORIES.find((x) => x.value === c)!.label;

export const CUP_ROLES: { value: CupRole; label: string }[] = [
  { value: 'solo', label: 'Solo dance' },
  { value: 'duo', label: 'Duo dance' },
  { value: 'team', label: 'Team' },
];

export const roleLabel = (r: CupRole) => CUP_ROLES.find((x) => x.value === r)!.label;

/** 5 points for 1st down to 1 for 5th; nothing below that. A shared place scores that place's points. */
export const cupPoints = (place: number) => (place >= 1 && place <= 5 ? 6 - place : 0);

/** One tagged event, reduced to what the Cup needs. Entries have no `place` until the event is complete. */
export interface CupEventInput {
  eventId: Id;
  name: string;
  role: CupRole;
  complete: boolean;
  entries: { skaterIds: Id[]; place?: number; tied?: boolean }[];
}

export interface CupPlacing {
  eventId: Id;
  eventName: string;
  place: number;
  tied: boolean;
  points: number;
}

/** One part of a skater's Cup (solo, duo or team). */
export interface CupPart {
  /** The placing that scores: their best in this part. */
  counted?: CupPlacing;
  /** Their other placings in this part, which are disregarded. */
  notCounted: CupPlacing[];
  /** Events of this part they are in that aren't complete yet. */
  pending: string[];
}

export type TieBreakPart = 'trio' | 'solo' | 'duo' | 'team';

export const TIE_BREAK_ORDER: TieBreakPart[] = ['trio', 'solo', 'duo', 'team'];
export const tieBreakLabel: Record<TieBreakPart, string> = {
  trio: 'Mix and Match result',
  solo: 'solo result',
  duo: 'duo result',
  team: 'team result',
};

export interface CupEntrantResult {
  skaterId: Id;
  category: CupCategory;
  solo: CupPart;
  duo: CupPart;
  team: CupPart;
  /** The Mix and Match trio placing, if any. */
  trio?: { place: number; points: number };
  total: number;
}

export interface CupRanked extends CupEntrantResult {
  rank: number;
  /** Still level with another entrant after every tie-break: they share the rank. */
  tied: boolean;
  /** Level on points with someone else in the category: what separated them (undefined = nothing). */
  levelOnTotal: boolean;
  decidedBy?: TieBreakPart;
}

export interface CupCategoryResult {
  category: CupCategory;
  ranked: CupRanked[];
  /** Skaters ranked first (more than one only if they are tied right through the tie-breaks). */
  winners: Id[];
}

export interface CupStandings {
  categories: CupCategoryResult[];
  /** Some event that an entrant is in isn't complete, so the results can still change. */
  provisional: boolean;
}

const partPoints = (r: CupEntrantResult, part: TieBreakPart) =>
  part === 'trio' ? (r.trio?.points ?? 0) : (r[part].counted?.points ?? 0);

/** Scores every entrant, then ranks each category: total points, then trio, solo, duo and team points. */
export function buildCupStandings(cup: CombinedCupConfig, events: CupEventInput[]): CupStandings {
  const tagged = events.filter((e) => cup.eventRoles[e.eventId] === e.role);
  let provisional = false;

  const results: CupEntrantResult[] = cup.entrants.map(({ skaterId, category }) => {
    const part = (role: CupRole): CupPart => {
      const placings: CupPlacing[] = [];
      const pending: string[] = [];
      for (const ev of tagged.filter((e) => e.role === role)) {
        const entry = ev.entries.find((e) => e.skaterIds.includes(skaterId));
        if (!entry) continue;
        if (!ev.complete || entry.place === undefined) {
          pending.push(ev.name);
          provisional = true;
          continue;
        }
        placings.push({
          eventId: ev.eventId,
          eventName: ev.name,
          place: entry.place,
          tied: !!entry.tied,
          points: cupPoints(entry.place),
        });
      }
      // The best placing counts (more points, then the better place); the rest are disregarded.
      const best = [...placings].sort((a, b) => b.points - a.points || a.place - b.place)[0];
      return { counted: best, notCounted: placings.filter((p) => p !== best), pending };
    };
    const place = cup.trio[skaterId];
    const result: CupEntrantResult = {
      skaterId,
      category,
      solo: part('solo'),
      duo: part('duo'),
      team: part('team'),
      trio: place ? { place, points: cupPoints(place) } : undefined,
      total: 0,
    };
    result.total = TIE_BREAK_ORDER.reduce((sum, p) => sum + partPoints(result, p), 0);
    return result;
  });

  const compare = (a: CupEntrantResult, b: CupEntrantResult) => {
    if (a.total !== b.total) return b.total - a.total;
    for (const p of TIE_BREAK_ORDER) {
      const d = partPoints(b, p) - partPoints(a, p);
      if (d !== 0) return d;
    }
    return 0;
  };

  const categories = CUP_CATEGORIES.map(({ value: category }) => {
    const members = results.filter((r) => r.category === category).sort(compare);
    const ranked: CupRanked[] = members.map((r) => {
      const sameTotal = members.filter((m) => m.total === r.total);
      const levelOnTotal = sameTotal.length > 1;
      // The first part on which the entrants level on points differ, e.g. the Mix and Match result.
      const decidedBy = levelOnTotal
        ? TIE_BREAK_ORDER.find((p) => sameTotal.some((m) => partPoints(m, p) !== partPoints(r, p)))
        : undefined;
      const level = members.filter((m) => compare(m, r) === 0);
      return {
        ...r,
        rank: members.findIndex((m) => compare(m, r) === 0) + 1,
        tied: level.length > 1,
        levelOnTotal,
        decidedBy,
      };
    });
    return {
      category,
      ranked,
      winners: ranked.filter((r) => r.rank === 1).map((r) => r.skaterId),
    };
  });

  return { categories, provisional };
}

/**
 * Explains each group of entrants level on points: what separated them, or that they still share the
 * rank. With `firstPlaceOnly`, only the group level at the top of the category (the winner's tie).
 */
export function cupTieNotes(
  category: CupCategoryResult,
  nameOf: (id: Id) => string,
  firstPlaceOnly = false,
): string[] {
  const notes: string[] = [];
  const top = category.ranked[0]?.total;
  for (const total of new Set(category.ranked.filter((r) => r.levelOnTotal).map((r) => r.total))) {
    if (firstPlaceOnly && total !== top) continue;
    const group = category.ranked.filter((r) => r.total === total);
    const names = group.map((r) => nameOf(r.skaterId)).join(', ');
    const by = group[0]!.decidedBy;
    notes.push(
      by
        ? `${names} were level on ${total} points: separated by the ${tieBreakLabel[by]} (higher points first).`
        : `${names} are level on ${total} points and on every tie-break: they share the place.`,
    );
  }
  return notes;
}
