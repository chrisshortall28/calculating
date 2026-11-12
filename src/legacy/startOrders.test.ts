import { describe, expect, it } from 'vitest';
import { convertLegacyCompetition, groupLegacyEvents } from './convert';
import { exportLegacyEvents } from './export';
import { buildEventFile, type FixtureEvent } from './fixtures';
import { readLegacyEvent } from './readEvent';
import { parseCompetitionFile } from '../io/competitionFile';

const names = ['Anna', 'Bella', 'Cara', 'Dina'];
const dance = (extra: Partial<FixtureEvent> = {}): FixtureEvent => ({
  name: 'Solo',
  compulsory: [{ code: 20 }, { code: 38 }],
  hasLong: true,
  entries: names.map((name) => ({ name, club: 'Club', blocks: { 0: [10, 10, 10] } })),
  ...extra,
});
const read = (e: FixtureEvent) => readLegacyEvent('DATA001B.ROL', buildEventFile(e));
const convert = (e: FixtureEvent) => convertLegacyCompetition(groupLegacyEvents([read(e)])[0]!).file;
type File = ReturnType<typeof convert>;
/** Entry id -> the skater's name. */
const entryNames = (file: File) => {
  const skater = new Map(file.skaters.map((s) => [s.id, s.name]));
  return new Map(file.entries.map((e) => [e.id, e.teamName ?? skater.get(e.skaterIds[0]!)!]));
};
const startOrder = (file: File) => {
  const name = entryNames(file);
  return file.entries.toSorted((a, b) => a.startOrder - b.startOrder).map((e) => name.get(e.id));
};

describe('legacy start-order lists', () => {
  it('reads a list that is a complete order of the rows, and ignores one that is not', () => {
    const event = read(dance({ startOrders: { C: [3, 1, 4, 2], L: [1, 1, 2, 3] } }));
    expect(event.startOrders).toEqual({ C: [2, 0, 3, 1] });
    expect(read(dance()).startOrders).toEqual({});
  });

  it('imports the first list as the start order, so the natural row order is overridden', () => {
    const file = convert(dance({ startOrders: { C: [3, 1, 4, 2] } }));
    expect(startOrder(file)).toEqual(['Cara', 'Anna', 'Dina', 'Bella']);
    expect(file.events[0]!.partOrders).toBeUndefined();
  });

  it('keeps the free dance order when its list differs from the compulsory one', () => {
    const file = convert(dance({ startOrders: { C: [1, 2, 3, 4], L: [4, 3, 2, 1] } }));
    const name = entryNames(file);
    expect(file.events[0]!.partOrders!.fd!.map((id) => name.get(id))).toEqual([
      'Dina',
      'Cara',
      'Bella',
      'Anna',
    ]);
    expect(parseCompetitionFile(file)).toBeTruthy();
  });

  it('does not keep a free dance order that is the same as the start order', () => {
    const file = convert(dance({ startOrders: { C: [2, 1, 3, 4], L: [2, 1, 3, 4] } }));
    expect(file.events[0]!.partOrders).toBeUndefined();
  });

  it('uses the free dance list as the start order when there are no compulsory dances', () => {
    const file = convert(dance({ compulsory: [], startOrders: { L: [2, 1, 4, 3] } }));
    expect(startOrder(file)).toEqual(['Bella', 'Anna', 'Dina', 'Cara']);
  });

  it('reads each programme of a figures event', () => {
    const file = convert({
      name: 'Singles',
      typeCode: 0,
      hasShort: true,
      hasLong: true,
      compulsory: [{ code: 1, side: 'l' }],
      entries: names.map((name) => ({ name, blocks: { 0: [10, 10, 10] } })),
      startOrders: { C: [1, 2, 3, 4], S: [2, 1, 3, 4], L: [4, 3, 2, 1] },
    });
    expect(Object.keys(file.events[0]!.partOrders!).sort()).toEqual(['lp', 'sp']);
  });

  it('writes the start order, and a part’s own order, back into the lists', () => {
    const file = convert(dance({ startOrders: { C: [3, 1, 4, 2], L: [4, 3, 2, 1] } }));
    const [out] = exportLegacyEvents(file).files;
    const again = readLegacyEvent('x', out!.data);
    // Rows are written in start order, so the compulsory list is 1..N and the free dance list says who skates when.
    const rows = again.entries.map((e) => e.name);
    expect(rows).toEqual(['Cara', 'Anna', 'Dina', 'Bella']);
    expect(again.startOrders.C).toEqual([0, 1, 2, 3]);
    expect(again.startOrders.L!.map((r) => rows[r])).toEqual(['Dina', 'Cara', 'Bella', 'Anna']);
  });

  it('turns rotating start order on for the imported competition, not for each event', () => {
    const file = convert(dance());
    expect(file.competition.rotateStartOrder).toBe(true);
    expect(file.events[0]!.rotateStartOrder).toBeUndefined();
  });
});
