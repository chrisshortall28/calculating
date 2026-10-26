import { groupLegacyEvents } from './convert';
import { LegacyFormatError, readLegacyEvent } from './readEvent';
import type { LegacyCompetition } from './types';

export interface LegacyFileInput {
  name: string;
  data: Uint8Array;
}

export interface LegacyFilesRead {
  competitions: LegacyCompetition[];
  /** Files that are not event files at all (e.g. the application's `.tlg` log): not an error. */
  ignored: string[];
  /** Event files (`.ROL`) that could not be read, with why. */
  unreadable: { name: string; message: string }[];
}

const isEventFile = (name: string) => /\.rol$/i.test(name);

/** Natural order, so DATA2B comes before DATA10B. */
const byName = (a: LegacyFileInput, b: LegacyFileInput) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** Reads the files the user chose and groups the events into competitions. */
export function readLegacyFiles(files: LegacyFileInput[]): LegacyFilesRead {
  const ignored: string[] = [];
  const unreadable: LegacyFilesRead['unreadable'] = [];
  const events = [];
  for (const file of [...files].sort(byName)) {
    if (!isEventFile(file.name)) {
      ignored.push(file.name);
      continue;
    }
    try {
      events.push(readLegacyEvent(file.name, file.data));
    } catch (e) {
      if (!(e instanceof LegacyFormatError)) throw e;
      unreadable.push({ name: file.name, message: e.message });
    }
  }
  return { competitions: groupLegacyEvents(events), ignored, unreadable };
}
