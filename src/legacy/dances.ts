/**
 * The compulsory dances Calculating For Windows numbers. Only the codes seen in sample files are
 * known so far (checked against the application's log); any other code imports as "Dance <code>".
 * Spellings follow Podium's own dance list where they differ ("14 Step" is "Fourteen Step").
 */
const DANCE_NAMES: Record<number, string> = {
  1: 'Kleiner Waltz',
  7: 'Fourteen Step',
  9: 'Harris Tango',
  10: 'Rocker Foxtrot',
  14: 'Argentine Tango',
  15: 'Quickstep',
  20: 'Siesta Tango',
  24: 'Denver Shuffle',
  27: 'Skaters March',
  28: 'Canasta Tango',
  29: 'Olympic Foxtrot',
  30: 'Glide Waltz',
  36: 'Kent Tango',
  38: 'City Blues',
  47: 'Roller Samba',
  48: 'Easy Paso',
};

/** Code 0 is the application's unnamed "Dance No 1", "Dance No 2" placeholder, numbered by position. */
export function legacyDanceName(code: number, position: number): { name: string; known: boolean } {
  if (code === 0) return { name: `Dance No ${position + 1}`, known: true };
  const name = DANCE_NAMES[code];
  return name ? { name, known: true } : { name: `Dance ${code}`, known: false };
}
