/**
 * Calculating For Windows' numbered list of compulsory dances (1 to 51). A dance is stored in an
 * event file as its number. Spellings follow Podium's own dance list where they differ ("14 Step"
 * is "Fourteen Step"); the rest are as the application names them.
 */
const DANCE_NAMES = [
  'Kleiner Waltz',
  'Swing Foxtrot',
  'March',
  'Palais Glide',
  'European Waltz',
  'Keats Foxtrot',
  'Fourteen Step',
  'Italian Foxtrot',
  'Harris Tango',
  'Rocker Foxtrot',
  'Blues',
  'Kilian',
  'Starlight Waltz',
  'Argentine Tango',
  'Quickstep',
  'Viennese Waltz',
  'Paso Doble',
  'Westminster Waltz',
  'Iceland Tango',
  'Siesta Tango',
  'Association Waltz',
  'Imperial Tango',
  'Tudor Waltz',
  'Denver Shuffle',
  'Flirtation Waltz',
  'Dench Blues',
  'Skaters March',
  'Canasta Tango',
  'Olympic Foxtrot',
  'Glide Waltz',
  'Country Polka',
  'Rhythm Blues',
  'Federation Foxtrot',
  'Terenzi Waltz',
  'Fourteen Step Plus',
  'Kent Tango',
  'Carlos Tango',
  'City Blues',
  'Castel March',
  'Tango Delanco',
  'Gregory Rhumba',
  'Colleigate',
  'Tango Delanca',
  'Kinder Waltz',
  'La Vista Cha Cha',
  'Werner Tango',
  'Roller Samba',
  'Easy Paso',
  'Cha Cha Patin',
  'Golden Samba',
  'Midnight Blues',
];

/** Code 0 is the application's unnamed "Dance No 1", "Dance No 2" placeholder, numbered by position. */
export function legacyDanceName(code: number, position: number): { name: string; known: boolean } {
  if (code === 0) return { name: `Dance No ${position + 1}`, known: true };
  const name = DANCE_NAMES[code - 1];
  return name ? { name, known: true } : { name: `Dance ${code}`, known: false };
}

const simple = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const CODES = new Map(DANCE_NAMES.map((name, i) => [simple(name), i + 1]));
// Podium spells the numbered dances out ("Fourteen Step"), the application with digits.
CODES.set('14step', 7).set('14stepplus', 35);

/** The application's number for a dance by name (any spelling of it), or undefined if it has none. */
export function legacyDanceCode(name: string): number | undefined {
  return CODES.get(simple(name));
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next.push(Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    row = next;
  }
  return row[b.length]!;
}

export interface DanceMatch {
  code: number;
  /** The application's name for the dance. */
  name: string;
  /** False when the name only came close (a typo or a different spelling). */
  exact: boolean;
}

/**
 * The application's dance for a name typed into Podium, which takes any text: an exact match in any
 * spelling, else the one dance the name is a slip or two away from. Undefined when none is close
 * enough (the caller then uses the application's unnamed dance).
 */
export function matchLegacyDance(name: string): DanceMatch | undefined {
  const key = simple(name);
  const exact = CODES.get(key);
  if (exact !== undefined) return { code: exact, name: DANCE_NAMES[exact - 1] ?? name, exact: true };
  const allowed = key.length >= 12 ? 2 : key.length >= 7 ? 1 : 0;
  if (allowed === 0) return undefined;
  let best: { code: number; distance: number }[] = [];
  for (const [candidate, code] of CODES) {
    const d = distance(key, candidate);
    if (d > allowed) continue;
    if (best.length === 0 || d < best[0]!.distance) best = [{ code, distance: d }];
    else if (d === best[0]!.distance) best.push({ code, distance: d });
  }
  const codes = new Set(best.map((b) => b.code));
  if (codes.size !== 1) return undefined; // nothing close, or two dances equally close
  const code = best[0]!.code;
  return { code, name: DANCE_NAMES[code - 1]!, exact: false };
}
