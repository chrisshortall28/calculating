import { describe, expect, it } from 'vitest';
import { analysePaste, parsePastedList, type PasteColumn } from './pasteList';

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

describe('spreadsheet pastes with a header row', () => {
  const sheet =
    'First Name\tSurname\tAge\tClub\nAmy\tAnkers\t25\tMedway\nBaloo\tAloobs\t64\tMidway\nCongo\tBongo\t22\tMadway';

  it('joins first name and surname, skips the Age column and takes the club', () => {
    const rows = parsePastedList(sheet, 'solo');
    expect(rows).toEqual([
      { names: ['Amy Ankers'], teamName: '', club: 'Medway', error: undefined },
      { names: ['Baloo Aloobs'], teamName: '', club: 'Midway', error: undefined },
      { names: ['Congo Bongo'], teamName: '', club: 'Madway', error: undefined },
    ]);
  });

  it('reads the columns from the header whatever their order or spelling', () => {
    const rows = parsePastedList('Club Name\tLast name\tAge\tForename\nRiverside\tSmith\t9\tJane', 'solo');
    expect(rows[0]).toMatchObject({ names: ['Jane Smith'], club: 'Riverside' });
    expect(parsePastedList('Skater\tClub\nJane Smith\tCity', 'solo')[0]).toMatchObject({
      names: ['Jane Smith'],
      club: 'City',
    });
  });

  it('reports the columns it found', () => {
    expect(analysePaste(sheet, 'solo')).toEqual({
      header: ['First Name', 'Surname', 'Age', 'Club'],
      columns: ['first', 'surname', 'ignore', 'club'],
      sample: ['Amy', 'Ankers', '25', 'Medway'],
    });
    expect(analysePaste('Jane Smith, City', 'solo')).toBeUndefined();
  });

  it('lets the columns be chosen when there is no header', () => {
    const text = 'Amy\tAnkers\t25\tMedway\nBaloo\tAloobs\t64\tMidway';
    const table = analysePaste(text, 'solo')!;
    expect(table.header).toBeUndefined();
    expect(table.columns).toEqual(['name', 'club', 'ignore', 'ignore']); // the usual guess: wrong for this sheet
    const chosen: PasteColumn[] = ['first', 'surname', 'ignore', 'club'];
    expect(parsePastedList(text, 'solo', chosen).map((r) => [r.names[0], r.club])).toEqual([
      ['Amy Ankers', 'Medway'],
      ['Baloo Aloobs', 'Midway'],
    ]);
  });

  it('reads a team column as the club for skaters but as the entry for teams', () => {
    expect(parsePastedList('Name\tTeam\nJane Smith\tCity', 'solo')[0]).toMatchObject({ club: 'City' });
    expect(parsePastedList('Team\tClub\nCity Flyers\tCity RSC', 'team')[0]).toMatchObject({
      teamName: 'City Flyers',
      club: 'City RSC',
    });
  });

  it('reads partners from their own columns for duos and pairs', () => {
    const rows = parsePastedList(
      'First Name\tSurname\tPartner First Name\tPartner Surname\tClub\nAnn\tLee\tBob\tRay\tCity\nCat\tDay\t\t\tTown',
      'duo',
    );
    expect(rows[0]).toMatchObject({ names: ['Ann Lee', 'Bob Ray'], club: 'City', error: undefined });
    expect(rows[1]!.error).toMatch(/two skaters/);
    expect(parsePastedList('Name\tPartner\tClub\nAnn Lee\tBob Ray\tCity', 'pairs')[0]).toMatchObject({
      names: ['Ann Lee', 'Bob Ray'],
    });
  });

  it('keeps a list with no recognised header, and a line of a name and a club, as before', () => {
    expect(
      parsePastedList('Jane Smith\tCity\nAmy Jones\tTown', 'solo').map((r) => [r.names[0], r.club]),
    ).toEqual([
      ['Jane Smith', 'City'],
      ['Amy Jones', 'Town'],
    ]);
    // A header on its own has no entries.
    expect(parsePastedList('First Name	Club', 'solo')).toEqual([]);
  });
});
