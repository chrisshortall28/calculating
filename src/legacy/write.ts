import {
  BLOCK_RECORD_AT,
  BLOCK_SIZE,
  crc16,
  eventFileSize,
  HEADER_SECTIONS,
  HEADER_SIZE,
  phaseTailSize,
  RESULT_ROW_SIZE,
  resultsSectionLength,
  slotsFor,
  victoriesSectionSize,
} from './format';
import { DANCE_PROFILES, type DanceKind, type PhaseCode } from './profiles';
import type { Tail } from './tail';

export interface WriteEntry {
  name: string;
  club: string;
  /** Marks in tenths per judge, by block: 0-3 compulsory dances, 6-7 free dance A and B; null = none. */
  blocks: (number[] | null)[];
}

export interface WriteEvent {
  competition: string;
  venue: string;
  /** Free text, as the application shows it. */
  date: string;
  name: string;
  judges: string[];
  referee: string;
  kind: DanceKind;
  /** The application's dance numbers, one per compulsory dance (up to 4). */
  dances: number[];
  entries: WriteEntry[];
  /**
   * The free dance's weight in a combined event as a fraction (the application's own default is 1/2;
   * 1/1 is what the CIPA manual says: no factoring in dance). Default 1/1.
   */
  freeFactor?: [numerator: number, denominator: number];
  /** The tables of each phase the kind has (see profiles.ts). */
  tails: Partial<Record<PhaseCode, Tail>>;
}

export const MAX_JUDGES = 9;
export const MAX_DANCES = 4;
export const MAX_NAME = 40;
export const MAX_CLUB = 8;

/** Writes a Solo Dance event file the application opens (every checksum correct). */
export function writeDanceEvent(event: WriteEvent): Uint8Array {
  const N = event.entries.length;
  const slots = slotsFor(N);
  const profile = DANCE_PROFILES[event.kind];
  const size = eventFileSize(slots, profile.phases.length);
  const file = new Uint8Array(size);
  const view = new DataView(file.buffer);
  const text = (at: number, value: string, length: number) => {
    for (let i = 0; i < Math.min(value.length, length); i++) file[at + i] = value.charCodeAt(i) & 0xff;
  };

  // Header: the kind's constants, the event's fields, then what follows from the file's size.
  for (const [offset, value] of profile.constants) file[offset] = value;
  text(2, event.competition, 40);
  text(82, event.venue, 40);
  text(122, event.date, 40);
  text(162, event.name, 40);
  file[294] = N;
  file[1741] = N;
  file[1024] = event.judges.length;
  event.judges.forEach((judge, i) => text(1026 + 40 * i, judge, 40));
  text(1386, event.referee, 40);
  const [factorNumerator, factorDenominator] = event.freeFactor ?? [1, 1];
  if (event.kind !== 'compulsory') [file[1649], file[1650]] = [factorNumerator, factorDenominator];
  file[1551] = event.dances.length;
  event.dances.forEach((code, k) => (file[1806 + 4 * k] = code));
  for (const at of profile.startOrderAt) for (let i = 0; i < N; i++) file[at + i] = i + 1;

  const tailAt = HEADER_SIZE + BLOCK_SIZE * slots;
  const victoriesSize = victoriesSectionSize(slots);
  const resultsLength = resultsSectionLength(slots);
  // Where a phase's table of victories starts: later phases follow two zero bytes.
  const victoriesAtPhase = (index: number) => tailAt + index * (phaseTailSize(slots) + 2);
  view.setUint32(260, size + 2, true);
  view.setUint16(289, 12 * slots, true);
  file[292] = slots;
  // Each phase has two 16-byte descriptors in the header (results, then victories) saying where its tables are.
  profile.phases.forEach((phase, index) => {
    const results = 324 + 16 * (phase - 1);
    const victories = results + 128;
    const start = victoriesAtPhase(index);
    view.setUint32(results, start + victoriesSize + 2, true);
    view.setUint16(results + 4, resultsLength, true);
    file[results + 8] = phase;
    view.setUint32(victories, start, true);
    view.setUint16(victories + 4, victoriesSize, true);
    file[victories + 8] = phase;
  });
  for (const [start, end] of HEADER_SECTIONS) view.setUint16(end, crc16(file.subarray(start, end)), true);

  // Entry blocks: the entry's number, its record, and the checksum.
  const judges = event.judges.length;
  event.entries.forEach((entry, r) => {
    const block = HEADER_SIZE + BLOCK_SIZE * r;
    const record = block + BLOCK_RECORD_AT;
    view.setUint16(block, r, true);
    text(record, entry.name, 40);
    text(record + 40, entry.club, 12);
    file.fill(1, record + 268, record + 271);
    entry.blocks.forEach((marks, k) => {
      if (!marks) return;
      const at = record + 301 + 186 * k;
      file[at] = 1;
      marks.forEach((m, j) => (file[at + 1 + j] = m));
      file[at + 10] = marks.reduce((a, m) => a + m, 0);
    });
    // The judges' sums (thousandths) for each phase: 45 bytes a phase from the record's offset 2161.
    const sums = (phase: PhaseCode, parts: (number[] | null)[], free: (number[] | null)[] = []) => {
      const at = record + 2161 + 45 * (phase - 1);
      file[at] = 1;
      let total = 0;
      for (let j = 0; j < judges; j++) {
        const marks = (list: (number[] | null)[]) => list.reduce((a, m) => a + (m?.[j] ?? 0), 0);
        // In thousandths of a mark; the free dance counts at its factor in the combined sum.
        const sum = Math.round(
          100 * marks(parts) + (100 * marks(free) * factorNumerator) / factorDenominator,
        );
        view.setUint32(at + 1 + 4 * j, sum, true);
        total += sum;
      }
      view.setUint32(at + 41, total, true);
    };
    const compulsory = entry.blocks.slice(0, event.dances.length);
    const free = [entry.blocks[6] ?? null, entry.blocks[7] ?? null];
    for (const phase of profile.phases) {
      if (phase === 1) sums(phase, compulsory);
      else if (phase === 3) sums(phase, free);
      else sums(phase, compulsory, free);
    }
  });
  for (let r = 0; r < slots; r++) {
    const block = HEADER_SIZE + BLOCK_SIZE * r;
    view.setUint16(block + BLOCK_SIZE - 2, crc16(file.subarray(block, block + BLOCK_SIZE - 2)), true);
  }

  // Tail: for each phase, the table of victories then the results in order of place.
  profile.phases.forEach((phase, index) => {
    const tail = event.tails[phase];
    if (!tail) throw new Error(`No tables for phase ${phase}`);
    const victoriesAt = victoriesAtPhase(index);
    [victoriesSize, phase, slots, slots, slots + 2, slots, slots].forEach((word, i) =>
      view.setUint16(victoriesAt + 2 * i, word, true),
    );
    for (let r = 0; r < slots; r++) {
      const row = victoriesAt + 16 + r * (slots + 2);
      view.setUint16(row, r, true);
      if (r < N) tail.victories[r]!.forEach((v, c) => (file[row + 2 + c] = v));
    }
    view.setUint16(
      victoriesAt + victoriesSize - 2,
      crc16(file.subarray(victoriesAt, victoriesAt + victoriesSize - 2)),
      true,
    );
    const resultsAt = victoriesAt + victoriesSize;
    [0, resultsLength, phase, slots, slots, RESULT_ROW_SIZE, slots, slots, 1, N, 0, phase].forEach(
      (word, i) => view.setUint16(resultsAt + 2 * i, word, true),
    );
    tail.rows.forEach((row, i) => {
      const at = resultsAt + 34 + RESULT_ROW_SIZE * i;
      [
        row.entry,
        row.ruleCode,
        row.place,
        row.majorityTenths,
        row.separateTenths,
        row.bMarkTenths,
        0,
        row.totalVictoriesTenths,
        Math.floor(row.sum / 1000),
        row.sum % 1000,
        0,
        0,
        row.steps,
      ].forEach((word, w) => view.setUint16(at + 2 * w, word, true));
    });
    view.setUint16(
      resultsAt + resultsLength,
      crc16(file.subarray(resultsAt, resultsAt + resultsLength)),
      true,
    );
  });
  return file;
}
