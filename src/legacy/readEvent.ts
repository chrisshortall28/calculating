import type {
  LegacyBlocks,
  LegacyCompulsory,
  LegacyEntry,
  LegacyEvent,
  LegacyFraction,
  LegacyWarning,
} from './types';

/** Thrown when a file is not a Calculating For Windows event file. */
export class LegacyFormatError extends Error {}

const HEADER_SIZE = 2360;
const ENTRIES_AT = 2362;
const ENTRY_SIZE = 3072;
const BLOCK_AT = 301;
const BLOCK_SIZE = 186;
const BLOCKS = 8;
const MAX_JUDGES = 9;
const MAX_COMPULSORY = 4;

const TEXT = 40;
const CLUB_AT = 40;
const CLUB_LENGTH = 12;
const PARTNER_AT = 52;

const KIND = { 8: 'dance', 7: 'couples', 0: 'single', 1: 'pairs' } as const;

const ascii = (b: Uint8Array, at: number, length: number) => {
  let end = at;
  while (end < at + length && b[end] !== 0) end++;
  let s = '';
  for (let i = at; i < end; i++) s += String.fromCharCode(b[i]!);
  return s.trim();
};

const fraction = (n: number, d: number): LegacyFraction => ({ numerator: n, denominator: d });

/** Reads one `DATAnnnB.ROL` event file. */
export function readLegacyEvent(fileName: string, b: Uint8Array): LegacyEvent {
  if (b.length < HEADER_SIZE || b[0] !== 0x45 || b[1] !== 0x46) {
    throw new LegacyFormatError(`${fileName} is not a Calculating For Windows event file.`);
  }
  const warnings: LegacyWarning[] = [];
  const name = ascii(b, 162, TEXT);
  const note = (message: string, level: LegacyWarning['level'] = 'warning') =>
    warnings.push({ level, event: name || fileName, message });

  const typeCode = b[1546]!;
  const kind = KIND[typeCode as keyof typeof KIND] ?? 'unsupported';

  const judgeCount = Math.min(b[1024]!, MAX_JUDGES);
  const judges = Array.from(
    { length: judgeCount },
    (_, i) => ascii(b, 1026 + i * TEXT, TEXT) || `Judge ${i + 1}`,
  );

  const compulsory: LegacyCompulsory[] = [];
  for (let k = 0; k < Math.min(b[1551]!, MAX_COMPULSORY); k++) {
    const side = b[1806 + 4 * k + 1];
    compulsory.push({
      code: b[1806 + 4 * k]!,
      ...(side === 0x6c ? { side: 'L' as const } : side === 0x72 ? { side: 'R' as const } : {}),
    });
  }

  const entryCount = b[1741]!;
  const entries: LegacyEntry[] = [];
  for (let r = 0; r < entryCount; r++) {
    const at = ENTRIES_AT + r * ENTRY_SIZE;
    // The last entry record is stored 2 bytes short, so only require the part that holds the marks.
    if (at + BLOCK_AT + BLOCK_SIZE * BLOCKS > b.length) {
      note(`The file ends before entry ${r + 1}; ${entryCount - r} entries were not read.`);
      break;
    }
    const blocks: LegacyBlocks = [];
    for (let k = 0; k < BLOCKS; k++) {
      const bo = at + BLOCK_AT + BLOCK_SIZE * k;
      const marks = Array.from({ length: judgeCount }, (_, j) => b[bo + 1 + j]!);
      // A block holds marks when flagged. An all-zero block is kept: the legacy app scores an entry that
      // did not skate as 0.0 and places it last, and the results only complete with those marks.
      blocks.push(b[bo] === 1 ? marks : null);
    }
    entries.push({
      name: ascii(b, at, TEXT),
      partner: kind === 'pairs' || kind === 'couples' ? ascii(b, at + PARTNER_AT, TEXT) : '',
      club: ascii(b, at + CLUB_AT, CLUB_LENGTH),
      blocks,
    });
  }

  return {
    fileName,
    competition: { name: ascii(b, 2, TEXT), venue: ascii(b, 82, TEXT), date: ascii(b, 122, TEXT) },
    name,
    typeCode,
    kind,
    judges,
    referee: ascii(b, 1386, TEXT),
    compulsory,
    hasShort: b[1597] === 1,
    hasLong: b[1645] === 1,
    factors: {
      compulsory: fraction(b[1553]!, b[1554]!),
      short: fraction(b[1597]!, b[1602]!),
      long: fraction(b[1649]!, b[1650]!),
    },
    entries,
    warnings,
  };
}
