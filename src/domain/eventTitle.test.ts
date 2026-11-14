import { describe, expect, it } from 'vitest';
import {
  eventNumberLabel,
  eventTitle,
  legacyEventName,
  sameEventTitle,
  splitEventNumber,
} from './eventTitle';

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

describe('legacy event names', () => {
  it('are written as the number then the name, with no bullet', () => {
    expect(legacyEventName({ name: 'Novice Ladies Solo Dance', number: '2A' })).toBe(
      '2A Novice Ladies Solo Dance',
    );
    expect(legacyEventName({ name: 'Novice Ladies Solo Dance' })).toBe('Novice Ladies Solo Dance');
  });

  it('are split into a leading event number and the name', () => {
    expect(splitEventNumber('3 Novice Ladies')).toEqual({ number: '3', name: 'Novice Ladies' });
    expect(splitEventNumber(' 2A   Junior Men ')).toEqual({ number: '2A', name: 'Junior Men' });
    expect(splitEventNumber('13a Senior Pairs')).toEqual({ number: '13a', name: 'Senior Pairs' });
  });

  it('are left alone without an obvious number at the start', () => {
    for (const name of [
      'Novice Ladies',
      'A one',
      '2nd Year Solo',
      'Under 12 Solo',
      '12',
      '2026 Open Solo',
      '3-5 Years',
    ])
      expect(splitEventNumber(name)).toEqual({ name });
  });
});

describe('eventNumberLabel', () => {
  it('is the event number when set, otherwise the place in the running order', () => {
    expect(eventNumberLabel({ number: '13A' }, 4)).toBe('13A');
    expect(eventNumberLabel({}, 4)).toBe('4');
  });
});
