import type { Id } from '../domain/types';
import { fileNameFor } from '../io/competitionFile';
import { document, judgeSheets, resultsPages, type ResultsStyle } from './documents';
import { loadCompetitionEvents, loadEventData, type EventData } from './loadEvent';
import { openPdf } from './pdfmake';

type Target = { eventId: Id } | { competitionId: Id };

const load = async (target: Target): Promise<EventData[]> =>
  'eventId' in target ? [await loadEventData(target.eventId)] : loadCompetitionEvents(target.competitionId);

/** Call directly from a click handler (the PDF tab must open before any await). */
export function printJudgeSheets(target: Target, name: string) {
  return openPdf(
    load(target).then((events) => document(judgeSheets(events), true)),
    fileNameFor(`${name} judge sheets`, 'pdf'),
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
    events.then((e) => document(resultsPages(e, style))),
    fileNameFor(`${name} ${resultsFileSuffix[style]}`, 'pdf'),
  );
  const loaded = await events;
  return { complete: loaded.filter((e) => e.result.complete).length, total: loaded.length };
}
