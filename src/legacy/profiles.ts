/**
 * The header bytes of a Solo Dance event that no field of the event decides: the "EF" signature,
 * the settings the application sets for the event's kind, and bytes that are the same in every
 * file. All the other header bytes are zero, set from the event, or follow from the file's size
 * (see write.ts). Found by zeroing every known field in all 74 dance events of a real competition:
 * exactly two distinct headers remain, one for events with compulsory dances and one for free dance
 * events.
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

export type DanceKind = 'compulsory' | 'free';

export interface DanceProfile {
  constants: Constants;
  /** Where the start-order list begins (entry numbers 1, 2, 3 ...). */
  startOrderAt: number;
  /** The first of the two 16-byte table descriptors the kind uses (the second is 128 bytes on). */
  descriptorAt: number;
}

export const DANCE_PROFILES: Record<DanceKind, DanceProfile> = {
  compulsory: {
    constants: [...COMMON, [332, 1], [460, 1], [1549, 1], [1553, 1]],
    startOrderAt: 2054,
    descriptorAt: 324,
  },
  free: {
    constants: [...COMMON, [364, 3], [492, 3], [1645, 1], [1649, 1]],
    startOrderAt: 2262,
    descriptorAt: 356,
  },
};
