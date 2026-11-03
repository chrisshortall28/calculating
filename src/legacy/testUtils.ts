import { BLOCK_SIZE, HEADER_SIZE, phaseTailSize, slotsFor, victoriesSectionSize } from './format';

/**
 * Bytes of a real file the writer does not reproduce: in a table of victories, the cells of unused
 * entries (the application leaves whatever was there, or 255 in a new event, and the table's checksum
 * follows).
 */
export function unusedCell(i: number, entries: number, phases: number): boolean {
  const slots = slotsFor(entries);
  const victories = victoriesSectionSize(slots);
  for (let p = 0; p < phases; p++) {
    const start = HEADER_SIZE + BLOCK_SIZE * slots + p * (phaseTailSize(slots) + 2);
    if (i >= start + victories - 2 && i < start + victories) return true;
    if (i >= start + 16 && i < start + victories - 2) {
      const at = i - (start + 16);
      return Math.floor(at / (slots + 2)) >= entries || (at % (slots + 2)) - 2 >= entries;
    }
  }
  return false;
}
