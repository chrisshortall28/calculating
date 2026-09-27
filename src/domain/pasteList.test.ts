import { describe, expect, it } from 'vitest';
import { parsePastedList } from './pasteList';

describe('parsePastedList', () => {
  it('reads one skater per line with an optional club', () => {
    expect(parsePastedList('Jane Smith, Riverside RSC\n\n  Lucy   Brown  \n', 'solo')).toEqual([
      { names: ['Jane Smith'], teamName: '', club: 'Riverside RSC', error: undefined },
      { names: ['Lucy Brown'], teamName: '', club: '', error: undefined },
    ]);
  });

  it('accepts spreadsheet columns and ignores start numbers', () => {
    const [a, b] = parsePastedList('1.\tJane Smith\t\tRiverside\r\n2) Amy Jones, City, North', 'solo');
    expect(a).toMatchObject({ names: ['Jane Smith'], club: 'Riverside' });
    expect(b).toMatchObject({ names: ['Amy Jones'], club: 'City, North' });
  });

  it('splits duo partners and flags incomplete pairs', () => {
    const rows = parsePastedList(
      'Ann Lee & Bob Ray, City\nAnn Lee / Bob Ray\nAndrew and Sandy Low\nAnn Lee',
      'duo',
    );
    expect(rows.map((r) => r.names)).toEqual([
      ['Ann Lee', 'Bob Ray'],
      ['Ann Lee', 'Bob Ray'],
      ['Andrew', 'Sandy Low'],
      ['Ann Lee'],
    ]);
    expect(rows.map((r) => !!r.error)).toEqual([false, false, false, true]);
  });

  it('reads team names', () => {
    expect(parsePastedList('Riverside Stars, Riverside RSC', 'team')).toEqual([
      { names: [], teamName: 'Riverside Stars', club: 'Riverside RSC', error: undefined },
    ]);
  });

  it('flags a line with only a club', () => {
    expect(parsePastedList(', Riverside', 'solo')[0]!.error).toBeTruthy();
  });
});

describe('couples', () => {
  it('needs two skaters per line, like duos', () => {
    const [ok, bad] = parsePastedList('Ann Lee & Bob Ray, Club\nCat Day', 'couples');
    expect(ok).toMatchObject({ names: ['Ann Lee', 'Bob Ray'], club: 'Club', error: undefined });
    expect(bad!.error).toMatch(/two skaters/);
  });
});
