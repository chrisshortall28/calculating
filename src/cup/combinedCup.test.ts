import { describe, expect, it } from 'vitest';
import type { CombinedCupConfig, CupRole } from '../domain/types';
import { buildCupStandings, cupPoints, type CupEventInput } from './combinedCup';

const event = (
  eventId: string,
  role: CupRole,
  places: Record<string, number>,
  opts: { complete?: boolean; tied?: string[] } = {},
): CupEventInput => ({
  eventId,
  name: eventId,
  role,
  complete: opts.complete ?? true,
  // A key like "a+b" is a duo entry of two skaters.
  entries: Object.entries(places).map(([who, place]) => ({
    skaterIds: who.split('+'),
    place: opts.complete === false ? undefined : place,
    tied: opts.tied?.includes(who),
  })),
});

const cup = (
  entrants: Record<string, CombinedCupConfig['entrants'][number]['category']>,
  roles: Record<string, CupRole>,
): CombinedCupConfig => ({
  eventRoles: roles,
  entrants: Object.entries(entrants).map(([skaterId, category]) => ({ skaterId, category })),
});

const cat = (s: ReturnType<typeof buildCupStandings>, c: string) =>
  s.categories.find((x) => x.category === c)!;
const row = (s: ReturnType<typeof buildCupStandings>, who: string) =>
  s.categories.flatMap((c) => c.ranked).find((r) => r.skaterId === who)!;

describe('cupPoints', () => {
  it('gives 5 for 1st down to 1 for 5th, and nothing below', () => {
    expect([1, 2, 3, 4, 5, 6, 12].map(cupPoints)).toEqual([5, 4, 3, 2, 1, 0, 0]);
  });
});

describe('buildCupStandings', () => {
  const cfg = cup(
    { a: 'newcomer-novice', b: 'newcomer-novice', c: 'elementary-prelim' },
    {
      solo1: 'solo',
      duo1: 'duo',
      team1: 'team',
      team2: 'team',
    },
  );

  it('scores solo, duo and team, counting only the best team event', () => {
    const s = buildCupStandings(cfg, [
      event('solo1', 'solo', { a: 1, b: 2 }),
      event('duo1', 'duo', { 'a+x': 3, 'b+y': 1 }),
      event('team1', 'team', { a: 4, b: 5 }),
      event('team2', 'team', { a: 2 }),
    ]);
    const a = row(s, 'a');
    expect(a.solo.counted).toMatchObject({ place: 1, points: 5 });
    expect(a.duo.counted).toMatchObject({ place: 3, points: 3 });
    expect(a.team.counted).toMatchObject({ eventId: 'team2', place: 2, points: 4 });
    expect(a.team.notCounted.map((p) => p.eventId)).toEqual(['team1']);
    expect(a.total).toBe(12);
    expect(row(s, 'b').total).toBe(4 + 5 + 1);
  });

  it('gives a duo’s points to the partner only if they are an entrant', () => {
    const s = buildCupStandings(cup({ a: 'newcomer-novice', b: 'newcomer-novice' }, { duo1: 'duo' }), [
      event('duo1', 'duo', { 'a+b': 2, 'x+y': 1 }),
    ]);
    expect(row(s, 'a').duo.counted?.points).toBe(4);
    expect(row(s, 'b').duo.counted?.points).toBe(4);
    expect(s.categories.flatMap((c) => c.ranked)).toHaveLength(2);
  });

  it('gives the full points for a shared place', () => {
    const s = buildCupStandings(cup({ a: 'newcomer-novice', b: 'newcomer-novice' }, { solo1: 'solo' }), [
      event('solo1', 'solo', { a: 2, b: 2 }, { tied: ['a', 'b'] }),
    ]);
    expect(row(s, 'a').solo.counted).toMatchObject({ place: 2, tied: true, points: 4 });
    expect(row(s, 'b').solo.counted?.points).toBe(4);
  });

  it('scores a Mix & Match event like the other parts', () => {
    const s = buildCupStandings(cup({ a: 'newcomer-novice' }, { mm: 'mixmatch' }), [
      event('mm', 'mixmatch', { a: 1 }),
    ]);
    expect(row(s, 'a').mixmatch.counted).toMatchObject({ eventId: 'mm', place: 1, points: 5 });
    expect(row(s, 'a').total).toBe(5);
  });

  it('ignores events that are not tagged', () => {
    const s = buildCupStandings(cup({ a: 'newcomer-novice' }, { solo1: 'solo' }), [
      event('solo1', 'solo', { a: 1 }),
      event('other', 'solo', { a: 1 }),
    ]);
    expect(row(s, 'a').total).toBe(5);
  });

  it('counts the best of two events in the same part and lists the other as not counted', () => {
    const s = buildCupStandings(cup({ a: 'newcomer-novice' }, { s1: 'solo', s2: 'solo' }), [
      event('s1', 'solo', { a: 3 }),
      event('s2', 'solo', { a: 1 }),
    ]);
    expect(row(s, 'a').solo.counted?.eventId).toBe('s2');
    expect(row(s, 'a').solo.notCounted.map((p) => p.eventId)).toEqual(['s1']);
  });

  it('marks results provisional and the part pending while an event is incomplete', () => {
    const s = buildCupStandings(cup({ a: 'newcomer-novice' }, { solo1: 'solo' }), [
      event('solo1', 'solo', { a: 1 }, { complete: false }),
    ]);
    expect(s.provisional).toBe(true);
    expect(row(s, 'a').solo.pending).toEqual(['solo1']);
    expect(row(s, 'a').total).toBe(0);
  });

  describe('ranking within each category', () => {
    it('has one winner per category and no overall ranking', () => {
      const s = buildCupStandings(cfg, [event('solo1', 'solo', { a: 1, b: 2, c: 3 })]);
      expect(cat(s, 'newcomer-novice').winners).toEqual(['a']);
      expect(cat(s, 'elementary-prelim').winners).toEqual(['c']);
      expect(cat(s, 'inter-bronze-up').winners).toEqual([]);
    });

    const two = (roles: Record<string, CupRole>) =>
      cup({ a: 'newcomer-novice', b: 'newcomer-novice' }, roles);

    it('breaks a tie on points by the Mix and Match result first', () => {
      // a: solo 3rd (3) + trio 2nd (4) = 7; b: solo 1st (5) + trio 4th (2) = 7
      const s = buildCupStandings(two({ solo1: 'solo', mm: 'mixmatch' }), [
        event('solo1', 'solo', { a: 3, b: 1 }),
        event('mm', 'mixmatch', { a: 2, b: 4 }),
      ]);
      expect(cat(s, 'newcomer-novice').ranked.map((r) => r.skaterId)).toEqual(['a', 'b']);
      expect(row(s, 'a')).toMatchObject({ rank: 1, tied: false, levelOnTotal: true, decidedBy: 'mixmatch' });
      expect(cat(s, 'newcomer-novice').winners).toEqual(['a']);
    });

    it('then by the solo result when the trio results are level', () => {
      // both 9 points with trio 3rd (3): a solo 2nd (4) + duo 4th (2); b solo 1st (5) + duo 5th (1)
      const s = buildCupStandings(two({ solo1: 'solo', duo1: 'duo', mm: 'mixmatch' }), [
        event('mm', 'mixmatch', { a: 3, b: 3 }, { tied: ['a', 'b'] }),
        event('solo1', 'solo', { a: 2, b: 1 }),
        event('duo1', 'duo', { a: 4, b: 5 }),
      ]);
      expect(cat(s, 'newcomer-novice').ranked.map((r) => r.skaterId)).toEqual(['b', 'a']);
      expect(row(s, 'b')).toMatchObject({ rank: 1, decidedBy: 'solo' });
    });

    it('then by the duo result when the solo results are level', () => {
      // both 9 points: solo 3rd (3) each; a duo 1st (5) + team 5th (1); b duo 3rd (3) + team 3rd (3)
      const s = buildCupStandings(two({ solo1: 'solo', duo1: 'duo', team1: 'team' }), [
        event('solo1', 'solo', { a: 3, b: 3 }, { tied: ['a', 'b'] }),
        event('duo1', 'duo', { a: 1, b: 3 }),
        event('team1', 'team', { a: 5, b: 3 }),
      ]);
      expect(cat(s, 'newcomer-novice').ranked.map((r) => r.skaterId)).toEqual(['a', 'b']);
      expect(row(s, 'a')).toMatchObject({ rank: 1, tied: false, decidedBy: 'duo' });
    });

    it('does not mention a tie-break for entrants whose totals differ', () => {
      const s = buildCupStandings(two({ solo1: 'solo' }), [event('solo1', 'solo', { a: 1, b: 2 })]);
      expect(row(s, 'a')).toMatchObject({ levelOnTotal: false, decidedBy: undefined });
    });

    it('shares the rank when still level after every tie-break', () => {
      const s = buildCupStandings(
        cup({ a: 'newcomer-novice', b: 'newcomer-novice', c: 'newcomer-novice' }, { solo1: 'solo' }),
        [event('solo1', 'solo', { a: 1, b: 1, c: 3 }, { tied: ['a', 'b'] })],
      );
      const ranked = cat(s, 'newcomer-novice').ranked;
      expect(ranked.map((r) => [r.skaterId, r.rank, r.tied])).toEqual([
        ['a', 1, true],
        ['b', 1, true],
        ['c', 3, false],
      ]);
      expect(cat(s, 'newcomer-novice').winners).toEqual(['a', 'b']);
      expect(row(s, 'a').decidedBy).toBeUndefined();
    });
  });
});
