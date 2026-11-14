import type { CompEvent } from './types';

type Titled = Pick<CompEvent, 'name' | 'number'>;

/** Longest event number the form accepts ("13A"); it has to fit the number tile on the PDFs. */
export const MAX_EVENT_NUMBER_LENGTH = 5;

/** An event's full title: "2A • Novice Ladies Solo Dance", or just its name when it has no number. */
export const eventTitle = (e: Titled): string => (e.number ? `${e.number} • ${e.name}` : e.name);

/** Two events are the same to the Calculator when their full titles match, ignoring case and outer spaces. */
const titleKey = (e: Titled) =>
  `${(e.number ?? '').trim().toLowerCase()}\u0000${e.name.trim().toLowerCase()}`;
export const sameEventTitle = (a: Titled, b: Titled): boolean => titleKey(a) === titleKey(b);

/** An event's name in a Calculating For Windows file, which has no event number of its own: "2A Novice Ladies". */
export const legacyEventName = (e: Titled): string => (e.number ? `${e.number} ${e.name}` : e.name);

/**
 * Splits a Calculating For Windows event name that starts with an obvious event number ("3 Novice Ladies",
 * "2A  Junior Men": up to three digits and an optional letter, then a space) into the number and the rest.
 * Any other name is the event's name as it stands.
 */
export function splitEventNumber(legacyName: string): { number?: string; name: string } {
  const match = /^(\d{1,3}[A-Za-z]?)\s+(\S.*)$/.exec(legacyName.trim());
  return match ? { number: match[1]!, name: match[2]!.trim() } : { name: legacyName };
}

/**
 * The number PDFs show for an event: its own number, or without one its place in the competition's running
 * order (`position`, from 1).
 */
export const eventNumberLabel = (e: Pick<CompEvent, 'number'>, position: number): string =>
  e.number || String(position);
