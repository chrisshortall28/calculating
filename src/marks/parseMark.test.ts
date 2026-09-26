import { describe, expect, it } from 'vitest';
import { formatTenths, isCompleteMark, parseMark } from './parseMark';

describe('parseMark', () => {
  it.each([
    ['5', 50],
    ['0', 0],
    ['57', 57],
    ['05', 5],
    ['99', 99],
    ['11', 11],
    ['10', 100],
    ['100', 100],
    ['5.7', 57],
    ['5,7', 57],
    ['.5', 5],
    ['5.', 50],
    ['10.0', 100],
    ['0.0', 0],
    [' 7.3 ', 73],
  ])('%s -> %i tenths', (input, tenths) => {
    expect(parseMark(input)).toEqual({ ok: true, tenths });
  });

  it('treats empty as cleared', () => {
    expect(parseMark('  ')).toEqual({ ok: true, tenths: null });
  });

  it.each(['101', '10.1', '11.0', '5.75', '-1', 'abc', '.', '1000', '5.7.1'])('rejects %s', (input) => {
    expect(parseMark(input).ok).toBe(false);
  });
});

describe('isCompleteMark', () => {
  it.each(['57', '05', '99', '100', '5.7', '.5', '10.0', '0.0'])('%s is complete', (s) => {
    expect(isCompleteMark(s)).toBe(true);
  });
  it.each(['', '5', '1', '10', '5.', '10.', '10.5', '99.9'])('%s is not complete', (s) => {
    expect(isCompleteMark(s)).toBe(false);
  });
});

describe('formatTenths', () => {
  it('formats with one decimal', () => {
    expect(formatTenths(57)).toBe('5.7');
    expect(formatTenths(100)).toBe('10.0');
    expect(formatTenths(0)).toBe('0.0');
    expect(formatTenths(null)).toBe('');
  });
});
