export type Direction = 'down' | 'across';
export interface Cell {
  row: number;
  col: number;
}

/**
 * The next cell in entry order. Columns come in per-judge groups of `groupSize` (e.g. A and B
 * for a free dance).
 *  - 'down' follows one judge's sheet: across the judge's group, then the next row; after the
 *    last row, on to the next judge.
 *  - 'across' walks a whole row then the next row.
 * Returns null past the last cell.
 */
export function stepCell(
  { row, col }: Cell,
  dir: Direction,
  rows: number,
  cols: number,
  backwards = false,
  groupSize = 1,
): Cell | null {
  const size = rows * cols;
  const g = groupSize;
  const block = rows * g;
  const idx = dir === 'down' ? Math.floor(col / g) * block + row * g + (col % g) : row * cols + col;
  const next = idx + (backwards ? -1 : 1);
  if (next < 0 || next >= size) return null;
  if (dir === 'across') return { row: Math.floor(next / cols), col: next % cols };
  const rem = next % block;
  return { row: Math.floor(rem / g), col: Math.floor(next / block) * g + (rem % g) };
}

/** Arrow-key movement, clamped to the grid. */
export function arrowCell({ row, col }: Cell, key: string, rows: number, cols: number): Cell | null {
  const moves: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const m = moves[key];
  if (!m) return null;
  const r = row + m[0];
  const c = col + m[1];
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return { row: r, col: c };
}
