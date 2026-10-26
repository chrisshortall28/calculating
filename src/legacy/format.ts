/** Sizes and checksums of a Calculating For Windows event file. See docs/legacy-format.md. */

export const HEADER_SIZE = 2360;
export const BLOCK_SIZE = 3072;
/** Entry blocks hold their entry's number, then the record described in readEvent.ts at this offset. */
export const BLOCK_RECORD_AT = 2;

/** The header's checksummed sections: data start and end (the CRC follows the end). */
export const HEADER_SECTIONS: [start: number, end: number][] = [
  [0, 254],
  [256, 1022],
  [1024, 2046],
  [2048, 2150],
  [2152, 2254],
  [2256, 2358],
];

/** CRC-16/ARC (polynomial 0xA001 reflected, initial value 0), as the application uses. */
export function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

/** Entry slots a dance event file has for N entries: the next multiple of 4, plus 8 spare. */
export const slotsFor = (entries: number) => 4 * Math.ceil(Math.max(entries, 1) / 4) + 8;

/** Table of victories: a header, then one row per slot (its number and one cell per slot), then the CRC. */
export const victoriesSectionSize = (slots: number) => 18 + slots * (slots + 2);
/** Results list: a header, then one 38-byte row per slot, then the CRC. */
export const RESULT_ROW_SIZE = 38;
export const RESULTS_HEADER_SIZE = 34;
export const resultsSectionLength = (slots: number) => RESULTS_HEADER_SIZE + RESULT_ROW_SIZE * slots;

export const tailSize = (slots: number) => victoriesSectionSize(slots) + resultsSectionLength(slots) + 2;
export const eventFileSize = (slots: number) => HEADER_SIZE + BLOCK_SIZE * slots + tailSize(slots);

export interface ChecksumProblem {
  where: string;
  stored: number;
  calculated: number;
}

/** Checks every checksum of a dance event file; an empty list means the application would accept it. */
export function checksumProblems(file: Uint8Array): ChecksumProblem[] {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const problems: ChecksumProblem[] = [];
  const check = (where: string, start: number, end: number) => {
    if (end + 2 > file.length) return problems.push({ where, stored: -1, calculated: -1 });
    const stored = view.getUint16(end, true);
    const calculated = crc16(file.subarray(start, end));
    if (stored !== calculated) problems.push({ where, stored, calculated });
  };
  for (const [start, end] of HEADER_SECTIONS) check(`header ${start}-${end}`, start, end);
  let slots = 0;
  while (slots < 200 && eventFileSize(slots + 1) <= file.length) slots++;
  if (eventFileSize(slots) !== file.length) {
    problems.push({ where: `file size ${file.length} fits no number of slots`, stored: -1, calculated: -1 });
  }
  for (let k = 0; k < slots; k++) {
    const start = HEADER_SIZE + BLOCK_SIZE * k;
    check(`entry block ${k}`, start, start + BLOCK_SIZE - 2);
  }
  return problems;
}
