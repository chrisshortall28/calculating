import { db } from '../db/db';
import type { Id } from '../domain/types';
import { fileNameFor } from '../io/competitionFile';
import { judgeSheetsDocument, resultsDocument, type JudgeSheetOptions, type ResultsStyle } from './documents';
import { loadCompetitionEvents, loadEventData, type EventData } from './loadEvent';
import { openPdf } from './pdfmake';
import { programmeDocument } from './programme';
import { skatingOrderDocument } from './skatingOrder';

/** One event, or a competition's events (`eventIds`: only those, default all). */
type Target = { eventId: Id } | { competitionId: Id; eventIds?: ReadonlySet<Id> };

const load = async (target: Target): Promise<EventData[]> =>
  'eventId' in target
    ? [await loadEventData(target.eventId)]
    : (await loadCompetitionEvents(target.competitionId)).filter(
        (d) => !target.eventIds || target.eventIds.has(d.event.id),
      );

/** Call directly from a click handler (the PDF tab must open before any await). */
export function printJudgeSheets(target: Target, name: string, options: JudgeSheetOptions = {}) {
  const { layout, segmentIds } = options;
  return openPdf(
    load(target).then((events) => judgeSheetsDocument(events, options)),
    fileNameFor(
      `${name} judge sheets${segmentIds ? ' (some parts)' : layout === 'perPart' ? ' (sheet per part)' : ''}`,
      'pdf',
    ),
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

/** The skating order of an event's (or several events') dances, figures or programmes (`segmentIds` picks which, for one event). Call directly from a click handler. */
export function printSkatingOrder(target: Target, name: string, segmentIds?: ReadonlySet<string>) {
  return openPdf(
    load(target).then((events) => skatingOrderDocument(events, segmentIds)),
    fileNameFor(`${name} skating order`, 'pdf'),
  );
}
