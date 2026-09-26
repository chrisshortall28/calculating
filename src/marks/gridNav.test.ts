import { describe, expect, it } from 'vitest';
import { arrowCell, stepCell } from './gridNav';

describe('stepCell', () => {
  it('walks down a column then to the top of the next', () => {
    expect(stepCell({ row: 0, col: 0 }, 'down', 3, 2)).toEqual({ row: 1, col: 0 });
    expect(stepCell({ row: 2, col: 0 }, 'down', 3, 2)).toEqual({ row: 0, col: 1 });
    expect(stepCell({ row: 2, col: 1 }, 'down', 3, 2)).toBeNull();
    expect(stepCell({ row: 0, col: 1 }, 'down', 3, 2, true)).toEqual({ row: 2, col: 0 });
  });

  it('follows a judge sheet for grouped columns (free dance A/B)', () => {
    // 2 rows, 2 judges × (A, B) = 4 cols
    expect(stepCell({ row: 0, col: 0 }, 'down', 2, 4, false, 2)).toEqual({ row: 0, col: 1 });
    expect(stepCell({ row: 0, col: 1 }, 'down', 2, 4, false, 2)).toEqual({ row: 1, col: 0 });
    expect(stepCell({ row: 1, col: 1 }, 'down', 2, 4, false, 2)).toEqual({ row: 0, col: 2 });
    expect(stepCell({ row: 0, col: 2 }, 'down', 2, 4, true, 2)).toEqual({ row: 1, col: 1 });
    expect(stepCell({ row: 1, col: 3 }, 'down', 2, 4, false, 2)).toBeNull();
  });

  it('walks across a row then to the start of the next', () => {
    expect(stepCell({ row: 0, col: 1 }, 'across', 3, 2)).toEqual({ row: 1, col: 0 });
    expect(stepCell({ row: 1, col: 0 }, 'across', 3, 2, true)).toEqual({ row: 0, col: 1 });
    expect(stepCell({ row: 0, col: 0 }, 'across', 3, 2, true)).toBeNull();
  });
});

describe('arrowCell', () => {
  it('moves and clamps', () => {
    expect(arrowCell({ row: 1, col: 1 }, 'ArrowUp', 3, 3)).toEqual({ row: 0, col: 1 });
    expect(arrowCell({ row: 0, col: 0 }, 'ArrowLeft', 3, 3)).toBeNull();
    expect(arrowCell({ row: 0, col: 0 }, 'x', 3, 3)).toBeNull();
  });
});
