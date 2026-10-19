import { db } from '../db/db';
import type { Id } from '../domain/types';
import { fileNameFor } from '../io/competitionFile';
import { judgeSheetsDocument, resultsDocument, type ResultsStyle } from './documents';
import { loadCompetitionEvents, loadEventData, type EventData } from './loadEvent';
import { openPdf } from './pdfmake';
import { programmeDocument } from './programme';

type Target = { eventId: Id } | { competitionId: Id };

const load = async (target: Target): Promise<EventData[]> =>
  'eventId' in target ? [await loadEventData(target.eventId)] : loadCompetitionEvents(target.competitionId);

/** Call directly from a click handler (the PDF tab must open before any await). */
/** `perDance` prints a separate sheet for each dance or figure instead of one sheet for the whole event. */
export function printJudgeSheets(target: Target, name: string, perDance = false) {
  return openPdf(
    load(target).then((events) => judgeSheetsDocument(events, perDance)),
    fileNameFor(`${name} judge sheets${perDance ? ' (sheet per dance)' : ''}`, 'pdf'),
  );
}

const resultsFileSuffix: Record<ResultsStyle, string> = {
  standard: 'results',
  withMarks: 'results with marks',
  guest: 'results (guest judges)',
};

/** Call directly from a click handler. Resolves with how many events were complete (and printed). */
export async function printResults(target: Target, name: string, style: ResultsStyle) {
  const events = load(target);
  await openPdf(
    events.then((e) => resultsDocument(e, style, 'eventId' in target)),
    fileNameFor(`${name} ${resultsFileSuffix[style]}`, 'pdf'),
  );
  const loaded = await events;
  return { complete: loaded.filter((e) => e.result.complete).length, total: loaded.length };
}

/** The spectators' programme for a whole competition. Call directly from a click handler. */
export function printProgramme(competitionId: Id, name: string) {
  const doc = Promise.all([db.competitions.get(competitionId), loadCompetitionEvents(competitionId)]).then(
    ([competition, events]) => programmeDocument(competition!, events),
  );
  return openPdf(doc, fileNameFor(`${name} programme`, 'pdf'));
}
