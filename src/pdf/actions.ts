import type { Id } from '../domain/types';
import { fileNameFor } from '../io/competitionFile';
import { document, judgeSheets, resultsPages } from './documents';
import { loadCompetitionEvents, loadEventData, type EventData } from './loadEvent';
import { openPdf } from './pdfmake';

type Target = { eventId: Id } | { competitionId: Id };

const load = async (target: Target): Promise<EventData[]> =>
  'eventId' in target ? [await loadEventData(target.eventId)] : loadCompetitionEvents(target.competitionId);

/** Call directly from a click handler (the PDF tab must open before any await). */
export function printJudgeSheets(target: Target, name: string) {
  return openPdf(
    load(target).then((events) => document(judgeSheets(events))),
    fileNameFor(`${name} judge sheets`, 'pdf'),
  );
}

/** Call directly from a click handler. Resolves with how many events were complete (and printed). */
export async function printResults(target: Target, name: string, withDetail: boolean) {
  const events = load(target);
  await openPdf(
    events.then((e) => document(resultsPages(e, withDetail))),
    fileNameFor(`${name} results`, 'pdf'),
  );
  const loaded = await events;
  return { complete: loaded.filter((e) => e.result.complete).length, total: loaded.length };
}
