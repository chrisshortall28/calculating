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
