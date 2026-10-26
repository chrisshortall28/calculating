/** Builds Calculating For Windows event files for tests, following docs/legacy-format.md. */

export interface FixtureEntry {
  name: string;
  partner?: string;
  club?: string;
  /** Marks in tenths per judge, by block (0-3 compulsory, 4-5 short A/B, 6-7 free/long A/B). */
  blocks?: Record<number, number[]>;
  /** Flag a block as present with all-zero marks (an entry that did not skate). */
  emptyBlocks?: number[];
}

export interface FixtureEvent {
  competition?: string;
  venue?: string;
  date?: string;
  name: string;
  typeCode?: number;
  judges?: string[];
  referee?: string;
  compulsory?: { code: number; side?: 'l' | 'r' }[];
  hasShort?: boolean;
  hasLong?: boolean;
  /** [numerator, denominator] pairs. */
  factors?: { compulsory?: [number, number]; short?: [number, number]; long?: [number, number] };
  entries?: FixtureEntry[];
  /** Entry rows after the real ones, as the app leaves behind when entries are removed. */
  staleRows?: number;
}

const ENTRY_SIZE = 3072;

export function buildEventFile(e: FixtureEvent): Uint8Array {
  const entries = e.entries ?? [];
  const rows = entries.length + (e.staleRows ?? 0);
  // Like the real app: the last entry record is 2 bytes short.
  const b = new Uint8Array(Math.max(2360, 2362 + rows * ENTRY_SIZE - 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  text(0, 'EF');
  text(2, e.competition ?? 'Test Competition');
  text(82, e.venue ?? 'Test Venue');
  text(122, e.date ?? '9th August 2026');
  text(162, e.name);
  const judges = e.judges ?? ['Judge One', 'Judge Two', 'Judge Three'];
  b[1024] = judges.length;
  judges.forEach((j, i) => text(1026 + i * 40, j));
  if (e.referee) text(1386, e.referee);
  b[1546] = e.typeCode ?? 8;
  const compulsory = e.compulsory ?? [];
  b[1551] = compulsory.length;
  compulsory.forEach((c, k) => {
    b[1806 + 4 * k] = c.code;
    b[1806 + 4 * k + 1] = c.side === 'l' ? 0x6c : c.side === 'r' ? 0x72 : 0;
  });
  const f = e.factors ?? {};
  [b[1553], b[1554]] = f.compulsory ?? [1, 1];
  b[1597] = e.hasShort ? 1 : 0;
  b[1602] = f.short?.[1] ?? 1;
  b[1645] = e.hasLong ? 1 : 0;
  [b[1649], b[1650]] = f.long ?? [1, 1];
  b[1741] = entries.length;
  b[294] = rows;

  for (let r = 0; r < rows; r++) {
    const at = 2362 + r * ENTRY_SIZE;
    // Stale rows repeat the last real entry (without marks).
    const entry = entries[r] ?? entries[entries.length - 1]!;
    text(at, entry.name);
    if (entry.club) text(at + 40, entry.club);
    if (entry.partner) text(at + 52, entry.partner);
    if (r >= entries.length) continue;
    for (const k of entry.emptyBlocks ?? []) b[at + 301 + 186 * k] = 1;
    for (const [k, marks] of Object.entries(entry.blocks ?? {})) {
      const bo = at + 301 + 186 * Number(k);
      b[bo] = 1;
      marks.forEach((m, j) => (b[bo + 1 + j] = m));
      b[bo + 10] = marks.reduce((a, m) => a + m, 0);
    }
  }
  return b;
}
