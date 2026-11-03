/**
 * The header bytes of a Solo Dance event that no field of the event decides: the "EF" signature,
 * the settings the application sets for the event's kind, and bytes that are the same in every
 * file. All the other header bytes are zero, set from the event, or follow from the file's size
 * (see write.ts). Found by zeroing every known field in all 74 dance events of a real competition
 * (exactly two distinct headers remain, for events with compulsory dances and for free dance
 * events) and in a combined event: the two together.
 */
type Constants = [offset: number, value: number][];

const COMMON: Constants = [
  [0, 69],
  [1, 70], // "EF"
  [243, 1],
  [245, 1],
  [249, 3],
  [250, 82],
  [251, 3],
  [257, 3],
  [265, 1],
  [273, 1],
  [277, 4],
  [281, 4],
  [284, 56],
  [285, 9],
  [297, 12],
  [300, 64],
  [302, 8],
  [304, 192],
  [306, 8],
  [308, 64],
  [309, 1],
  [310, 4],
  [581, 8],
  [584, 104],
  [596, 104],
  [597, 8],
  [600, 104],
  [604, 1],
  [612, 208],
  [613, 8],
  [616, 104],
  [620, 2],
  [1546, 8], // event type: Solo Dance
  [1547, 6],
  [1548, 1],
  [1554, 1],
  [1599, 1],
  [1602, 1],
  [1647, 1],
  [1650, 1],
  [2154, 1],
  [2258, 2],
];

/**
 * The parts of an event the application keeps tables for, by its code. A dance event has the
 * compulsory dances (1), the free dance (3), and both together (6). A figures event has the figures (1),
 * the short programme (2), the long programme (3), figures and short (4), short and long (5), and all
 * three (6).
 */
export type PhaseCode = 1 | 2 | 3 | 4 | 5 | 6;

/** What a phase adds up: the compulsory dances or figures (C), the short programme (S), the free dance or long programme (L). */
export type Part = 'C' | 'S' | 'L';

export type DanceKind = 'compulsory' | 'free' | 'combined';

export interface EventProfile {
  constants: Constants;
  /** Where the start-order lists begin (entry numbers 1, 2, 3 ...), one for each kind of part. */
  startOrderAt: number[];
  /** The phases whose tables the file holds, in the order they are stored. */
  phases: PhaseCode[];
  /** The parts each phase adds up. */
  parts: Partial<Record<PhaseCode, Part[]>>;
  /** The parts whose "has this part" flag is set in each entry's record (at offsets 268, 269 and 270). */
  entryParts: Part[];
  /** Where each part's factor is kept: the numerator's and the denominator's offsets. */
  factorAt: Partial<Record<Part, [numerator: number, denominator: number]>>;
}

const COMPULSORY: Constants = [
  [1549, 1],
  [1553, 1],
];
const FREE: Constants = [
  [1645, 1],
  [1649, 1],
];

const DANCE_PARTS: EventProfile['parts'] = { 1: ['C'], 3: ['L'], 6: ['C', 'L'] };
const DANCE_FACTOR_AT: EventProfile['factorAt'] = { L: [1649, 1650] };

export const DANCE_PROFILES: Record<DanceKind, EventProfile> = {
  compulsory: {
    constants: [...COMMON, ...COMPULSORY],
    startOrderAt: [2054],
    phases: [1],
    parts: DANCE_PARTS,
    factorAt: {},
    entryParts: ['C', 'S', 'L'],
  },
  free: {
    constants: [...COMMON, ...FREE],
    startOrderAt: [2262],
    phases: [3],
    parts: DANCE_PARTS,
    factorAt: DANCE_FACTOR_AT,
    entryParts: ['C', 'S', 'L'],
  },
  combined: {
    constants: [...COMMON, ...COMPULSORY, ...FREE],
    startOrderAt: [2054, 2262],
    phases: [1, 6, 3],
    parts: DANCE_PARTS,
    factorAt: DANCE_FACTOR_AT,
    entryParts: ['C', 'S', 'L'],
  },
};

/** Which parts a figures event has: figures, a short programme, a long programme. */
export interface FigureParts {
  figures: boolean;
  short: boolean;
  long: boolean;
}

const FIGURE_PHASE_PARTS: Record<PhaseCode, Part[]> = {
  1: ['C'],
  2: ['S'],
  3: ['L'],
  4: ['C', 'S'],
  5: ['S', 'L'],
  6: ['C', 'S', 'L'],
};

/** The order a figures event file stores its phases in (those it has). */
const FIGURE_PHASE_ORDER: PhaseCode[] = [1, 4, 6, 2, 5, 3];

/**
 * The part combinations of a figures event the writer is checked against real files for: figures
 * alone, figures and short, short and long, and all three. Others (a single programme, figures and long)
 * are not known well enough.
 */
export function figuresSupported({ figures, short, long }: FigureParts): boolean {
  return (figures && !long) || (short && long) || (figures && short && long);
}

/** The header and tables of a Single (or, with `pairs`, Pairs) event with these parts. */
export function figuresProfile(parts: FigureParts, pairs: boolean): EventProfile {
  const has: Record<Part, boolean> = { C: parts.figures, S: parts.short, L: parts.long };
  const phases = FIGURE_PHASE_ORDER.filter((phase) => FIGURE_PHASE_PARTS[phase].every((part) => has[part]));
  return {
    constants: [
      ...COMMON.filter(([offset]) => offset !== 1546),
      [1546, pairs ? 1 : 0], // event type: Pairs, Single
      ...(has.C ? ([[1549, 1]] as Constants) : []),
      ...(has.S ? ([[1597, 1]] as Constants) : []),
      ...(has.L ? ([[1645, 1]] as Constants) : []),
    ],
    startOrderAt: [...(has.C ? [2054] : []), ...(has.S ? [2158] : []), ...(has.L ? [2262] : [])],
    phases,
    parts: FIGURE_PHASE_PARTS,
    // The long programme's flag is also set with a short programme alone.
    entryParts: (['C', 'S', 'L'] as const).filter((part) => has[part] || (part === 'L' && has.S)),
    factorAt: {
      ...(has.C ? { C: [1553, 1554] as [number, number] } : {}),
      ...(has.S ? { S: [1601, 1602] as [number, number] } : {}),
      ...(has.L ? { L: [1649, 1650] as [number, number] } : {}),
    },
  };
}
