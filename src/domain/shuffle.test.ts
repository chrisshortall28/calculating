import { describe, expect, it } from 'vitest';
import { shuffled } from './shuffle';

describe('shuffled', () => {
  it('keeps every item exactly once and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is driven by the random source', () => {
    expect(shuffled(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    expect(shuffled(['a', 'b', 'c'], () => 0.999)).toEqual(['a', 'b', 'c']);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled(['x'])).toEqual(['x']);
  });
});
