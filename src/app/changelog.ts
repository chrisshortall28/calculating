/** Release notes shown in the "What's New?" popup, newest first. Add an entry when bumping package.json's version. */
export interface Release {
  version: string;
  /** yyyy-mm-dd */
  date?: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.0.1',
    date: '2026-09-26',
    changes: [
      'Print a programme for spectators: a cover in the club colours, a welcome page listing the events, then the skaters in each event in skating order with its dances.',
      'Write the programme’s welcome message in the competition’s details, or leave it blank for a standard welcome.',
    ],
  },
  {
    version: '1.0.0',
    changes: [
      'First release of Podium.',
      'Set up competitions with events, skaters, judges and dances, including pasting in whole lists at once.',
      'Enter judges’ marks quickly in a keyboard-driven grid, with placings calculated as you go.',
      'Export judges’ sheets and results PDFs in the competition’s club colours.',
      'Save and restore competitions as .pod files.',
      'Works offline, in the browser or installed as an app.',
    ],
  },
];
