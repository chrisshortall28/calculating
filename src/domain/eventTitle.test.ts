import { describe, expect, it } from 'vitest';
import { eventNumberLabel, eventTitle, sameEventTitle } from './eventTitle';

describe('eventTitle', () => {
  it('is the name alone without a number, and number • name with one', () => {
    expect(eventTitle({ name: 'Novice Ladies' })).toBe('Novice Ladies');
    expect(eventTitle({ name: 'Novice Ladies', number: '2A' })).toBe('2A • Novice Ladies');
  });
});

describe('sameEventTitle', () => {
  it('compares the full title, ignoring case and outer spaces', () => {
    expect(sameEventTitle({ name: 'Novice Ladies' }, { name: ' novice ladies ' })).toBe(true);
    expect(
      sameEventTitle({ name: 'Novice Ladies', number: '2A' }, { name: 'Novice Ladies', number: '2a' }),
    ).toBe(true);
    expect(
      sameEventTitle({ name: 'Novice Ladies', number: '2A' }, { name: 'Novice Ladies', number: '2B' }),
    ).toBe(false);
    expect(sameEventTitle({ name: 'Novice Ladies', number: '2A' }, { name: 'Novice Ladies' })).toBe(false);
  });
});

describe('eventNumberLabel', () => {
  it('is the event number when set, otherwise the place in the running order', () => {
    expect(eventNumberLabel({ number: '13A' }, 4)).toBe('13A');
    expect(eventNumberLabel({}, 4)).toBe('4');
  });
});
