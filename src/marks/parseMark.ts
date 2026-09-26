export type ParseResult =
  | { ok: true; tenths: number | null } // null = cleared
  | { ok: false; error: string };

/**
 * Parses a keyed-in mark into integer tenths (0–100).
 *
 * Fast-entry shorthand (no decimal point needed):
 *   "5"   -> 5.0     "57" -> 5.7     "05" -> 0.5
 *   "10"  -> 10.0    "100" -> 10.0
 * Explicit decimals: "5.7", "5,7", ".5", "5." are accepted.
 */
export function parseMark(raw: string): ParseResult {
  const s = raw.trim().replace(',', '.');
  if (s === '') return { ok: true, tenths: null };

  if (/^\d+$/.test(s)) {
    if (s === '10' || s === '100') return { ok: true, tenths: 100 };
    if (s.length === 1) return { ok: true, tenths: Number(s) * 10 };
    if (s.length === 2) return { ok: true, tenths: Number(s) };
    return { ok: false, error: 'Mark must be between 0.0 and 10.0' };
  }

  const m = /^(\d{0,2})\.(\d?)$/.exec(s);
  if (!m || (m[1] === '' && m[2] === '')) {
    if (/^\d*\.\d{2,}$/.test(s)) return { ok: false, error: 'Only one decimal place allowed' };
    return { ok: false, error: 'Not a valid mark' };
  }
  const tenths = Number(m[1] || '0') * 10 + Number(m[2] || '0');
  if (tenths > 100) return { ok: false, error: 'Mark must be between 0.0 and 10.0' };
  return { ok: true, tenths };
}

/**
 * True when no further keystroke could make a different valid mark, so the grid can
 * auto-advance: "57", "5.7", "100", "10.0". Not "5" (could be "57") or "10" (could be "100").
 */
export function isCompleteMark(raw: string): boolean {
  const s = raw.trim().replace(',', '.');
  if (/^\d{2}$/.test(s)) return s !== '10';
  if (s === '100') return true;
  return /^\d{0,2}\.\d$/.test(s) && parseMark(s).ok;
}

/** Characters allowed while typing a mark. */
export const MARK_CHARS = /^[0-9.,]*$/;

export function formatTenths(tenths: number | null | undefined): string {
  if (tenths == null) return '';
  return (tenths / 10).toFixed(1);
}
