import { describe, expect, it } from 'vitest';
import { startsWithFilter } from './nameFilter';

const options = ['Ann Marie Smith', 'Marie Jones', 'anna Lee', 'Bea'].map((n) => ({ value: n, label: n }));
const match = (search: string) =>
  (startsWithFilter({ options, search, limit: 100 }) as typeof options).map((o) => o.label);

describe('startsWithFilter', () => {
  it('matches the start of the name, ignoring case', () => {
    expect(match('an')).toEqual(['Ann Marie Smith', 'anna Lee']);
    expect(match('ANN ')).toEqual(['Ann Marie Smith', 'anna Lee']);
  });
  it('does not match text further into the name', () => {
    expect(match('marie')).toEqual(['Marie Jones']);
    expect(match('smith')).toEqual([]);
  });
  it('lists everything for an empty search', () => {
    expect(match('')).toHaveLength(4);
  });
});
