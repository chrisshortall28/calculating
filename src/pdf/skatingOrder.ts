import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { entryHeading } from '../domain/entryName';
import { rotateFrom } from '../domain/startOrder';
import { clubTable, compLine, document, ROWS_PER_COLUMN } from './documents';
import type { EventData } from './loadEvent';

/** The skaters of one dance, figure or programme in the order they skate it, starting from its first skater. */
export function skatingOrderOf(d: EventData, segmentId: string) {
  const first = d.firstSkaters.get(segmentId) ?? 0;
  return rotateFrom(
    d.rows.map((row, index) => ({ row, number: index + 1 })),
    first,
  );
}

function orderTable(d: EventData, order: ReturnType<typeof skatingOrderOf>, firstNumber?: number): Content {
  const entry = d.event.entryType;
  const { th, layout } = clubTable(d);
  const rows: TableCell[][] = order.map(({ row, number }) => {
    const first = number === firstNumber;
    return [
      { text: String(number), alignment: 'center', bold: first },
      {
        stack: [
          { text: row.name, bold: true },
          { text: [row.club, row.members].filter(Boolean).join(' · '), style: 'small' },
        ],
      },
      { text: first ? 'Skates first' : '', style: 'small', bold: true },
    ];
  });
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [24, '*', 56],
      body: [[th('#'), th(entryHeading[entry], { alignment: 'left' }), th('')], ...rows],
    },
    layout,
  };
}

/** One page per dance, figure or programme (`segmentIds` picks which; default all), in event order. */
export function skatingOrderPages(events: EventData[], segmentIds?: ReadonlySet<string>): Content[][] {
  const pages: Content[][] = [];
  for (const d of events) {
    const compulsory = d.segments.filter((s) => s.kind === 'compulsory').length;
    const noun = d.event.discipline === 'figures' ? 'Figure' : 'Dance';
    d.segments.forEach((seg, i) => {
      if (segmentIds && !segmentIds.has(seg.id)) return;
      const order = skatingOrderOf(d, seg.id);
      const firstNumber = d.firstSkaters.has(seg.id) ? order[0]?.number : undefined;
      const number = seg.kind === 'compulsory' ? ` (${noun} ${i + 1} of ${compulsory})` : '';
      const split = order.length > ROWS_PER_COLUMN * 2 ? Math.ceil(order.length / 2) : undefined;
      pages.push([
        { text: compLine(d), style: 'comp' },
        { text: `${d.event.name} — ${seg.name}${number}`, style: 'title' },
        {
          text: `Skating order · ${order.length} ${order.length === 1 ? 'entry' : 'entries'}`,
          style: 'comp',
          margin: [0, 0, 0, 8],
        },
        split === undefined
          ? orderTable(d, order, firstNumber)
          : {
              columns: [
                orderTable(d, order.slice(0, split), firstNumber),
                orderTable(d, order.slice(split), firstNumber),
              ],
              columnGap: 14,
            },
      ]);
    });
  }
  return pages;
}

export function skatingOrderDocument(
  events: EventData[],
  segmentIds?: ReadonlySet<string>,
): TDocumentDefinitions {
  const pages = skatingOrderPages(events, segmentIds).map((content, i) => ({
    stack: content,
    ...(i > 0 ? { pageBreak: 'before' as const } : {}),
  }));
  return document(pages, false, undefined, false);
}
