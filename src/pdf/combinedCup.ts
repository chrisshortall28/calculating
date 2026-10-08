import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  categoryLabel,
  cupTieNotes,
  type CupCategoryResult,
  type CupPart,
  type CupRanked,
  type CupStandings,
} from '../cup/combinedCup';
import type { Competition, Id } from '../domain/types';
import { ordinalLabel } from '../scoring';
import { clubTable, compLine, document } from './documents';

const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;
const place = (n: number, tied: boolean) => `${ordinalLabel(n)}${tied ? '=' : ''}`;

/** What counted for one part, then any disregarded events (struck through) and events still in progress. */
function partCell(part: CupPart): TableCell {
  const { counted, notCounted, pending } = part;
  if (!counted && !notCounted.length && !pending.length) return { text: '—', color: '#999' };
  const stack: Content[] = [];
  if (counted)
    stack.push(
      { text: `${place(counted.place, counted.tied)} · ${pts(counted.points)}`, bold: true },
      { text: counted.eventName, style: 'small' },
    );
  for (const p of notCounted)
    stack.push({
      text: [
        { text: `${p.eventName}: ${place(p.place, p.tied)} · ${pts(p.points)}`, decoration: 'lineThrough' },
        ' (not counted)',
      ],
      style: 'small',
    });
  for (const name of pending) stack.push({ text: `${name}: in progress`, style: 'small' });
  return { stack };
}

function categoryTable(
  competition: Competition,
  c: CupCategoryResult,
  nameOf: (id: Id) => string,
  clubOf: (id: Id) => string,
): Content[] {
  const { th, layout } = clubTable({ competition });
  const head: TableCell[] = [
    th('Rank'),
    th('Skater', { alignment: 'left' }),
    th('Solo dance', { alignment: 'left' }),
    th('Duo dance', { alignment: 'left' }),
    th('Team', { alignment: 'left' }),
    th('Mix & Match', { alignment: 'left' }),
    th('Total'),
  ];
  const rows: TableCell[][] = c.ranked.map((r: CupRanked) => [
    { text: `${r.rank}${r.tied ? '=' : ''}`, alignment: 'center', bold: true },
    { stack: [{ text: nameOf(r.skaterId) }, { text: clubOf(r.skaterId), style: 'small' }] },
    partCell(r.solo),
    partCell(r.duo),
    partCell(r.team),
    partCell(r.mixmatch),
    { text: String(r.total), alignment: 'center', bold: true },
  ]);
  return [
    { text: categoryLabel(c.category), style: 'h2' },
    ...(c.ranked.length === 0
      ? [{ text: 'No entrants in this category.', style: 'small' } as Content]
      : [
          {
            text: `${c.winners.length > 1 ? 'Joint winners' : 'Winner'}: ${c.winners.map(nameOf).join(' & ')}`,
            bold: true,
            margin: [0, 0, 0, 4],
          } as Content,
          {
            table: { headerRows: 1, widths: [30, '*', 105, 105, 105, 105, 34], body: [head, ...rows] },
            layout,
            fontSize: 8.5,
          } as Content,
          ...cupTieNotes(c, nameOf, true).map(
            (note) => ({ text: note, style: 'small', margin: [0, 3, 0, 0] }) as Content,
          ),
        ]),
  ];
}

/** The Combined Cup results: the winner of each category, then each category's ranking and workings. */
export function combinedCupDocument(
  competition: Competition,
  standings: CupStandings,
  skaters: { id: Id; name: string; club: string }[],
): TDocumentDefinitions {
  const byId = new Map(skaters.map((s) => [s.id, s]));
  const nameOf = (id: Id) => byId.get(id)?.name ?? '?';
  const clubOf = (id: Id) => byId.get(id)?.club ?? '';
  const content: Content[] = [
    { text: compLine({ competition }), style: 'comp' },
    { text: 'The Combined Cup', style: 'title' },
    ...(standings.provisional
      ? [
          {
            text: 'Provisional: some events are not yet complete.',
            style: 'small',
            margin: [0, 0, 0, 4],
          } as Content,
        ]
      : []),
    ...standings.categories.flatMap((c) => categoryTable(competition, c, nameOf, clubOf)),
    {
      text: 'Points: 5 for 1st, 4 for 2nd, 3 for 3rd, 2 for 4th, 1 for 5th. Each skater scores their solo dance, duo dance, best team event and Mix & Match; other team results are not counted.',
      style: 'small',
      margin: [0, 10, 0, 0],
    },
  ];
  return document(content, true);
}
